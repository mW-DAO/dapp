import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { success, apiError } from "@/lib/api/response";
import { getSession } from "@/lib/auth/session";
import { getColorFromTag } from "@/lib/utils/tag";

/**
 * GET: 获取节点详情及其文章列表
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const skip = (page - 1) * pageSize;

    const session = await getSession();
    let currentUserId: string | null = null;

    if (session) {
      const u = await db.user.findFirst({
        where: { address: { equals: session.address, mode: "insensitive" } },
        select: { id: true },
      });
      currentUserId = u?.id || null;
    }

    // 1. 获取节点信息
    const node = await db.node.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            userName: true,
            avatarUrl: true,
            userId: true,
            userBio: true,
          },
        },
        tags: { include: { tag: true } },
        _count: {
          select: { members: true, articles: true },
        },
        members: currentUserId
          ? {
              where: { userId: currentUserId },
              take: 1,
            }
          : undefined,
      },
    });

    if (!node) {
      return apiError("Node not found", 404);
    }

    // 2. 获取节点文章列表
    const [articles, totalArticles] = await Promise.all([
      db.article.findMany({
        where: { nodeId: id },
        include: {
          author: {
            select: { id: true, userId: true, userName: true, avatarUrl: true },
          },
          node: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
          _count: { select: { votes: true, comments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.article.count({ where: { nodeId: id } }),
    ]);

    // 格式化输出
    const formattedNode = {
      id: node.id,
      creatorId: node.creatorId,
      name: node.name,
      description: node.desc || "",
      coverImage: node.avatar || "",
      author: {
        id: node.creator.id,
        avatar: node.creator.avatarUrl || "",
        name: node.creator.userName,
        description: node.creator.userBio || "",
      },
      stats: {
        followers: node._count.members * 5, // 模拟关注数
        members: node._count.members,
        contentCount: node._count.articles,
        outputValue: `${(node.hotScore / 10).toFixed(1)}k CMW`,
      },
      tags: node.tags.map((t: any) => ({
        name: t.tag.name,
        color: t.tag.color || getColorFromTag(t.tag.name),
      })),
      isJoined: currentUserId ? node.members && node.members.length > 0 : false,
    };

    const formattedArticles = articles.map((art: any) => ({
      id: art.id,
      url: art.url,
      description: art.description,
      images: art.images,
      parsedContent: art.parsedContent,
      author: {
        id: art.author.id,
        userId: art.author.userId,
        name: art.author.userName,
        avatar: art.author.avatarUrl || "",
      },
      node: art.node,
      createdAt: art.createdAt,
      tags: art.tags.map((t: any) => ({
        name: t.tag.name,
        color: t.tag.color || getColorFromTag(t.tag.name),
      })),
      stats: {
        votes: art._count.votes, // 简化处理
        comments: art._count.comments,
        viewCount: art.viewCount,
      },
    }));

    return success({
      node: formattedNode,
      articles: {
        list: formattedArticles,
        total: totalArticles,
        page,
        pageSize,
        hasMore: skip + articles.length < totalArticles,
      },
    });
  } catch (error) {
    console.error("[Node Detail API] Error:", error);
    return apiError("Internal Server Error", 500);
  }
}
