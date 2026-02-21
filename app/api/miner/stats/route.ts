import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { success, unauthorized } from "@/lib/api/response";
import { formatEther } from "viem";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return unauthorized("Login required");
  }

  // Fetch full user from DB using address from session
  const user = await db.user.findUnique({
    where: { address: session.address },
  });

  if (!user) {
    return unauthorized("User not found");
  }

  const userId = user.id;

  try {
    // A. Created Super Nodes (Earnings from Others' interactions -> Passive Actions)
    const createdSuperStats = await db.userActionRecord.groupBy({
      by: ["action"],
      _sum: {
        earnedCMW: true,
      },
      where: {
        userId: userId,
        status: "CONFIRMED",
        action: { in: ["VIEWED", "LIKED", "COMMENTED", "SHARED"] },
        node: {
          type: "SUPER", // Cast handled by previous edit
          creatorId: userId,
        } as any,
      },
    });

    // B. Joined Super Nodes (Earnings from My interactions -> Active Actions)
    const joinedSuperStats = await db.userActionRecord.groupBy({
      by: ["action"],
      _sum: {
        earnedCMW: true,
      },
      where: {
        userId: userId,
        status: "CONFIRMED",
        action: { in: ["VIEW", "LIKE", "COMMENT", "SHARE"] },
        node: {
          type: "SUPER",
          creatorId: { not: userId },
        } as any,
      },
    });

    // C. Normal Nodes (Earnings from My interactions -> Active Actions)
    const normalStats = await db.userActionRecord.groupBy({
      by: ["action"],
      _sum: {
        earnedCMW: true,
      },
      where: {
        userId: userId,
        status: "CONFIRMED",
        // Assumption: Normal node mining is primarily active participation
        action: { in: ["VIEW", "LIKE", "COMMENT", "SHARE"] },
        node: {
          type: "NORMAL",
        } as any,
      },
    });

    // Helper to format stats
    const formatStats = (stats: typeof createdSuperStats) => {
      let totalWei = 0n;
      const breakdown: Record<string, string> = {};

      stats.forEach((item) => {
        // Safe access to _sum which might be null
        const val = item._sum?.earnedCMW || 0n;
        totalWei += val;
        breakdown[item.action] = formatEther(val);
      });

      return {
        total: formatEther(totalWei),
        breakdown,
      };
    };

    return success({
      createdSuper: formatStats(createdSuperStats),
      joinedSuper: formatStats(joinedSuperStats),
      normal: formatStats(normalStats),
    });

  } catch (error) {
    console.error("[MinerStats] Error:", error);
    return unauthorized("Failed to fetch miner stats");
  }
}
