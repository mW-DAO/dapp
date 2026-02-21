import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { success, apiError } from "@/lib/api/response";
import { getSession } from "@/lib/auth/session";
import { getColorFromTag } from "@/lib/utils/tag";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const session = await getSession();
    let currentUserId: string | undefined;

    if (session) {
      const user = await db.user.findUnique({
        where: { address: session.address.toLowerCase() },
        select: { id: true },
      });
      currentUserId = user?.id;
    }

    const article = await db.article.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, userId: true, userName: true, avatarUrl: true },
        },
        node: {
          select: { id: true, name: true },
        },
        tags: { include: { tag: true } },
        _count: { select: { votes: true, comments: true } },
      },
    });

    if (!article) {
      return apiError("Article not found", 404);
    }

    // Get Vote Info
    const voteInfo = { up: 0, down: 0, userVote: null as string | null };

    // 1. Get User Vote
    if (currentUserId) {
      const userVote = await db.articleVote.findUnique({
        where: {
          userId_articleId: {
            userId: currentUserId,
            articleId: article.id,
          },
        },
      });
      if (userVote) {
        voteInfo.userVote = userVote.voteType;
      }
    }

    // 2. Get Counts
    const groupCounts = await db.articleVote.groupBy({
      by: ["voteType"],
      where: { articleId: article.id },
      _count: true,
    });

    groupCounts.forEach((g) => {
      if (g.voteType === "LIKE") voteInfo.up = g._count;
      if (g.voteType === "DISLIKE") voteInfo.down = g._count;
    });

    const data = {
      id: article.id,
      url: article.url,
      description: article.description,
      extendedContent: article.extendedContent, // Include extended content
      parsedContent: article.parsedContent, // Include parsed HTML content
      parsedInfo: article.parsedByUserId
        ? {
            userId: article.parsedByUserId,
            at: article.parsedAt,
          }
        : null,
      images: article.images,
      author: {
        id: article.author.id,
        userId: article.author.userId,
        name: article.author.userName,
        avatar: article.author.avatarUrl || "",
      },
      node: article.node,
      createdAt: article.createdAt,
      tags: article.tags.map((t: any) => ({
        name: t.tag.name,
        color: t.tag.color || getColorFromTag(t.tag.name),
      })),
      stats: {
        upVotes: voteInfo.up,
        downVotes: voteInfo.down,
        comments: article._count.comments,
        viewCount: article.viewCount,
      },
      userVote: voteInfo.userVote as "LIKE" | "DISLIKE" | null,
    };

    // Increment View Count (Fire and forget, or simple await)
    // db.article.update({ where: { id }, data: { viewCount: { increment: 1 } } });

    return success(data);
  } catch (error) {
    console.error("[Article Detail API] Error:", error);
    return apiError("Internal Server Error", 500);
  }
}

import { parseArticleContent } from "@/lib/article/parser";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();

    // 1. Auth Check
    if (!session) return apiError("Unauthorized", 401);

    const user = await db.user.findUnique({
      where: { address: session.address.toLowerCase() },
      select: { id: true },
    });

    if (!user) return apiError("User not found", 401);

    // 2. Fetch Article (Need URL for conversion)
    const article = await db.article.findUnique({
      where: { id },
      select: { id: true, url: true },
    });

    if (!article) return apiError("Article not found", 404);

    // 3. Update Logic
    const body = await req.json();
    const { parsedContent: manualContent, action } = body;
    let contentToSave = manualContent;

    // Handle "One-Click Convert"
    if (action === "convert") {
      try {
        const result = await parseArticleContent(article.url);
        contentToSave = result.content;
      } catch (err: any) {
        return apiError(err.message || "Failed to convert content", 400);
      }
    }

    if (!contentToSave) return apiError("Missing content or action", 400);

    const updated = await db.article.update({
      where: { id },
      data: {
        parsedContent: contentToSave,
        parsedByUserId: user.id,
        parsedAt: new Date(),
      },
      select: { id: true, parsedContent: true },
    });

    return success(updated);
  } catch (error) {
    console.error("[Article PATCH] Error:", error);
    return apiError("Internal Server Error", 500);
  }
}
