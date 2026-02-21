import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { success, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const tags = await db.tag.findMany({
      orderBy: {
        nodes: {
          _count: "desc",
        },
      },
      take: 10,
      select: {
        name: true,
      },
    });

    return success({
      list: tags.map((t) => t.name),
    });
  } catch (err) {
    console.error("[Hot Tags API] Error:", err);
    // 即使出错也不要崩，返回空列表让前端用兜底数据
    return success({ list: [] });
  }
}
