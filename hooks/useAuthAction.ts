"use client";

import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useCallback, useState } from "react";
import { useSignMessage } from "wagmi";
import { createSiweMessage } from "@/lib/auth/siwe";
import { DEFAULT_CHAIN_ID } from "@/lib/contracts/addresses";
import axios from "axios";

export function useAuthAction() {
  const { open } = useAppKit();
  const { isConnected, address } = useAppKitAccount();
  const { signMessageAsync } = useSignMessage();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Helper to check if user needs to login
  const checkSession = async () => {
    try {
      const { data } = await axios.get("/api/auth/user");
      return data.authenticated;
    } catch {
      return false;
    }
  };

  const login = async () => {
    if (!address) return false;

    setIsSigningIn(true);
    try {
      // 1. Get Nonce
      const {
        data: { nonce },
      } = await axios.get("/api/auth/nonce");

      // 2. Create Message
      // 使用项目配置的默认链 ID,确保与 EIP-712 签名一致
      const message = createSiweMessage(address, DEFAULT_CHAIN_ID, nonce);
      const messageText = message.prepareMessage();

      // 3. Sign
      const signature = await signMessageAsync({ message: messageText });

      // 4. Verify & Login
      await axios.post("/api/auth/login", { message: messageText, signature });
      return true;
    } catch (e) {
      console.error("Login failed", e);
      return false;
    } finally {
      setIsSigningIn(false);
    }
  };

  const runWithAuth = useCallback(
    async (action: () => void | Promise<void>) => {
      if (!isConnected) {
        open({ view: "Connect" });
        return;
      }

      // Check if already authenticated on server
      const isAuthenticated = await checkSession();
      if (isAuthenticated) {
        await action();
        return;
      }

      // Not authenticated, trigger SIWE
      const success = await login();
      if (success) {
        await action();
      }
    },
    [isConnected, address, open, signMessageAsync]
  );

  return { runWithAuth, isConnected, isSigningIn };
}
