import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { success, unauthorized } from "@/lib/api/response";
import { getUserNodes } from "@/lib/node/member";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return unauthorized("Not authenticated");
  }

  try {
    const currentUser = await db.user.findUnique({
      where: { address: session.address.toLowerCase() },
      select: { id: true },
    });

    if (!currentUser) {
      return unauthorized("User not found");
    }

    // 获取用户加入的所有 Node
    const result = await getUserNodes(currentUser.id, 1, 100);

    const formattedNodes = result.list.map((node: any) => ({
      id: node.id,
      name: node.name,
      avatar: node.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${node.id}`,
    }));

    return success(formattedNodes);
  } catch (error) {
    console.error("[User Nodes API] Error:", error);
    return success([]);
  }
}
