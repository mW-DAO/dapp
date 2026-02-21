import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { success, apiError, unauthorized, badRequest } from "@/lib/api/response";
import { joinNode, leaveNode } from "@/lib/node/member";
import { requireActiveUser } from "@/lib/auth/permissions";

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return unauthorized("Not authenticated");
  }

  try {
    // 检查用户状态
    const user = await requireActiveUser(session.address);
    const userId = user.id;

    const { nodeId, action } = await req.json();

    if (!nodeId) {
      return badRequest("Node ID is required");
    }

    if (action === "join") {
      await joinNode(userId, nodeId);
    } else if (action === "leave") {
      await leaveNode(userId, nodeId);
    } else {
      return badRequest("Invalid action");
    }

    return success({ action, nodeId });
  } catch (err: any) {
    console.error("[Join Node API] Error:", err);
    if (err.code === "P2002") {
      return apiError("Already a member", 400);
    }
    return apiError(err.message || "Failed to update node membership", 500);
  }
}
