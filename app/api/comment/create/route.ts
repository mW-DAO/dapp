import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { success, apiError, unauthorized, badRequest, unprocessable } from "@/lib/api/response";
import { getSession } from "@/lib/auth/session";
import { NotificationType } from "@prisma/client";
import { requireActiveUser } from "@/lib/auth/permissions";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const { articleId, content, parentId } = await req.json();

    if (!articleId || !content || !content.trim()) {
      return badRequest("Invalid parameters");
    }

    const user = await requireActiveUser(session.address);
    // const user = await db.user.findUnique({
    //   where: { address: session.address.toLowerCase() },
    //   select: { id: true },
    // });
    // if (!user) return unauthorized();

    // Verify article exists
    const article = await db.article.findUnique({
      where: { id: articleId },
      select: { id: true, authorId: true, title: true, description: true },
    });

    if (!article) return unprocessable("Article not found");

    // Create Comment
    const comment = await db.comment.create({
      data: {
        content: content.trim(),
        articleId,
        authorId: user.id,
        parentId, // Optional: for replying to other comments
      },
    });

    // Create Notification
    // 1. Notify Article Author (if not self)
    // if (article.authorId !== user.id) {
    if (article.authorId) {
      // Debug: Allow self-notification
      await db.notification.create({
        data: {
          userId: article.authorId,
          triggerUserId: user.id,
          type: NotificationType.COMMENT_REPLY,
          articleId: article.id,
          commentId: comment.id,
          title: article.title,
          content: content.trim().slice(0, 50),
        },
      });
    }

    // 2. TODO: If parentId exists, notify parent comment author (nested replies)

    return success(comment);
  } catch (error) {
    console.error("[Comment API] Error:", error);
    return apiError("Failed to post comment");
  }
}
