import { db } from "@/lib/db";

/**
 * 创建文章
 */
export async function createArticle(data: {
  url: string;
  description: string;
  images?: string[];
  authorId: string;
  nodeId: string;
  tagIds?: string[];
}) {
  const { tagIds, ...articleData } = data;

  return await db.article.create({
    data: {
      ...articleData,
      images: data.images || [],
      tags: tagIds
        ? {
            create: tagIds.map((tagId) => ({
              tag: { connect: { id: tagId } },
            })),
          }
        : undefined,
    },
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
    },
  });
}

/**
 * 获取文章详情
 */
export async function getArticle(articleId: string) {
  return await db.article.findUnique({
    where: { id: articleId },
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
    },
  });
}

/**
 * 获取 Node 下的文章列表
 */
export async function getNodeArticles(nodeId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;

  const [list, total] = await Promise.all([
    db.article.findMany({
      where: { nodeId },
      include: {
        author: {
          select: {
            id: true,
            userId: true,
            userName: true,
            avatarUrl: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    db.article.count({
      where: { nodeId },
    }),
  ]);

  return {
    list,
    total,
    page,
    pageSize,
  };
}

/**
 * 获取用户发布的文章列表
 */
export async function getUserArticles(authorId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;

  const [list, total] = await Promise.all([
    db.article.findMany({
      where: { authorId },
      include: {
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
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    db.article.count({
      where: { authorId },
    }),
  ]);

  return {
    list,
    total,
    page,
    pageSize,
  };
}

/**
 * 为文章添加标签
 */
export async function addTagToArticle(articleId: string, tagId: string) {
  return await db.articleTag.create({
    data: {
      articleId,
      tagId,
    },
  });
}

/**
 * 移除文章标签
 */
export async function removeTagFromArticle(articleId: string, tagId: string) {
  return await db.articleTag.delete({
    where: {
      articleId_tagId: {
        articleId,
        tagId,
      },
    },
  });
}

/**
 * 更新文章
 */
export async function updateArticle(
  articleId: string,
  data: {
    url?: string;
    description?: string;
    images?: string[];
  }
) {
  return await db.article.update({
    where: { id: articleId },
    data,
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
    },
  });
}

/**
 * 删除文章
 */
export async function deleteArticle(articleId: string) {
  return await db.article.delete({
    where: { id: articleId },
  });
}
