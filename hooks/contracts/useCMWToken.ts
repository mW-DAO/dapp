import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { useCMWTokenContract } from "@/lib/contracts";
import { type Address, formatEther, parseEther } from "viem";
import React, { useState } from "react";
import { toNumber } from "@/lib/utils/bigint-helpers";

// --- Reads ---

/**
 * Get CMW Token Balance for an address
 */
export function useCMWTokenBalance(address?: Address) {
  const { address: contractAddress, abi } = useCMWTokenContract();
  return useReadContract({
    address: contractAddress,
    abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

/**
 * Get Comprehensive CMW Token State
 * Includes: Basic Info, Emission Info, Role checks
 */
export function useCMWTokenState(targetAddress?: Address) {
  const { address: contractAddress, abi } = useCMWTokenContract();
  const { address: userAddress } = useAccount();
  const accountToCheck = targetAddress || userAddress;

  const results = useReadContracts({
    contracts: [
      // Basic Info
      { address: contractAddress, abi, functionName: "name" },
      { address: contractAddress, abi, functionName: "symbol" },
      { address: contractAddress, abi, functionName: "totalSupply" },
      { address: contractAddress, abi, functionName: "MAX_SUPPLY" },
      { address: contractAddress, abi, functionName: "owner" },
      // Emission Info
      { address: contractAddress, abi, functionName: "emissionRatePerMinute" },
      { address: contractAddress, abi, functionName: "lastEmissionTimestamp" },
      { address: contractAddress, abi, functionName: "totalEmitted" },
      { address: contractAddress, abi, functionName: "getPendingEmission" },
      { address: contractAddress, abi, functionName: "getDailyEmission" },
      // User Info
      {
        address: contractAddress,
        abi,
        functionName: "balanceOf",
        args: accountToCheck ? [accountToCheck] : undefined,
      },
      // Role Checks (Optional, assuming role constants are public or we check against known roles if needed,
      // strictly ABI might not expose role bytes getter typically, but doc says 'REWARD_CONTRACT_ROLE()'.
      // We will try to read role hashes if they are exposed as public constants)
      { address: contractAddress, abi, functionName: "REWARD_CONTRACT_ROLE" },
      { address: contractAddress, abi, functionName: "DISTRIBUTOR_ROLE" },
    ],
    query: {
      enabled: !!contractAddress,
      refetchInterval: 10000,
    },
  });

  const isLoading = results.isLoading;
  const data = results.data;

  // We need role hashes first to check hasRole.
  // Since useReadContracts runs parallel, we can't depend on result 11/12 for result 13/14 in same call easily
  // without separate hooks or assumptions.
  // However, often roles are constants.
  // Let's return basic data first. Role checking might need a separate effect or just check Owner.

  if (isLoading || !data) return { isLoading: true };

  const [
    name,
    symbol,
    totalSupply,
    maxSupply,
    owner,
    emissionRate,
    lastEmission,
    totalEmitted,
    pendingEmission,
    dailyEmission,
    balance,
    rewardRoleHash,
    distributorRoleHash,
  ] = data;

  return {
    isLoading: false,
    token: {
      name: name.result,
      symbol: symbol.result,
      totalSupply: totalSupply.result ? formatEther(totalSupply.result) : "0",
      maxSupply: maxSupply.result ? formatEther(maxSupply.result) : "0",
      owner: owner.result,
    },
    emission: {
      ratePerMinute: emissionRate.result ? formatEther(emissionRate.result) : "0",
      lastTimestamp: toNumber(lastEmission.result),
      totalEmitted: totalEmitted.result ? formatEther(totalEmitted.result) : "0",
      pending: pendingEmission.result ? formatEther(pendingEmission.result) : "0",
      daily: dailyEmission.result ? formatEther(dailyEmission.result) : "0",
    },
    user: {
      balance: balance.result ? formatEther(balance.result) : "0",
      address: accountToCheck,
    },
    roles: {
      checkIds: {
        reward: rewardRoleHash.result,
        distributor: distributorRoleHash.result,
      },
    },
  };
}

/**
 * Check if a user has specific roles
 * Separated because it depends on role hashes
 */
export function useCMWRoles(userAddress?: Address) {
  const { address: contractAddress, abi } = useCMWTokenContract();

  // First get role hashes
  const { data: roleHashes } = useReadContracts({
    contracts: [
      { address: contractAddress, abi, functionName: "REWARD_CONTRACT_ROLE" },
      { address: contractAddress, abi, functionName: "DISTRIBUTOR_ROLE" },
      { address: contractAddress, abi, functionName: "DEFAULT_ADMIN_ROLE" }, // Owner usually has default admin
    ],
    query: { enabled: !!contractAddress },
  });

  const rewardRole = roleHashes?.[0]?.result;
  const distributorRole = roleHashes?.[1]?.result;
  const adminRole = roleHashes?.[2]?.result;

  // Then check if user has them
  const { data: roleStatus } = useReadContracts({
    contracts: [
      {
        address: contractAddress,
        abi,
        functionName: "hasRole",
        args: rewardRole && userAddress ? [rewardRole, userAddress] : undefined,
      },
      {
        address: contractAddress,
        abi,
        functionName: "hasRole",
        args: distributorRole && userAddress ? [distributorRole, userAddress] : undefined,
      },
      {
        address: contractAddress,
        abi,
        functionName: "hasRole",
        args: adminRole && userAddress ? [adminRole, userAddress] : undefined,
      },
    ],
    query: { enabled: !!(contractAddress && userAddress && rewardRole) },
  });

  return {
    hasRewardRole: !!roleStatus?.[0]?.result,
    hasDistributorRole: !!roleStatus?.[1]?.result,
    isAdmin: !!roleStatus?.[2]?.result,
    isLoading: !roleStatus,
  };
}

// --- Writes ---

export function useCMWTokenActions() {
  const { address: contractAddress, abi } = useCMWTokenContract();
  const { writeContractAsync, isPending, error } = useWriteContract();
  const [hash, setHash] = useState<Address>();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // 2.6 Trigger Token Emission
  const emitTokens = async () => {
    if (!contractAddress) throw new Error("Contract not found");
    const txHash = await writeContractAsync({
      address: contractAddress,
      abi,
      functionName: "emitTokens",
    });
    setHash(txHash);
    return txHash;
  };

  // 2.9 Distribute Reward
  const distributeReward = async (userAddress: Address, amountEther: string) => {
    if (!contractAddress) throw new Error("Contract not found");
    const txHash = await writeContractAsync({
      address: contractAddress,
      abi,
      functionName: "distributeReward",
      args: [userAddress, BigInt(parseEther(amountEther))], // Wait, parseEther import needed? Yes.
    });
    setHash(txHash);
    return txHash;
  };

  // 2.7 Update Emission Rate
  const updateEmissionRate = async (newRateEther: string) => {
    if (!contractAddress) throw new Error("Contract not found");
    const txHash = await writeContractAsync({
      address: contractAddress,
      abi,
      functionName: "updateEmissionRate",
      args: [BigInt(parseEther(newRateEther))],
    });
    setHash(txHash);
    return txHash;
  };

  // Emergency Pause
  const emergencyPauseEmission = async () => {
    if (!contractAddress) throw new Error("Contract not found");
    const txHash = await writeContractAsync({
      address: contractAddress,
      abi,
      functionName: "emergencyPauseEmission",
    });
    setHash(txHash);
    return txHash;
  };

  // Resume Emission
  const resumeEmission = async (newRateEther: string) => {
    if (!contractAddress) throw new Error("Contract not found");
    const txHash = await writeContractAsync({
      address: contractAddress,
      abi,
      functionName: "resumeEmission",
      args: [BigInt(parseEther(newRateEther))],
    });
    setHash(txHash);
    return txHash;
  };

  return {
    emitTokens,
    distributeReward,
    updateEmissionRate,
    emergencyPauseEmission,
    resumeEmission,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}

// End of file
