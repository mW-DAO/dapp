import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { useMediaRewardContractV2 } from "@/lib/contracts";
import { type Address, formatEther, parseEther } from "viem";
import { toNumber } from "@/lib/utils/bigint-helpers";

export enum ActionType {
  VIEW = 0,
  LIKE = 1,
  COMMENT = 2,
  SHARE = 3,
}

export enum PassiveActionType {
  VIEWED = 0,
  SHARED = 1,
  LIKED = 2,
  COMMENTED = 3,
}

// --- Reads ---

/**
 * 获取奖励配置 (Constants & Multipliers)
 */
export function useRewardConfig() {
  const { address: contractAddress, abi } = useMediaRewardContractV2();

  const results = useReadContracts({
    contracts: [
      { address: contractAddress, abi, functionName: "REWARD_UNIT" },
      { address: contractAddress, abi, functionName: "settlementInterval" },
      // Active Multipliers
      { address: contractAddress, abi, functionName: "rewardMultipliers", args: [ActionType.VIEW] },
      { address: contractAddress, abi, functionName: "rewardMultipliers", args: [ActionType.LIKE] },
      {
        address: contractAddress,
        abi,
        functionName: "rewardMultipliers",
        args: [ActionType.COMMENT],
      },
      {
        address: contractAddress,
        abi,
        functionName: "rewardMultipliers",
        args: [ActionType.SHARE],
      },
      // Passive Multipliers
      {
        address: contractAddress,
        abi,
        functionName: "passiveRewardMultipliers",
        args: [PassiveActionType.VIEWED],
      },
      {
        address: contractAddress,
        abi,
        functionName: "passiveRewardMultipliers",
        args: [PassiveActionType.SHARED],
      },
      {
        address: contractAddress,
        abi,
        functionName: "passiveRewardMultipliers",
        args: [PassiveActionType.LIKED],
      },
      {
        address: contractAddress,
        abi,
        functionName: "passiveRewardMultipliers",
        args: [PassiveActionType.COMMENTED],
      },
    ],
  });

  const [
    rewardUnit,
    settlementInterval,
    // Active
    viewMult,
    likeMult,
    commentMult,
    shareMult,
    // Passive
    viewedMult,
    sharedMult,
    likedMult,
    commentedMult,
  ] = results.data || [];

  return {
    isLoading: results.isLoading,
    isError: results.isError,
    data: {
      rewardUnit: rewardUnit?.result ? formatEther(rewardUnit.result) : "0",
      settlementInterval: toNumber(settlementInterval?.result),
      multipliers: {
        active: {
          VIEW: viewMult?.result?.toString() || "0",
          LIKE: likeMult?.result?.toString() || "0",
          COMMENT: commentMult?.result?.toString() || "0",
          SHARE: shareMult?.result?.toString() || "0",
        },
        passive: {
          VIEWED: viewedMult?.result?.toString() || "0",
          SHARED: sharedMult?.result?.toString() || "0",
          LIKED: likedMult?.result?.toString() || "0",
          COMMENTED: commentedMult?.result?.toString() || "0",
        },
      },
    },
    refetch: results.refetch,
  };
}

/**
 * 获取合约基本信息 (Global Contract Info)
 */
export function useMediaRewardInfo() {
  const { address: contractAddress, abi } = useMediaRewardContractV2();

  const results = useReadContracts({
    contracts: [
      { address: contractAddress, abi, functionName: "cmwToken" },
      { address: contractAddress, abi, functionName: "mwnftContract" },
      { address: contractAddress, abi, functionName: "totalUsers" },
      { address: contractAddress, abi, functionName: "totalPointsAccumulated" },
      { address: contractAddress, abi, functionName: "nextSettlementTime" },
      { address: contractAddress, abi, functionName: "lastSettlementCMW" },
    ],
    query: {
      refetchInterval: 30000,
    },
  });

  const [cmwToken, mwnftContract, totalUsers, totalPoints, nextSettlement, lastSettlementCMW] =
    results.data || [];

  return {
    isLoading: results.isLoading,
    isError: results.isError,
    data: {
      cmwToken: cmwToken?.result,
      mwnftContract: mwnftContract?.result,
      totalUsers: toNumber(totalUsers?.result),
      totalPoints: totalPoints?.result ? totalPoints.result.toString() : "0",
      nextSettlementTime: nextSettlement?.result
        ? new Date(toNumber(nextSettlement.result) * 1000)
        : null,
      lastSettlementCMW: lastSettlementCMW?.result ? formatEther(lastSettlementCMW.result) : "0",
    },
    refetch: results.refetch,
  };
}

/**
 * 获取用户信息 (User Info & Rewards)
 */
