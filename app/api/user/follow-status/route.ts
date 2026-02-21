import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { success, unauthorized } from "@/lib/api/response";
import { isFollowing } from "@/lib/user/follow";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const followingId = req.nextUrl.searchParams.get("followingId");

  if (!followingId) {
    return success({ isFollowing: false });
  }

  if (!session) {
    return success({ isFollowing: false });
  }

  try {
    const currentUser = await db.user.findUnique({
      where: { address: session.address },
      select: { id: true },
    });

    if (!currentUser) {
      return success({ isFollowing: false });
    }

    const following = await isFollowing(currentUser.id, followingId);
    return success({ isFollowing: following });
  } catch (err) {
    console.error("[Follow Status API] Error:", err);
    return success({ isFollowing: false });
  }
}
