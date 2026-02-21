import { db as prisma } from "@/lib/db";
import { createPublicClient, http } from "viem";
import { bsc, bscTestnet, mainnet } from "viem/chains";
import { MediaRewardContractV2ABI } from "@/lib/contracts/abis/MediaRewardContractV2";
import { CONTRACT_ADDRESSES, CONTRACT_NAMES, DEFAULT_CHAIN_ID } from "@/lib/contracts/addresses";
import logger from "../lib/logger";
import { Decimal } from "@prisma/client/runtime/library";

const RPC_URL = process.env.RPC_URL;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || DEFAULT_CHAIN_ID.toString());
const chain = CHAIN_ID === bscTestnet.id ? bscTestnet : CHAIN_ID === bsc.id ? bsc : mainnet;

const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

// Safety window to avoid reorg issues, though less critical for settlements
const SAFE_BLOCKS = 5n;

export async function scanSettlementEvents() {
  logger.info("[SettlementIndexer] Starting SettlementCompleted event scan...");

  try {
    const contractAddress = CONTRACT_ADDRESSES[CHAIN_ID]?.[CONTRACT_NAMES.MediaRewardContractV2];
    if (!contractAddress) throw new Error("Contract address not found");

    // 1. Determine scan range
    // Find the last indexed settlement block to continue from there
    const lastSettlement = await prisma.settlement.findFirst({
      orderBy: { blockNumber: "desc" },
    });

    const currentBlock = await publicClient.getBlockNumber();
    
    // Default to scanning last 10000 blocks if no history, or from last settlement + 1
    // Adjust 10000 based on deployment block if needed
    let fromBlock = lastSettlement 
      ? BigInt(lastSettlement.blockNumber) + 1n 
      : currentBlock - 20000n; 

    // Safety check: ensure fromBlock is not negative
    if (fromBlock < 0n) fromBlock = 0n;

    if (fromBlock > currentBlock) {
      logger.info("[SettlementIndexer] Already up to date.");
      return;
    }

    logger.info(`[SettlementIndexer] Scanning blocks ${fromBlock} to ${currentBlock}`);

    // 2. Fetch Events with Chunking
    const CHUNK_SIZE = 3000n;
    const logs = [];

    for (let chunkFrom = fromBlock; chunkFrom <= currentBlock; chunkFrom += CHUNK_SIZE) {
      const chunkTo = chunkFrom + CHUNK_SIZE - 1n > currentBlock ? currentBlock : chunkFrom + CHUNK_SIZE - 1n;
      
      logger.info(`[SettlementIndexer] Scanning chunk: ${chunkFrom} to ${chunkTo}`);

      try {
        const chunkLogs = await publicClient.getContractEvents({
          address: contractAddress as `0x${string}`,
          abi: MediaRewardContractV2ABI,
          eventName: "SettlementCompleted",
          fromBlock: chunkFrom,
          toBlock: chunkTo,
        });
        logs.push(...chunkLogs);
      } catch (e) {
        logger.error(`[SettlementIndexer] Failed to fetch chunk ${chunkFrom}-${chunkTo}`, e);
        // Continue or break? If one chunk fails, likely others might too if it's rate limit. 
        // But for safety, let's log and re-throw to retry next time?
        // Or just continue to try getting partial data? 
        // Best to fail fast for data integrity, let cron retry later.
        throw e;
      }
    }

    if (logs.length === 0) {
      logger.info("[SettlementIndexer] No SettlementCompleted events found.");
      return;
    }

    logger.info(`[SettlementIndexer] Found ${logs.length} settlement events. Processing...`);

    // 3. Process Events
    for (const log of logs) {
      const txHash = log.transactionHash;
      if (!txHash) continue;
      
      const { totalPoints, settlementReward, totalCMW, settler, timestamp } = log.args;
      const blockNumber = log.blockNumber;

      // Idempotency Check
      const exists = await prisma.settlement.findUnique({
        where: { txHash },
      });

      if (exists) {
        logger.info(`[SettlementIndexer] Settlement ${txHash} already indexed. Skipping.`);
        continue;
      }

      // Calculate Unit Price using 1e18 precision to match Solidity behavior
      // Note: We don't store unitPrice in DB as Decimal anymore for calculation usage, 
      // but we still save it for record. 
      // Ideally we replicate the exact math:
      // uint256 userShare = (rewards.points * 1e18) / totalPointsAccumulated;
      // uint256 userCMW = (cmwIncrement * userShare) / 1e18;
      
      const PRECISION = 10n ** 18n;
      
      // We calculate an approximate unitPrice for display/DB storage, 
      // but actual attribution will use the 2-step BigInt math.
      let unitPriceDisplay = new Decimal(0);
      if (totalPoints && totalPoints > 0n) {
        const rewardDec = new Decimal((settlementReward || 0n).toString());
        const pointsDec = new Decimal(totalPoints.toString());
        unitPriceDisplay = rewardDec.div(pointsDec);
      }

      // Create Settlement Record
      const settlement = await prisma.settlement.create({
        data: {
          txHash,
          blockNumber: blockNumber,
          totalPoints: totalPoints || 0n,
          totalRewards: settlementReward || 0n,
          unitPrice: unitPriceDisplay,
        },
      });

      logger.info(`[SettlementIndexer] Indexed Settlement ${settlement.id} (Block: ${blockNumber}, Price: ${unitPriceDisplay})`);

      // 4. Backfill Attribution (Retroactive)
      // Find all CONFIRMED records with NO settlementId and blockNumber <= settlementBlock
      const recordsToUpdate = await prisma.userActionRecord.findMany({
        where: {
          status: "CONFIRMED",
          settlementId: null,
          blockNumber: {
            lte: blockNumber, // Important: include records in the same block if index < logIndex? 
                              // Ideally we rely on blockNumber. 
                              // If action and settlement are in same block, action usually comes first if it contributed to totalPoints? 
                              // Or actually, settleRewards() is a separate tx. So actions must be in previous blocks or earlier in this block.
                              // Simple lte is fine.
          },
        },
      });

      logger.info(`[SettlementIndexer] Found ${recordsToUpdate.length} records to attribute.`);

      if (recordsToUpdate.length > 0) {
        // Update in batches or one by one
        // For accurate calculation: earned = point * unitPrice
        // Verify precision issues. 
        // points (BigInt) * unitPrice (Decimal) -> result (Decimal) -> BigInt (Floor)
        
        let updateCount = 0;
        
        // Using transaction for batch update might be too heavy if many records.
        // Let's do parallel updates or batched lookup-update.
        // Here iterating for simplicity and precision.
        
        for (const record of recordsToUpdate) {
            if (!record.points) continue;
            
            // Solidity Logic Replication:
            // uint256 userShare = (points * 1e18) / totalPoints;
            // uint256 userCMW = (reward * userShare) / 1e18;
            
            const pointsBig = record.points; // BigInt
            const totalPointsBig = totalPoints || 0n;
            const rewardBig = settlementReward || 0n;

            if (totalPointsBig === 0n) continue;

            // Step 1: Calculate Share (Scale 1e18)
            const userShare = (pointsBig * PRECISION) / totalPointsBig;

            // Step 2: Calculate Reward
            const earnedBigInt = (rewardBig * userShare) / PRECISION;
            
            await prisma.userActionRecord.update({
                where: { id: record.id },
                data: {
                    settlementId: settlement.id,
                    earnedCMW: earnedBigInt,
                }
            });
            updateCount++;
        }
        logger.info(`[SettlementIndexer] Attributed ${updateCount} records.`);
      }
    }

  } catch (error) {
    logger.error("[SettlementIndexer] Failed to scan events:", error);
  }
}