export function useUserRewardInfo(targetAddress?: Address) {
  const { address: contractAddress, abi } = useMediaRewardContractV2();
  const { address: userAddress } = useAccount();
  const accountToCheck = targetAddress || userAddress;

  const results = useReadContracts({
    contracts: [
      {
        address: contractAddress,
        abi,
        functionName: "users",
        args: accountToCheck ? [accountToCheck] : undefined,
      },
      {
        address: contractAddress,
        abi,
        functionName: "userRewards",
        args: accountToCheck ? [accountToCheck] : undefined,
      },
      {
        address: contractAddress,
        abi,
        functionName: "getEstimatedReward",
        args: accountToCheck ? [accountToCheck] : undefined,
      },
    ],
    query: {
      enabled: !!accountToCheck,
      refetchInterval: 10000,
    },
  });

  const [userInfoResult, userRewardsResult, estimatedResult] = results.data || [];

  const userInfo = userInfoResult?.result as [number, bigint, boolean, bigint] | undefined; // [userType, nftTokenId, isActive, registeredAt]

  const userReward = userRewardsResult?.result as [bigint, bigint, bigint] | undefined; // [points, pendingCMW, totalEarned]

  const estimated = estimatedResult?.result as [bigint, bigint] | undefined; // [estimatedCMW, sharePercentage]

  return {
    isLoading: results.isLoading,
    isError: results.isError,
    data: {
      // User Info
      userType: userInfo ? (userInfo[0] === 0 ? "NORMAL" : "SUPER") : "UNKNOWN",
      nftTokenId: userInfo ? userInfo[1].toString() : "0",
      isActive: userInfo ? userInfo[2] : false,
      registeredAt: userInfo ? new Date(Number(userInfo[3]) * 1000) : null,

      // Rewards
      points: userReward ? userReward[0].toString() : "0",
      pendingCMW: userReward ? formatEther(userReward[1]) : "0",
      totalEarned: userReward ? formatEther(userReward[2]) : "0",

      // Estimated
      estimatedCMW: estimated ? formatEther(estimated[0]) : "0",
      sharePercentage: estimated ? formatEther(estimated[1]) : "0",
    },
    refetch: results.refetch,
  };
}

/**
 * 获取结算信息 (Settlement Info)
 */
export function useSettlementInfo() {
  const { address: contractAddress, abi } = useMediaRewardContractV2();

  const { data, isLoading, isError, refetch } = useReadContract({
    address: contractAddress,
    abi,
    functionName: "getSettlementInfo",
  });

  const [timeRemaining, totalPoints, totalUsersCount, availableCMW] = (data as [
    bigint,
    bigint,
    bigint,
    bigint,
  ]) || [0n, 0n, 0n, 0n];

  return {
    isLoading,
    isError,
    data: {
      timeRemainingHours: (Number(timeRemaining) / 3600).toFixed(2),
      totalPoints: totalPoints.toString(),
      totalUsers: totalUsersCount.toString(),
      availableCMW: formatEther(availableCMW),
    },
    refetch,
  };
}

// --- Writes ---

export function useRegisterUser() {
  const { address: contractAddress, abi } = useMediaRewardContractV2();
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  // Hook for waiting (optional usage in UI)
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const register = (userAddress: Address, userType: number, nftTokenId = 0n) => {
    writeContract({
      address: contractAddress,
      abi,
      functionName: "registerUser",
      args: [userAddress, userType, nftTokenId],
    });
  };

  return {
    register,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

export function useRecordAction() {
  const { address: contractAddress, abi } = useMediaRewardContractV2();
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const record = (
    userAddress: Address,
    actionType: number,
    timestamp: bigint,
    signature: `0x${string}`
  ) => {
    writeContract({
      address: contractAddress,
      abi,
      functionName: "recordAction",
      args: [userAddress, actionType, timestamp, signature],
    });
  };

  return {
    record,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

export function useClaimRewards() {
  const { address: contractAddress, abi } = useMediaRewardContractV2();
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claim = () => {
    writeContract({
      address: contractAddress,
      abi,
      functionName: "claimRewards",
    });
  };

  return {
    claim,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

export function useBatchClaimRewards() {
  const { address: contractAddress, abi } = useMediaRewardContractV2();
  const { writeContract, isPending, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const batchClaim = (userList: Address[]) => {
    writeContract({
      address: contractAddress,
      abi,
      functionName: "batchClaimRewards",
      args: [userList],
    });
  };

  return { batchClaim, isPending, isConfirming, isSuccess, hash, error };
}

export function useSettleRewards() {
  const { address: contractAddress, abi } = useMediaRewardContractV2();
  const { writeContract, isPending, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const settle = () => {
    writeContract({
      address: contractAddress,
      abi,
      functionName: "settleRewards",
    });
  };

  return { settle, isPending, isConfirming, isSuccess, hash, error };
}

export function useFundSettlementRewards() {
  const { address: contractAddress, abi } = useMediaRewardContractV2();
  const { writeContract, isPending, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const fund = (ethAmount: string) => {
    writeContract({
      address: contractAddress,
      abi,
      functionName: "fundSettlementRewards",
      value: parseEther(ethAmount),
    });
  };

  return { fund, isPending, isConfirming, isSuccess, hash, error };
}
