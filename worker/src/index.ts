import "dotenv/config"; // Must be first!
import cron from "node-cron";
import { processPendingActions } from "./jobs/actionRecordSubmitter";
import { processRewardSettlement } from "./jobs/rewardSettler";
import { scanActionEvents } from "./jobs/rewardContractEventIndexer";
import { scanSettlementEvents } from "./jobs/settlementIndexer";
import logger from "./lib/logger";

import path from "path";

async function main() {
  logger.info("🚀 Worker service started");

  // --- 1. Cron Jobs ---
  logger.info("⏰ Scheduling cron jobs...");

  // Job: Submit Pending Actions to Blockchain
  // Schedule: Every 2 hours (0 */2 * * *)
  // Timezone: Asia/Shanghai (UTC+8)
  cron.schedule(
    "0 */2 * * *", 
    async () => {
      logger.info(`[Cron] Triggering Action Submitter at ${new Date().toISOString()}`);
      try {
        await processPendingActions();
      } catch (error) {
        logger.error("[Cron] Action Submitter Job Failed:", error);
      }
    },
    {
      timezone: "Asia/Shanghai",
    }
  );

  // Job: Settle Rewards
  // Schedule: Every day at 00:00 and 12:00 (UTC+8)
  cron.schedule(
    "0 0,12 * * *",
    async () => {
      logger.info(`[Cron] Triggering Reward Settlement at ${new Date().toISOString()}`);
      try {
        const settled = await processRewardSettlement();
        if (settled) {
          logger.info("[Cron] Settlement confirmed. Triggering immediate event scan...");
          await scanSettlementEvents();
        }
      } catch (error) {
        logger.error("[Cron] Reward Settlement Job Failed:", error);
      }
    },
    {
      timezone: "Asia/Shanghai",
    }
  );

  // Job: Index Action Events (Points)
  // Schedule: Every 5 minutes
  cron.schedule(
    "*/5 * * * *",
    async () => {
      logger.info(`[Cron] Triggering Event Indexer at ${new Date().toISOString()}`);
      try {
        await scanActionEvents();
      } catch (error) {
        logger.error("[Cron] Event Indexer Job Failed:", error);
      }
    }
  );

  // Job: Index Settlement Events (Attribution)
  // Schedule: Every 1 hour (as a backup/safety net)
  cron.schedule(
    "0 * * * *",
    async () => {
      logger.info(`[Cron] Triggering Settlement Indexer (Backup) at ${new Date().toISOString()}`);
      try {
        await scanSettlementEvents();
      } catch (error) {
        logger.error("[Cron] Settlement Indexer Job Failed:", error);
      }
    }
  );

  logger.info("🎧 Setting up Web3 event listeners...");
}

main().catch((e) => {
  logger.error("Worker crashed:", e);
  process.exit(1);
});
