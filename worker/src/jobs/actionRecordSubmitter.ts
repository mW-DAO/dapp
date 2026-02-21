import { db as prisma } from "@/lib/db";
import { createWalletClient, http, publicActions, keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc, bscTestnet, mainnet } from "viem/chains";
import { MediaRewardContractV2ABI } from "@/lib/contracts/abis/MediaRewardContractV2";
import { CONTRACT_ADDRESSES, CONTRACT_NAMES, DEFAULT_CHAIN_ID } from "@/lib/contracts/addresses";
import { 
  ACTION_LIKE, 
  ACTION_DISLIKE, 
  ACTION_SHARE, 
  ACTION_VIEW, 
  ACTION_COMMENT 
} from "@/lib/constants/actions";
import { ActionStatus } from "@prisma/client";
import logger from "../lib/logger";

// Environment variables
const RPC_URL = process.env.RPC_URL;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY as `0x${string}`;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || DEFAULT_CHAIN_ID.toString());

// Configure Chain
const chain = CHAIN_ID === bscTestnet.id ? bscTestnet : CHAIN_ID === bsc.id ? bsc : mainnet;

// Initialize Wallet Client (Admin)
const account = ADMIN_PRIVATE_KEY ? privateKeyToAccount(ADMIN_PRIVATE_KEY) : null;

const client = account
  ? createWalletClient({
      account,
      chain,
      transport: http(RPC_URL),
    }).extend(publicActions)
  : null;

/**
 * Mapping UserActionRecord.action (String) -> Contract ActionType (Uint8)
 */
const ACTION_TYPE_MAP: Record<string, number> = {
  [ACTION_VIEW]: 0,
  [ACTION_LIKE]: 1,
  [ACTION_COMMENT]: 2,
  [ACTION_SHARE]: 3,
  // [ACTION_DISLIKE]: ?, // Not defined in V2 Doc Enum
};

const BATCH_SIZE = 20;

export async function processPendingActions() {
  if (!client || !account) {
    logger.error("[Worker] Missing ADMIN_PRIVATE_KEY or Client init failed");
    return;
  }

  logger.info(`[Worker] Starting Pending Action Submission...`);

  // 1. Fetch PENDING records
  const pendingActions = await prisma.userActionRecord.findMany({
    where: { status: "PENDING" },
    take: BATCH_SIZE,
    orderBy: { createdAt: "asc" },
    include: {
      user: true,
    },
  });

  if (pendingActions.length === 0) {
    logger.info("[Worker] No pending actions to process.");
    return;
  }

  logger.info(`[Worker] Found ${pendingActions.length} pending actions.`);

  // 2. Process each action
  for (const record of pendingActions) {
    try {
      
      // 1. Map Action Type
      const actionType = ACTION_TYPE_MAP[record.action];
      if (actionType === undefined) {
        logger.warn(`[Worker] Unknown action type: ${record.action}`);
        await prisma.userActionRecord.update({
          where: { id: record.id },
          data: { status: "FAILED" },
        });
        continue;
      }

      // 2. Generate Operator Signature (V2 Spec)
      const timestamp = BigInt(Math.floor(record.createdAt.getTime() / 1000));
      
      const messageHash = keccak256(
        encodePacked(
          ["string", "address", "uint256", "uint256", "uint256"],
          ["RecordAction:", record.user.address as `0x${string}`, BigInt(actionType), timestamp, BigInt(CHAIN_ID)]
        )
      );

      const signature = await account.signMessage({
        message: { raw: messageHash },
      });
      
      logger.info(`[Worker] Generated Operator Signature for ${record.id}`);

      // 3. Submit to Chain
      logger.info(`[Worker] Submitting action ${record.id} (${record.action}) for user ${record.user.address}`);

      const contractAddress = CONTRACT_ADDRESSES[CHAIN_ID]?.[CONTRACT_NAMES.MediaRewardContractV2];
      if (!contractAddress) throw new Error("Contract address not found");

      const hash = await client.writeContract({
        address: contractAddress,
        abi: MediaRewardContractV2ABI,
        functionName: "recordAction",
        args: [
           record.user.address as `0x${string}`, 
           actionType, 
           timestamp, 
           signature
        ],
      });

      logger.info(`[Worker] Tx submitted: ${hash}`);

      // 4. Update DB
      await prisma.userActionRecord.update({
        where: { id: record.id },
        data: {
          status: "SUBMITTED",
          txHash: hash,
        },
      });

    } catch (error: any) {
      logger.error(`[Worker] Failed to process record ${record.id}:`, error);
      // Optional: Logic to handle failures
    }
  }
}
