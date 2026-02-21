import { db as prisma } from "@/lib/db";
import { createPublicClient, http, parseAbiItem } from "viem";
import { bsc, bscTestnet, mainnet } from "viem/chains";
import { MediaRewardContractV2ABI } from "@/lib/contracts/abis/MediaRewardContractV2";
import { CONTRACT_ADDRESSES, CONTRACT_NAMES, DEFAULT_CHAIN_ID } from "@/lib/contracts/addresses";
import logger from "../lib/logger";

// Create public client for reading events (no private key needed)
const RPC_URL = process.env.RPC_URL;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || DEFAULT_CHAIN_ID.toString());
const chain = CHAIN_ID === bscTestnet.id ? bscTestnet : CHAIN_ID === bsc.id ? bsc : mainnet;

const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

// Scan window configuration
const BLOCK_WINDOW = 200n; // ~10 minutes on BSC (3s block time)

export async function scanActionEvents() {
  logger.info("[EventIndexer] Starting ActionRecorded event scan...");

  try {
    const contractAddress = CONTRACT_ADDRESSES[CHAIN_ID]?.[CONTRACT_NAMES.MediaRewardContractV2];
    if (!contractAddress) throw new Error("Contract address not found");

    // 1. Get current block number
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = currentBlock - BLOCK_WINDOW;

    logger.info(`[EventIndexer] Scanning blocks ${fromBlock} to ${currentBlock}`);

    // 2. Get logs
    const logs = await publicClient.getContractEvents({
      address: contractAddress as `0x${string}`,
      abi: MediaRewardContractV2ABI,
      eventName: "ActionRecorded",
      fromBlock: fromBlock,
      toBlock: currentBlock,
    });

    if (logs.length === 0) {
      logger.info("[EventIndexer] No ActionRecorded events found in range.");
      return;
    }

    logger.info(`[EventIndexer] Found ${logs.length} events. Processing...`);

    // 3. Process logs
    let updatedCount = 0;
    const ActionMap: Record<number, string> = {
      0: "VIEW",
      1: "LIKE",
      2: "COMMENT",
      3: "SHARE",
    };
    
    // Map Active ActionType to Passive Action Name
    // Note: This relies on the assumption that ActionType 1 (LIKE) results in "LIKED" for the receiver
    const PassiveMap: Record<number, string> = {
      0: "VIEWED",
      1: "LIKED",
      2: "COMMENTED",
      3: "SHARED",
    };

    for (const log of logs) {
      const txHash = log.transactionHash;
      if (!txHash) continue;
      
      const { user, actionType, points, signer } = log.args;
      const blockNumber = log.blockNumber;
      // Using logIndex to generate unique nonce for indexing-created records
      // Format: index-txHash-logIndex
      const logIndex = log.logIndex; 

      if (!user || actionType === undefined) continue;

      const isPassive = user !== signer;
      const typeKey = Number(actionType);
      
      // Determine Action String
      let actionString = "UNKNOWN";
      if (!isPassive) {
           actionString = ActionMap[typeKey] || "UNKNOWN";
      } else {
           actionString = PassiveMap[typeKey] || "UNKNOWN";
      }

      // 1. Try to find existing record by txHash AND userId
      // The API creates record with userId = Actor (Signer). 
      // So for Active actions, we might find it.
      // For Passive actions, we won't find it (unless API creates it, which it likely doesn't).
      
      const record = await prisma.userActionRecord.findFirst({
        where: { 
          txHash: txHash,
          userId: user,  // Critical: Match the beneficiary
          status: { not: "CONFIRMED" } 
        }
      });

      if (record) {
        // Update existing record
        await prisma.userActionRecord.update({
          where: { id: record.id },
          data: {
            status: "CONFIRMED",
            points: points,
            blockNumber: blockNumber,
            action: actionString, // Ensure action name matches protocol
          },
        });
        updatedCount++;
        logger.info(`[EventIndexer] Updated record ${record.id} (${actionString}) for ${user}`);
      } else {
        // Create new record (Missed by API or Passive Action)
        // Ensure idempotency using unique nonce
        const uniqueNonce = `idx-${txHash}-${logIndex}`;
        
        // Try to find a sibling record (likely the Active Action) to copy metadata
        const sibling = await prisma.userActionRecord.findFirst({
            where: { txHash: txHash }
        });
        
        // We use upsert on nonce to be safe
        await prisma.userActionRecord.upsert({
            where: { nonce: uniqueNonce },
            update: {
                status: "CONFIRMED",
                points: points,
                blockNumber: blockNumber,
                // If updating, we might also want to backfill nodeId if missing?
                // For now, assume update doesn't need to fix metadata.
            },
            create: {
                userId: user,
                action: actionString,
                points: points,
                status: "CONFIRMED",
                txHash: txHash,
                blockNumber: blockNumber,
                nonce: uniqueNonce,
                // Inherit metadata if available
                nodeId: sibling?.nodeId,
                articleId: sibling?.articleId,
            }
        });
        updatedCount++;
        logger.info(`[EventIndexer] Created record (${actionString}) for ${user}`);
      }
    }

    logger.info(`[EventIndexer] Scan complete. Processed ${updatedCount} records.`);

  } catch (error) {
    logger.error("[EventIndexer] Failed to scan events:", error);
  }
}
