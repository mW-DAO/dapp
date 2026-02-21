import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { success, unauthorized, unprocessable, apiError } from "@/lib/api/response";
import { getSession } from "@/lib/auth/session";
import { requireActiveUser } from "@/lib/auth/permissions";
import { getColorFromTag } from "@/lib/utils/tag";
import { z } from "zod";

const articleSchema = z.object({
  content: z.string().min(1, "内容不能为空"),
  mediaUrl: z.string().url("媒体链接格式不正确"),
  nodeId: z.string().min(1, "请选择一个超级节点"),
  images: z.array(z.string().url()).optional(),
  tags: z.array(z.string()).optional(),
  extendedContent: z.string().optional(), // NEW: JSON string of link preview data
  parsedContent: z.string().optional(), // NEW: Clean HTML content from readability
});

/**
 * GET: 获取文章列表 (之前的 Feed)
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type") || "hot";
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  const skip = (page - 1) * pageSize;

  try {
    let articles: any[] = [];
    let total = 0;

    const session = await getSession();
    let currentUserId: string | undefined;

    if (session) {
      const user = await db.user.findUnique({
        where: { address: session.address.toLowerCase() },
        select: { id: true },
      });
      currentUserId = user?.id;
    }

    switch (type) {
      case "hot":
        [articles, total] = await Promise.all([
          db.article.findMany({
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
            orderBy: [{ hotScore: "desc" }, { createdAt: "desc" }],
            skip,
            take: pageSize,
          }),
          db.article.count(),
        ]);
        break;

      case "latest":
        [articles, total] = await Promise.all([
          db.article.findMany({
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
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
          }),
          db.article.count(),
        ]);
        break;

      case "following":
        if (!session) {
          return success({ list: [], total: 0, page, pageSize, hasMore: false });
        }

        if (!currentUserId) {
          return success({ list: [], total: 0, page, pageSize, hasMore: false });
        }

        const currentUser = { id: currentUserId };

        if (!currentUser) {
          return success({ list: [], total: 0, page, pageSize, hasMore: false });
        }

        const following = await db.follow.findMany({
          where: { followerId: currentUser.id },
          select: { followingId: true },
        });

        const followingIds = following.map((f) => f.followingId);

        if (followingIds.length === 0) {
          return success({ list: [], total: 0, page, pageSize, hasMore: false });
        }

        [articles, total] = await Promise.all([
          db.article.findMany({
            where: { authorId: { in: followingIds } },
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
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
          }),
          db.article.count({ where: { authorId: { in: followingIds } } }),
        ]);
        break;

      default:
        articles = [];
        total = 0;
    }

    // 获取文章的点赞详情（分组统计与当前用户状态）
    const voteStatsMap = new Map<string, { up: number; down: number; userVote: string | null }>();

    if (articles.length > 0) {
      const articleIds = articles.map((a: any) => a.id);

      // 1. 批量获取当前用户的点赞状态
      if (currentUserId) {
        const userVotes = await db.articleVote.findMany({
          where: {
            userId: currentUserId,
            articleId: { in: articleIds },
          },
          select: { articleId: true, voteType: true },
        });
        userVotes.forEach((v) => {
          const current = voteStatsMap.get(v.articleId) || { up: 0, down: 0, userVote: null };
          current.userVote = v.voteType;
          voteStatsMap.set(v.articleId, current);
        });
      }

      // 2. 批量统计 Like/Dislike 数量
      const groupCounts = await db.articleVote.groupBy({
        by: ["articleId", "voteType"],
        where: { articleId: { in: articleIds } },
        _count: true,
      });

      groupCounts.forEach((g) => {
        const current = voteStatsMap.get(g.articleId) || { up: 0, down: 0, userVote: null };
        if (g.voteType === "LIKE") current.up = g._count;
        if (g.voteType === "DISLIKE") current.down = g._count;
        voteStatsMap.set(g.articleId, current);
      });
    }

    const list = articles.map((article: any) => {
      const voteInfo = voteStatsMap.get(article.id) || { up: 0, down: 0, userVote: null };

      return {
        id: article.id,
        url: article.url,
        description: article.description,
        extendedContent: article.extendedContent,
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
    });

    return success({
      list,
      total,
      page,
      pageSize,
      hasMore: skip + articles.length < total,
    });
  } catch (error) {
    console.error("[Article API GET] Error:", error);
    return success({ list: [], total: 0, page, pageSize, hasMore: false });
  }
}

/**
 * POST: 创建文章
 */
export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return unauthorized("Not authenticated");
  }

  try {
    const body = await req.json();
    const validatedData = articleSchema.parse(body);

    const user = await requireActiveUser(session.address);
    const userId = user.id;

    // Remove legacy currentUser fetching code
    // const currentUser = await db.user.findUnique({
    //   where: { address: session.address.toLowerCase() },
    //   select: { id: true },
    // });
    // if (!currentUser) return unauthorized("User not found");

    const node = await db.node.findUnique({
      where: { id: validatedData.nodeId },
    });

    if (!node) {
      return unprocessable("Selected node does not exist");
    }

    const tagOperations = validatedData.tags
      ? await Promise.all(
          validatedData.tags.map(async (tagInput) => {
            const trimmedTag = tagInput.trim();
            const existingTag = await db.tag.findFirst({
              where: { name: { equals: trimmedTag, mode: "insensitive" } },
            });

            if (existingTag) {
              return { tag: { connect: { id: existingTag.id } } };
            }

            return {
              tag: {
                create: {
                  name: trimmedTag,
                  color: getColorFromTag(trimmedTag),
                },
              },
            };
          })
        )
      : undefined;

    // Extract title from extendedContent
    let articleTitle = "";
    if (validatedData.extendedContent) {
      try {
        const meta = JSON.parse(validatedData.extendedContent);
        // Use title, fallback to description, or empty
        articleTitle = meta.title || meta.description || "";
      } catch {}
    }

    const article = await db.article.create({
      data: {
        title: articleTitle,
        description: validatedData.content,
        url: validatedData.mediaUrl,
        images: validatedData.images || [],
        extendedContent: validatedData.extendedContent, // NEW
        parsedContent: validatedData.parsedContent,
        authorId: userId,
        nodeId: validatedData.nodeId,
        tags: { create: tagOperations },
      },
    });

    return success(article, "Publishing successful");
  } catch (err) {
    if (err instanceof z.ZodError) {
      return apiError(err.issues[0].message, 400);
    }
    console.error("[Article API POST] Error:", err);
    return apiError("Failed to publish article", 500);
  }
}
