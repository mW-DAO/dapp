import { verifyTypedData, Hex } from 'viem';

import { siteConfig } from "@/config/site";
import { DEFAULT_CHAIN_ID } from "@/lib/contracts/addresses";

export const DOMAIN_NAME = siteConfig.name;
export const DOMAIN_VERSION = siteConfig.version;

// 通用操作类型结构
// 前端签名时必须使用完全一致的结构
export const ACTION_TYPES = {
  Action: [
    { name: 'action', type: 'string' },   // 操作类型: "UP", "DOWN", "COMMENT"
    { name: 'targetId', type: 'string' }, // 目标ID: ArticleId, etc.
    { name: 'nonce', type: 'string' },    // 后端生成的唯一随机串
    { name: 'deadline', type: 'uint256' }, // 有效期时间戳 (秒)
  ],
} as const;

export async function verifyActionSignature({
  userAddress,
  action,
  targetId,
  nonce,
  deadline,
  signature,
  chainId,
}: {
  userAddress: string;
  action: string;
  targetId: string;
  nonce: string;
  deadline: number;
  signature: string;
  chainId?: number;
}) {
  const activeChainId = chainId || DEFAULT_CHAIN_ID;
  // 校验当前时间是否超过 Deadline (虽然数据库层面也有检查，这里双重保险)
  const now = Math.floor(Date.now() / 1000);
  if (now > deadline) {
    return false;
  }

  try {
    const valid = await verifyTypedData({
      address: userAddress as Hex,
      domain: {
        name: DOMAIN_NAME,
        version: DOMAIN_VERSION,
        chainId: activeChainId,
      },
      types: ACTION_TYPES,
      primaryType: 'Action',
      message: {
        action,
        targetId,
        nonce,
        deadline: BigInt(deadline),
      },
      signature: signature as Hex,
    });

    return valid;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}
