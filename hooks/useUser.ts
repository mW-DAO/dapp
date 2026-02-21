"use client";

import { useQuery } from "@tanstack/react-query";
import { User } from "@/types/user";
import { useAppKitAccount } from "@reown/appkit/react";

export function useUser(options?: { staleTime?: number }) {
  const { isConnected: isWalletConnected, address: walletAddress } = useAppKitAccount();

  const {
    data: user,
    isLoading,
    refetch,
    isError,
  } = useQuery<User | null>({
    queryKey: ["user", "me"],
    queryFn: async () => {
      try {
        console.log("[useUser] Checking session...");
        const res = await fetch("/api/auth/user", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        const data = await res.json();

        if (data.code === 200 && data.data) {
          console.log("[useUser] Session found:", data.data.userId);
          return data.data;
        }
        return null;
      } catch (error) {
        console.error("[useUser] Session check error:", error);
        return null;
      }
    },
    staleTime: options?.staleTime ?? 1000 * 60, // 默认 1 分钟新鲜度
    retry: false,
  });

  const isLoggedIn = !!user;

  return {
    user: user || null,
    isLoading,
    isLoggedIn,
    refetch,
    isError,
    walletAddress,
    isWalletConnected: !!walletAddress && isWalletConnected,
  };
}
