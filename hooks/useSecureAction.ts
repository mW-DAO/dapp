import { useSignTypedData } from 'wagmi';
import { useCallback } from 'react';

import { DOMAIN_NAME, DOMAIN_VERSION, ACTION_TYPES } from '@/lib/auth/eip712';
import { DEFAULT_CHAIN_ID } from '@/lib/contracts/addresses';

export function useSecureAction() {
  const { mutateAsync: signTypedDataAsync } = useSignTypedData();

  const performSecureAction = useCallback(async (
    action: string, // "UP" | "DOWN"
    targetId: string,
    turnstileToken: string
  ) => {
    try {
      // 1. 请求 Nonce
      // 需要携带 Turnstile Token 证明是真人
      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetId, turnstileToken }),
      });

      if (!nonceRes.ok) {
        let errorMessage = 'Failed to get nonce';
        try {
          const contentType = nonceRes.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const err = await nonceRes.json();
            errorMessage = err.message || errorMessage;
          } else {
             errorMessage = await nonceRes.text() || errorMessage;
          }
        } catch (e) {
          // ignore parsing error
        }
        throw new Error(errorMessage);
      }

      const { data } = await nonceRes.json();
      const { nonce, deadline } = data;

      // 2. 钱包签名 (EIP-712)
      // 用户会在钱包看到清晰的操作意图，而不是乱码
      const signature = await signTypedDataAsync({
        domain: {
          name: DOMAIN_NAME,
          version: DOMAIN_VERSION,
          chainId: DEFAULT_CHAIN_ID,
        },
        types: ACTION_TYPES,
        primaryType: 'Action',
        message: {
          action,
          targetId,
          nonce,
          deadline: BigInt(deadline),
        },
      });

      return { signature, nonce };
    } catch (error) {
      console.error("Secure action failed:", error);
      throw error;
    }
  }, [signTypedDataAsync]);

  return { performSecureAction };
}
