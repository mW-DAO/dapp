import { useEffect, useRef } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useSignMessage, useDisconnect } from "wagmi";
import { SiweMessage } from "siwe";
import { useQueryClient } from "@tanstack/react-query";

import { useUser } from "@/hooks/useUser";

/**
 * SIWE 登录 Hook
 * 在钱包连接后自动触发 SIWE 签名和后端登录
 */
export function useSiweAuth() {
  const { address, isConnected } = useAppKitAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const queryClient = useQueryClient();
  const { user, isLoading, isLoggedIn } = useUser();
  const isPerformingLogin = useRef(false);

  useEffect(() => {
    // 只有在：已连接钱包、地址存在、当前未显示登录、且未在请求中 时，才触发登录
    if (!isConnected || !address || isLoading || isLoggedIn || isPerformingLogin.current) {
      return;
    }

    const performSiweLogin = async () => {
      isPerformingLogin.current = true;
      try {
        console.log("[SIWE] Starting login process for", address);
        // 1. 获取 nonce
        const nonceRes = await fetch("/api/auth/nonce");
        const { nonce } = await nonceRes.json();

        // 2. 创建 SIWE 消息
        const message = new SiweMessage({
          domain: window.location.host,
          address,
          statement: "Sign in to m&W DAO",
          uri: window.location.origin,
          version: "1",
          chainId: 56, // BSC Mainnet
          nonce,
        });

        const messageStr = message.prepareMessage();

        // 3. 请求用户签名
        const signature = await signMessageAsync({ message: messageStr });

        // 4. 发送到后端验证并创建用户
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageStr,
            signature,
          }),
        });

        const result = await loginRes.json();

        if (result.code === 200 && result.data.user) {
          console.log("[SIWE] Login successful, injecting user into cache 'me':", result.data.user);

          // 瞬间更新缓存
          queryClient.setQueryData(["user", "me"], result.data.user);

          // 强制触发一次失效刷新，确保所有观察者更新
          await queryClient.invalidateQueries({ queryKey: ["user", "me"] });
          console.log("[SIWE] Cache invalidated and updated.");
        } else {
          console.error("[SIWE] Login failed:", result.message);
        }
      } catch (error: any) {
        console.error("[SIWE] Login error:", error);
        // Handle User Rejected Request
        if (error.code === 4001 || error.cause?.code === 4001 || error.message?.includes("User rejected") || error.name === "UserRejectedRequestError") {
             console.warn("[SIWE] User rejected signature. Disconnecting wallet to reset state.");
             // Optional: Show toast "Login cancelled"
             // Disconnect wallet to prevent infinite retries or broken state
             // We need to import disconnect first.
             disconnect();
        }
      } finally {
        isPerformingLogin.current = false;
      }
    };

    performSiweLogin();
  }, [isConnected, address, signMessageAsync, isLoading, isLoggedIn, queryClient]);

  return { isConnected, address };
}
