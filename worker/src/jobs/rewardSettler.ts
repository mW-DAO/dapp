import { createWalletClient, http, publicActions, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc, bscTestnet, mainnet } from "viem/chains";
import { MediaRewardContractV2ABI } from "@/lib/contracts/abis/MediaRewardContractV2";
import { CONTRACT_ADDRESSES, CONTRACT_NAMES, DEFAULT_CHAIN_ID } from "@/lib/contracts/addresses";
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

export async function processRewardSettlement() {
  if (!client || !account) {
    logger.error("[RewardSettler] Missing ADMIN_PRIVATE_KEY or Client init failed");
    return;
  }

  logger.info(`[RewardSettler] Starting Reward Settlement Check...`);

  try {
    const contractAddress = CONTRACT_ADDRESSES[CHAIN_ID]?.[CONTRACT_NAMES.MediaRewardContractV2];
    if (!contractAddress) throw new Error("Contract address not found");

    // 0. Check Admin Wallet Balance
    const balance = await client.getBalance({ address: account.address });
    const balanceEth = formatEther(balance);
    logger.info(`[RewardSettler] Admin Wallet Balance: ${balanceEth} ETH`);

    // Threshold: 0.002 ETH (Approx gas for complex tx)
    // If balance is extremely low, we might fail.
    if (balance < 2000000000000000n) { // 0.002 * 1e18
       logger.warn(`[RewardSettler] ⚠️ Low Balance Alert! Admin has only ${balanceEth} ETH.`);
       if (balance === 0n) {
          logger.error(`[RewardSettler] ❌ insufficient funds for gas * price + value. Aborting.`);
          return;
       }
    }

    // 1. Get Settlement Info
    // returns (timeRemaining, totalPoints, totalUsersCount, availableCMW)
    const settlementInfo = await client.readContract({
      address: contractAddress,
      abi: MediaRewardContractV2ABI,
      functionName: "getSettlementInfo",
    }) as [bigint, bigint, bigint, bigint];

    const [timeRemaining, totalPoints, totalUsersCount, availableCMW] = settlementInfo;

    logger.info(`[RewardSettler] Info: TimeRemaining=${timeRemaining}s, TotalPoints=${totalPoints}, Users=${totalUsersCount}`);

    // 2. Check Conditions
    if (timeRemaining > 0n) {
      logger.info(`[RewardSettler] Settlement not ready yet. waiting...`);
      return;
    }

    if (totalPoints === 0n) {
      logger.info(`[RewardSettler] Total points is 0. Skipping settlement to save gas.`);
      return;
    }

    if (availableCMW === 0n) {
      logger.info(`[RewardSettler] Available CMW is 0. Skipping settlement to prevent zero-reward point clearing.`);
      // If we settle now, users lose points for 0 reward. Better to wait for funding.
      return;
    }

    // 3. Execute Settlement
    logger.info(`[RewardSettler] Conditions met. Executing settlement...`);
    
    const hash = await client.writeContract({
      address: contractAddress,
      abi: MediaRewardContractV2ABI,
      functionName: "settleRewards",
    });

    logger.info(`[RewardSettler] Transaction sent: ${hash}. Waiting for confirmation...`);

    const receipt = await client.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      logger.info(`[RewardSettler] ✅ Settlement confirmed in block ${receipt.blockNumber}`);
      return true;
    } else {
      logger.error(`[RewardSettler] ❌ Transaction failed on-chain!`);
      return false;
    }
    
  } catch (error: any) {
    logger.error(`[RewardSettler] Failed to process settlement:`, error);
    return false;
  }
}
