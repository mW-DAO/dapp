import { db } from "@/lib/db";
import { UserRole, UserStatus } from "@prisma/client";

/**
 * 检查用户是否为管理员
 */
export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * 检查用户是否为超级管理员
 */
export function isSuperAdmin(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

/**
 * 检查用户状态是否正常
 */
export function isActive(status: UserStatus): boolean {
  return status === "ACTIVE";
}

/**
 * 检查用户是否有管理员权限且状态正常
 */
export function canAccessAdminPanel(role: UserRole, status: UserStatus): boolean {
  return isAdmin(role) && isActive(status);
}

/**
 * 根据地址获取用户并检查状态
 * @throws Error 如果用户不存在或被封禁
 */
export async function getUserAndCheckStatus(address: string) {
  const user = await db.user.findUnique({
    where: { address: address.toLowerCase() },
  });

  if (!user) {
    throw new Error("用户不存在");
  }

  if (user.status === "BANNED") {
    throw new Error(
      user.bannedReason 
        ? `账号已被封禁：${user.bannedReason}` 
        : "账号已被封禁，请联系管理员"
    );
  }

  return user;
}

/**
 * 检查用户是否有管理员权限
 * @throws Error 如果用户不存在、被封禁或权限不足
 */
export async function requireAdmin(address: string) {
  const user = await getUserAndCheckStatus(address);

  if (!isAdmin(user.role)) {
    throw new Error("权限不足，需要管理员权限");
  }

  return user;
}

/**
 * 检查用户是否有超级管理员权限
 * @throws Error 如果用户不存在、被封禁或权限不足
 */
export async function requireSuperAdmin(address: string) {
  const user = await getUserAndCheckStatus(address);

  if (!isSuperAdmin(user.role)) {
    throw new Error("权限不足，需要超级管理员权限");
  }

  return user;
}

/**
 * 检查用户是否可以执行某个操作
 * 用于需要用户登录且状态正常的接口
 */
export async function requireActiveUser(address: string) {
  return await getUserAndCheckStatus(address);
}
