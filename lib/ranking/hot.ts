import { db } from "@/lib/db";
import { VoteType } from "@prisma/client";

/**
 * 计算文章热度分数
 * 算法：(顶数 * 2 - 踩数) + 评论数 * 1.5 + 浏览数 * 0.01 + 时间衰减
 */
export async function calculateArticleHotScore(articleId: string) {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: {
      _count: {
        select: {
          votes: true,
          comments: true,
        },
      },
      votes: {
        select: {
          voteType: true,
        },
      },
    },
  });

  if (!article) return 0;

  let hotScore = 0;

  // 1. 检查是否有手动设置的热度
  if (article.manualHotScore !== null && article.manualHotScore !== undefined) {
    hotScore = article.manualHotScore;
  } else {
    // 2. 自动计算: 统计顶/踩数
    const upvotes = article.votes.filter((v) => v.voteType === VoteType.LIKE).length;
    const downvotes = article.votes.filter((v) => v.voteType === VoteType.DISLIKE).length;

    // 时间衰减（越新越热）
    const hoursSinceCreation = (Date.now() - article.createdAt.getTime()) / (1000 * 60 * 60);
    const timeDecay = Math.max(0, 1 - hoursSinceCreation / (24 * 7)); // 7天后衰减到0

    // 热度公式
    hotScore = Math.floor(
      (upvotes * 2 - downvotes) * 10 +
        article._count.comments * 15 +
        article.viewCount * 0.1 +
        timeDecay * 100
    );
  }

  // 更新数据库
  await db.article.update({
    where: { id: articleId },
    data: { hotScore },
  });

  return hotScore;
}

/**
 * 计算 Node 热度分数
 * 算法：成员数 * 3 + 文章数 * 2 + 浏览数 * 0.01
 */
export async function calculateNodeHotScore(nodeId: string) {
  const node = await db.node.findUnique({
    where: { id: nodeId },
    include: {
      _count: {
        select: {
          members: true,
          articles: true,
        },
      },
    },
  });

  if (!node) return 0;

  let hotScore = 0;

  // 1. 检查是否有手动设置的热度
  if (node.manualHotScore !== null && node.manualHotScore !== undefined) {
    hotScore = node.manualHotScore;
  } else {
    // 2. 自动计算热度公式
    hotScore = Math.floor(
      node._count.members * 30 + node._count.articles * 20 + node.viewCount * 0.1
    );
  }

  // 更新数据库
  await db.node.update({
    where: { id: nodeId },
    data: { hotScore },
  });

  return hotScore;
}

/**
 * 获取热门文章列表
 */
export async function getHotArticles(page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;

  const [list, total] = await Promise.all([
    db.article.findMany({
      include: {
        author: {
          select: {
            id: true,
            userId: true,
            userName: true,
            avatarUrl: true,
          },
        },
        node: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: {
            votes: true,
            comments: true,
          },
        },
      },
      orderBy: [{ hotScore: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    db.article.count(),
  ]);

  return {
    list,
    total,
    page,
    pageSize,
  };
}

/**
 * 获取热门 Node 列表
 */
export async function getHotNodes(page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;

  const [list, total] = await Promise.all([
    db.node.findMany({
      include: {
        creator: {
          select: {
            id: true,
            userId: true,
            userName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            members: true,
            articles: true,
          },
        },
      },
      orderBy: [{ hotScore: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    db.node.count(),
  ]);

  return {
    list,
    total,
    page,
    pageSize,
  };
}

/**
 * 增加浏览次数
 */
export async function incrementArticleView(articleId: string) {
  await db.article.update({
    where: { id: articleId },
    data: {
      viewCount: {
        increment: 1,
      },
    },
  });
}

export async function incrementNodeView(nodeId: string) {
  await db.node.update({
    where: { id: nodeId },
    data: {
      viewCount: {
        increment: 1,
      },
    },
  });
}

/**
 * 批量更新热度分数（定时任务）
 */
export async function updateAllHotScores() {
  // 更新所有文章热度
  const articles = await db.article.findMany({
    select: { id: true },
  });

  for (const article of articles) {
    await calculateArticleHotScore(article.id);
  }

  // 更新所有 Node 热度
  const nodes = await db.node.findMany({
    select: { id: true },
  });

  for (const node of nodes) {
    await calculateNodeHotScore(node.id);
  }

  console.log(`Updated hot scores for ${articles.length} articles and ${nodes.length} nodes`);
}
