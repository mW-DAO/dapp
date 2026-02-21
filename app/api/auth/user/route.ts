import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { success, unauthorized } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const searchParams = req.nextUrl.searchParams;
  const targetId = searchParams.get("id");

  try {
    let user;

    if (targetId) {
      // 访问他人主页（或通过 ID 访问自己）
      user = await db.user.findFirst({
        where: {
          OR: [{ id: targetId }, { userId: targetId }],
        },
        include: {
          _count: {
            select: {
              followers: true,
              following: true,
              createdNodes: true,
              joinedNodes: {
                where: {
                  role: { not: "OWNER" },
                },
              },
              articles: true,
            },
          },
        },
      });
    } else if (session) {
      // 访问自己的 Session 资料
      const normalizedAddress = session.address.toLowerCase();
      user = await db.user.findUnique({
        where: { address: normalizedAddress },
        include: {
          _count: {
            select: {
              followers: true,
              following: true,
              createdNodes: true,
              joinedNodes: {
                where: {
                  role: { not: "OWNER" },
                },
              },
              articles: true,
            },
          },
        },
      });
    }

    if (!user) {
      return unauthorized("User not found");
    }

    // 格式化返回数据
    return success({
      id: user.id,
      userId: user.userId,
      address: user.address,
      username: user.userName,
      avatar: user.avatarUrl || "",
      bio: user.userBio || "",
      role: user.role,
      status: user.status,
      followingCount: user._count.following,
      followersCount: user._count.followers,
      nodeCount: user._count.createdNodes,
      joinedNodeCount: user._count.joinedNodes,
      articleCount: user._count.articles,
      // 模拟一些其他数据（目前数据库库中没有的字段）
      cmwBalance: "0",
      nftCount: 0,
      minerRevenue: (
        await db.userActionRecord.aggregate({
          _sum: { earnedCMW: true },
          where: { userId: user.id, status: "CONFIRMED" },
        })
      )._sum.earnedCMW?.toString() || "0",
    });
  } catch (error) {
    console.error("[User API] Error:", error);
    return unauthorized("Failed to fetch user data");
  }
}
