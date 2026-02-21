import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useWatchContractEvent,
  usePublicClient,
} from "wagmi";
import { useMWNFTContract } from "@/lib/contracts";
import { toast } from "sonner";
import React, { useMemo } from "react";
import { type Address, parseEther, formatEther } from "viem";
import { toNumber } from "@/lib/utils/bigint-helpers";

// --- Constants ---
const TIER_THRESHOLDS = {
  FREE: 200n,
  TIER1: 2000n,
  TIER2: 10000n,
};

const PRICES = {
  FREE: 0n,
  TIER1: parseEther("0.01"),
  TIER2: parseEther("0.1"),
};

// --- Reads: Comprehensive State ---

export function useMWNFTBalance(address?: Address) {
  const { address: contractAddress, abi } = useMWNFTContract();
  return useReadContract({
    address: contractAddress,
    abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useMWNFTState(targetAddress?: Address) {
  const { address: contractAddress, abi } = useMWNFTContract();
  const { address: userAddress } = useAccount();

  // Prefer targetAddress if provided, otherwise fallback to connected user
  const accountToCheck = targetAddress || userAddress;

  const results = useReadContracts({
    contracts: [
      { address: contractAddress, abi, functionName: "getCurrentMintTierInfo" },
      { address: contractAddress, abi, functionName: "publicMintEnabled" },
      { address: contractAddress, abi, functionName: "MAX_PER_WALLET" },
      { address: contractAddress, abi, functionName: "totalSupply" },
      { address: contractAddress, abi, functionName: "MAX_SUPPLY" },
      { address: contractAddress, abi, functionName: "remainingSupply" },
      { address: contractAddress, abi, functionName: "FREE_MINT_SUPPLY" },
      { address: contractAddress, abi, functionName: "finalTierMintEnabled" },
      { address: contractAddress, abi, functionName: "finalTierMintPrice" },
      // User specific
      {
        address: contractAddress,
        abi,
        functionName: "mintedPerWallet",
        args: accountToCheck ? [accountToCheck] : undefined,
      },
      {
        address: contractAddress,
        abi,
        functionName: "balanceOf",
        args: accountToCheck ? [accountToCheck] : undefined,
      },
    ],
    query: {
      enabled: !!contractAddress,
      refetchInterval: 10000, // Refresh every 10s
    },
  });

  const isLoading = results.isLoading;
  const data = results.data;

  if (isLoading || !data) return { isLoading: true };

  const [
    tierInfo,
    publicMintEnabled,
    maxPerWallet,
    totalSupply,
    maxSupply,
    remainingSupply,
    freeMintSupply,
    finalTierEnabled,
    finalTierPrice,
    mintedByUser,
    balance,
  ] = data;

  return {
    isLoading: false,
    global: {
      currentTierName: tierInfo.result?.[0],
      currentPrice: tierInfo.result?.[1],
      isPublicMintEnabled: publicMintEnabled.result,
      maxPerWallet: toNumber(maxPerWallet.result),
      totalSupply: toNumber(totalSupply.result),
      maxSupply: toNumber(maxSupply.result),
      remainingSupply: toNumber(remainingSupply.result),
      freeMintSupply: toNumber(freeMintSupply.result),
      finalTierEnabled: finalTierEnabled.result,
      finalTierPrice: finalTierPrice.result,
    },
    user: {
      minted: toNumber(mintedByUser.result),
      balance: toNumber(balance.result),
      remainingMintQuota: toNumber(maxPerWallet.result) - toNumber(mintedByUser.result),
    },
  };
}

// --- Helper: Cost Calculation ---

export function useMWNFTCostCalculator() {
  const { address: contractAddress, abi } = useMWNFTContract();

  // We need current supply and final tier price to calculate
  const { data: supplyData } = useReadContract({
    address: contractAddress,
    abi,
    functionName: "totalSupply", // Strictly speaking should use _tokenIdCounter equivalent if available, but totalSupply is close enough for sequential mints?
    // Note: The doc uses _tokenIdCounter(). If that's private in ABI but public in doc, we assume totalSupply ~ currentTokenId for now unless ABI has tokenIdCounter.
    // ABI has `totalSupply` which in ERC721Enumerable is total active tokens.
    // If tokens are burned, totalSupply < nextTokenId.
    // Doc says `_tokenIdCounter` is external view. Let's check ABI.
    // ABI provided earlier does NOT have _tokenIdCounter. It has totalSupply.
    // We will fallback to totalSupply, assuming no burns or strictly sequential.
  });

  const { data: finalPriceData } = useReadContract({
    address: contractAddress,
    abi,
    functionName: "finalTierMintPrice",
  });

  const calculateCost = (amount: number, currentSupply: bigint = 0n, finalPrice: bigint = 0n) => {
    let totalCost = 0n;
    const currentId = currentSupply + 1n; // Next ID to be minted

    for (let i = 0; i < amount; i++) {
      const tokenId = currentId + BigInt(i);

      if (tokenId <= TIER_THRESHOLDS.FREE) {
        totalCost += PRICES.FREE;
      } else if (tokenId <= TIER_THRESHOLDS.TIER1) {
        totalCost += PRICES.TIER1;
      } else if (tokenId <= TIER_THRESHOLDS.TIER2) {
        totalCost += PRICES.TIER2;
      } else {
        totalCost += finalPrice;
      }
    }
    return { wei: totalCost, bnb: formatEther(totalCost) };
  };

  return {
    // Expose a function that takes amount and uses current loaded data
    calculate: (amount: number) => {
      const supply = supplyData ? supplyData : 0n; // fallback
      const finalPrice = finalPriceData ? finalPriceData : 0n;
      return calculateCost(amount, supply, finalPrice);
    },
  };
}

// --- Writes: Unified Mint Hook ---

export function useMintMWNFT() {
  const { address: contractAddress, abi } = useMWNFTContract();
  const { writeContractAsync, isPending, error } = useWriteContract();
  const [hash, setHash] = React.useState<Address>(); // Using Address type for hash string (compatible)

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  /**
   * Universal Mint Function
   * @param amount Quantity to mint
   * @param priceWei Total price in WEI (calculated via useMWNFTCostCalculator)
   * @param referrerTokenId Optional referrer ID (0 for none)
   * @param validationOptions Optional state for pre-flight checks { global, user }
   */
  const mint = async (
    amount: number,
    priceWei: bigint,
    referrerTokenId: number = 0,
    validationOptions?: { global: any; user: any }
  ) => {
    if (!contractAddress) throw new Error("Contract not found");

    // Pre-flight checks if validation data provided
    if (validationOptions) {
      const { global, user } = validationOptions;

      // Skip checks if data invalid (e.g. still loading), caller should handle loading state
      if (global && user) {
        if (!global.isPublicMintEnabled) {
          // [DEBUG] Bypass for local dev testing if needed
          // console.warn("Public Mint Disabled (Bypassed Check)");
          throw new Error("当前未开启 Public Mint");
        }
        if (user.remainingMintQuota < amount) throw new Error("您的铸造配额已用完");
        if (global.remainingSupply < amount) throw new Error("NFT 已售罄");
      }
    }

    let txHash: `0x${string}`;

    if (referrerTokenId > 0) {
      txHash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: "mintWithReferrer",
        args: [BigInt(amount), BigInt(referrerTokenId)],
        value: priceWei,
      });
    } else {
      txHash = await writeContractAsync({
        address: contractAddress,
        abi,
        functionName: "mint",
        args: [BigInt(amount)],
        value: priceWei,
      });
    }

    setHash(txHash);
    return txHash;
  };

  return { mint, isPending, isConfirming, isSuccess, hash, error };
}

export function useApproveMWNFT() {
  const { address: contractAddress, abi } = useMWNFTContract();
  const { writeContractAsync, isPending } = useWriteContract();
  const [hash, setHash] = React.useState<Address>();

  const approve = async (to: Address, tokenId: bigint) => {
    if (!contractAddress) throw new Error("Contract not found");
    const txHash = await writeContractAsync({
      address: contractAddress,
      abi,
      functionName: "approve",
      args: [to, tokenId],
    });
    setHash(txHash);
    return txHash;
  };

  return { approve, isPending, hash };
}

// --- Event Watching: Mint Events ---

/**
 * Watch for NFT mint events for the current user
 * Listens to Transfer events where from = 0x0 (mint) and to = user address
 */
export function useWatchMWNFTMint(onMint?: () => void) {
  const { address: contractAddress, abi } = useMWNFTContract();
  const { address: userAddress } = useAccount();

  useWatchContractEvent({
    address: contractAddress,
    abi,
    eventName: "Transfer",
    onLogs: (logs) => {
      if (!userAddress) return;

      // Filter for mint events (from = 0x0) to current user
      const userMintLogs = logs.filter((log) => {
        const { from, to } = log.args as { from?: Address; to?: Address; tokenId?: bigint };
        return (
          from === "0x0000000000000000000000000000000000000000" &&
          to?.toLowerCase() === userAddress.toLowerCase()
        );
      });

      if (userMintLogs.length > 0 && onMint) {
        onMint();
      }
    },
  });
}

// --- User NFT List Query ---

/**
 * 查询用户持有的所有 NFT（优化版）
 * 
 * 优化：
 * 1. 只需 2 次 RPC 调用（无论持有多少 NFT）
 * 2. 使用 IPFS_CID 获取所有 NFT 的 IPFS CID（无参数，不会报错）
 * 
 * 性能：
 * - 持有 10 个 NFT：2 次 RPC，约 1 秒
 * - 持有 100 个 NFT：2 次 RPC，约 1-2 秒
 * - 持有 500 个 NFT：2 次 RPC，约 3-5 秒
 */
export function useUserNFTs(userAddress?: Address, refreshKey?: number) {
  const { address: contractAddress, abi } = useMWNFTContract();
  const publicClient = usePublicClient();
  const [nfts, setNfts] = React.useState<Array<{ tokenId: string; tokenIdBigInt: bigint; ipfsURL?: string }>>([]);
  const [balance, setBalance] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!userAddress || !publicClient || !contractAddress) {
      setNfts([]);
      setBalance(0);
      return;
    }

    const fetchNFTs = async () => {
      setIsLoading(true);
      try {
        // 第 1 次 RPC：获取 balance + IPFS_CID
        const [balanceResult, ipfsCIDResult] = await publicClient.multicall({
          contracts: [
            {
              address: contractAddress,
              abi,
              functionName: "balanceOf",
              args: [userAddress],
            },
            {
              address: contractAddress,
              abi,
              functionName: "IPFS_CID", // 查询 IPFS CID
            },
          ],
        });

        const count = Number(balanceResult.result || 0n);
        setBalance(count);

        // 如果用户没有 NFT，直接返回
        if (count === 0) {
          setNfts([]);
          setIsLoading(false);
          return;
        }

        // 获取 IPFS CID 并拼接为完整 URL
        const ipfsURL = ipfsCIDResult.result ? `https://ipfs.io/ipfs/${ipfsCIDResult.result}` : "";

        // 第 2 次 RPC：批量获取所有 Token ID
        const tokenIdResults = await publicClient.multicall({
          contracts: Array.from({ length: count }, (_, i): any => ({
            address: contractAddress,
            abi,
            functionName: "tokenOfOwnerByIndex" as const,
            args: [userAddress, BigInt(i)] as const,
          })),
        });

        const tokenIds = tokenIdResults
          .map((r: any) => r.result as bigint | undefined)
          .filter((id: any): id is bigint => id !== undefined);

        if (tokenIds.length === 0) {
          setNfts([]);
          setIsLoading(false);
          return;
        }

        // 组合结果（所有 NFT 使用相同的 IPFS URL）
        const nftList = tokenIds.map((tokenId: bigint) => ({
          tokenId: tokenId.toString(),
          tokenIdBigInt: tokenId,
          ipfsURL: ipfsURL,
        }));

        setNfts(nftList);
      } catch (error) {
        console.error("Failed to fetch NFTs:", error);
        setNfts([]);
        setBalance(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFTs();
  }, [userAddress, publicClient, contractAddress, abi, refreshKey]);

  return {
    balance,
    nfts,
    isLoading,
  };
}
