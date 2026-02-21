import { db } from "@/lib/db";

/**
 * 加入 Node
 */
export async function joinNode(userId: string, nodeId: string, role = "MEMBER") {
  // 检查 Node 是否存在
  const node = await db.node.findUnique({
    where: { id: nodeId },
  });

  if (!node) {
    throw new Error("Node 不存在");
  }

  return await db.nodeMember.create({
    data: {
      userId,
      nodeId,
      role,
    },
  });
}

/**
 * 退出 Node
 */
export async function leaveNode(userId: string, nodeId: string) {
  return await db.nodeMember.delete({
    where: {
      userId_nodeId: {
        userId,
        nodeId,
      },
    },
  });
}

/**
 * 检查是否已加入 Node
 */
export async function isMember(userId: string, nodeId: string) {
  const member = await db.nodeMember.findUnique({
    where: {
      userId_nodeId: {
        userId,
        nodeId,
      },
    },
  });
  return !!member;
}

/**
 * 获取 Node 信息（包含成员数）
 */
export async function getNodeWithStats(nodeId: string) {
  return await db.node.findUnique({
    where: { id: nodeId },
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
          members: true, // 成员数
        },
      },
    },
  });
}

/**
 * 获取 Node 成员列表
 */
export async function getNodeMembers(nodeId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;

  const [list, total] = await Promise.all([
    db.nodeMember.findMany({
      where: { nodeId },
      include: {
        user: {
          select: {
            id: true,
            userId: true,
            userName: true,
            avatarUrl: true,
            userBio: true,
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: { joinedAt: "desc" },
    }),
    db.nodeMember.count({
      where: { nodeId },
    }),
  ]);

  return {
    list: list.map((item) => ({
      ...item.user,
      role: item.role,
      joinedAt: item.joinedAt,
    })),
    total,
    page,
    pageSize,
  };
}

/**
 * 获取用户加入的 Node 列表
 */
export async function getUserNodes(userId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;

  const [list, total] = await Promise.all([
    db.nodeMember.findMany({
      where: { userId },
      include: {
        node: {
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
              },
            },
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: { joinedAt: "desc" },
    }),
    db.nodeMember.count({
      where: { userId },
    }),
  ]);

  return {
    list: list.map((item) => ({
      ...item.node,
      role: item.role,
      joinedAt: item.joinedAt,
    })),
    total,
    page,
    pageSize,
  };
}

/**
 * 获取用户创建的 Node 列表
 */
export async function getUserCreatedNodes(userId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;

  const [list, total] = await Promise.all([
    db.node.findMany({
      where: { creatorId: userId },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    db.node.count({
      where: { creatorId: userId },
    }),
  ]);

  return {
    list,
    total,
    page,
    pageSize,
  };
}
