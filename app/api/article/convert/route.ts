import { NextRequest } from "next/server";
import { success, badRequest } from "@/lib/api/response";
import { parseArticleContent } from "@/lib/article/parser";

import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return badRequest("Missing URL parameter");

  try {
    // 1. Check if we already have this article parsed in DB
    const cachedArticle = await db.article.findFirst({
      where: {
        url: url,
        parsedContent: { not: null },
      },
      select: {
        title: true,
        parsedContent: true,
        description: true,
      },
    });

    if (cachedArticle && cachedArticle.parsedContent) {
      console.log("[Convert API] Hit cache for:", url);
      return success({
        title: cachedArticle.title || "Cached Article",
        content: cachedArticle.parsedContent,
      });
    }

    // 2. Fallback to fresh parsing
    const result = await parseArticleContent(url);

    // [New] Cache the result in DB for all articles with this URL
    // Fire and forget (don't await to block response) or await if strict consistency needed.
    // Given this is an optimization, we can await it to ensure it's saved.
    await db.article.updateMany({
      where: { url: url },
      data: {
        parsedContent: result.content,
        parsedAt: new Date(),
      },
    });

    return success(result);
  } catch (err: any) {
    console.error("[Convert API] Error:", err);
    return badRequest(err.message || "Failed to convert article");
  }
}
