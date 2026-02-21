import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { success } from "@/lib/api/response";
import { isMember } from "@/lib/node/member";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const nodeId = req.nextUrl.searchParams.get("nodeId");

  if (!nodeId) {
    return success({ isMember: false });
  }

  if (!session) {
    return success({ isMember: false });
  }

  try {
    const currentUser = await db.user.findUnique({
      where: { address: session.address },
      select: { id: true },
    });

    if (!currentUser) {
      return success({ isMember: false });
    }

    const joined = await isMember(currentUser.id, nodeId);
    return success({ isMember: joined });
  } catch (err) {
    console.error("[Join Status API] Error:", err);
    return success({ isMember: false });
  }
}
