import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { success, unauthorized, apiError } from "@/lib/api/response";
import { followUser, unfollowUser } from "@/lib/user/follow";
import { requireActiveUser } from "@/lib/auth/permissions";

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return unauthorized("Not authenticated");
  }

  try {
    const body = await req.json();
    const { followingId, action } = body;

    if (!followingId) {
      return apiError("Following ID is required", 400);
    }

    // 检查用户状态并获取 ID
    const user = await requireActiveUser(session.address);
    const userId = user.id;

    if (action === "follow") {
      await followUser(userId, followingId);
    } else if (action === "unfollow") {
      await unfollowUser(userId, followingId);
    } else {
      return apiError("Invalid action", 400);
    }

    return success({ action, followingId });
  } catch (err: any) {
    console.error("[Follow API] Error:", err);
    // 处理 Prisma 唯一约束冲突（已关注）
    if (err.code === "P2002") {
      return apiError("Already following", 400);
    }
    return apiError(err.message || "Failed to update follow status", 500);
  }
}
