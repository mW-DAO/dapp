import { NextRequest, NextResponse } from "next/server";
import { updateAllHotScores } from "@/lib/ranking/hot";

/**
 * 定时任务：更新所有热度分数
 * Vercel Cron: 每小时执行一次
 */
export async function GET(req: NextRequest) {
  // 验证 Cron Secret（防止被恶意调用）
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await updateAllHotScores();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json({ error: "Failed to update hot scores" }, { status: 500 });
  }
}
