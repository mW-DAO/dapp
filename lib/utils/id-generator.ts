import { db } from "@/lib/db";

/**
 * 生成唯一的6位用户ID
 * 格式: 100000 - 999999
 */
export async function generateUniqueUserId(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // 生成6位随机数字
    const userId = Math.floor(100000 + Math.random() * 900000).toString();

    // 检查是否已存在
    const existing = await db.user.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!existing) {
      return userId;
    }

    attempts++;
  }

  throw new Error("Failed to generate unique userId after multiple attempts");
}

/**
 * 生成唯一的邀请码
 * 格式: 8位大写字母+数字组合
 */
export async function generateUniqueInviteCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // 生成8位随机字符串 (大写字母+数字)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let inviteCode = "";
    for (let i = 0; i < 8; i++) {
      inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // 检查是否已存在
    const existing = await db.user.findFirst({
      where: { inviteCode },
      select: { id: true },
    });

    if (!existing) {
      return inviteCode;
    }

    attempts++;
  }

  throw new Error("Failed to generate unique invite code after multiple attempts");
}
