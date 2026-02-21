import { NextRequest } from "next/server";
import { SiweMessage } from "siwe";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { generateUniqueUserId, generateUniqueInviteCode } from "@/lib/utils/id-generator";
import { success, unauthorized, unprocessable } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const { message, signature } = await req.json();

    const siweMessage = new SiweMessage(message);
    const { data: fields } = await siweMessage.verify({ signature });

    const cookieStore = await req.cookies;
    const storedNonce = cookieStore.get("siwe_nonce")?.value;

    if (storedNonce !== fields.nonce) {
      return unprocessable("Invalid nonce");
    }

    const normalizedAddress = fields.address.toLowerCase();

    const existingUser = await db.user.findUnique({
      where: { address: normalizedAddress },
    });

    let isNewUser = false;

    if (!existingUser) {
      isNewUser = true;
      const [userId, inviteCode] = await Promise.all([
        generateUniqueUserId(),
        generateUniqueInviteCode(),
      ]);

      await db.user.create({
        data: {
          userId: `mw_${userId}`,
          address: normalizedAddress,
          inviteCode,
          userName: `用户${normalizedAddress.slice(-6)}`,
        },
      });
    } else {
      // 检查用户是否被封禁
      if (existingUser.status === "BANNED") {
        return unauthorized(
          existingUser.bannedReason 
            ? `账号已被封禁：${existingUser.bannedReason}` 
            : "账号已被封禁，请联系管理员"
        );
      }
    }

    await createSession(normalizedAddress);

    const user = await db.user.findUnique({
      where: { address: normalizedAddress },
      include: {
        _count: {
          select: {
            followers: true,
            following: true,
            createdNodes: true,
            articles: true,
          },
        },
      },
    });

    if (!user) {
      return unauthorized("User created but not found");
    }

    return success(
      {
        address: fields.address,
        isNewUser,
        user: {
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
          articleCount: user._count.articles,
          cmwBalance: "15000000",
          nftCount: 1,
          minerRevenue: "109800",
        },
      },
      "Login successful"
    );
  } catch (error) {
    console.error("[Login API] Error:", error);
    return unauthorized("Invalid signature");
  }
}
