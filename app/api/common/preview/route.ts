import { NextRequest } from "next/server";
import { success, badRequest } from "@/lib/api/response";
import { getLinkPreview } from "@/lib/article/parser";

import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return badRequest("Missing URL parameter");

  try {
    // 1. Try to find existing article in DB
    const existingArticle = await db.article.findFirst({
      where: { url: url },
      select: {
        title: true,
        description: true,
        images: true,
        extendedContent: true,
      },
    });

    if (existingArticle) {
      let image = "";
      // Try to get image from extendedContent first (more reliable), then images array
      if (existingArticle.extendedContent) {
        try {
          const meta = JSON.parse(existingArticle.extendedContent);
          image = meta.image || "";
        } catch {}
      }
      if (!image && existingArticle.images && existingArticle.images.length > 0) {
        image = existingArticle.images[0];
      }

      // If we have at least a title, use the DB data
      if (existingArticle.title) {
        return success({
          title: existingArticle.title,
          description: existingArticle.description || "",
          image: image,
          url: url,
        });
      }
    }

    // 2. Fallback to fresh fetching
    const preview = await getLinkPreview(url);
    if (!preview) {
      return success(null);
    }
    return success(preview);
  } catch (err: any) {
    console.error("[Preview API] Error:", err);
    return badRequest(err.message || "Failed to fetch preview");
  }
}
