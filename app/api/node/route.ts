import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { success } from "@/lib/api/response";

import { getSession } from "@/lib/auth/session";
import { getColorFromTag } from "@/lib/utils/tag";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type") || "hot";
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "10");

  const skip = (page - 1) * pageSize;

  try {
    let nodes: any[] = [];
    let total = 0;

    let where: any = {};
    const orderBy: any =
      type === "latest" ? { createdAt: "desc" } : [{ hotScore: "desc" }, { createdAt: "desc" }];

    // 获取当前用户 ID (无论是否筛选类型，都需要知道当前用户的加入状态)
    const session = await getSession();
    let currentUserId: string | null = null;

    if (session) {
      const u = await db.user.findFirst({
        where: {
          address: {
            equals: session.address,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });
      if (u) {
        currentUserId = u.id;
        console.log(`[API debug] Current User: ${currentUserId} (Address: ${session.address})`);
      } else {
        console.log(`[API debug] User not found for address: ${session.address}`);
      }
    }

    // 如果请求的是"我建立的"或"我关注的",需要确定目标用户
    if (type === "created" || type === "joined") {
      let targetUserId: string | null = null;
      
      // 优先使用 URL 参数中的 userId (查看指定用户)
      const userIdParam = searchParams.get("userId");
      if (userIdParam) {
        targetUserId = userIdParam;
      } else if (currentUserId) {
        // 未指定 userId,使用当前登录用户
        targetUserId = currentUserId;
      } else {
        // 未登录且未指定用户,返回空
        return success({ list: [], total: 0, page, pageSize, hasMore: false });
      }

      if (type === "created") {
        where = { creatorId: targetUserId };
      } else if (type === "joined") {
        // 我关注的 = 我加入了成员 + 不是我创建的 (排除掉我是 Owner 的)
        where = {
          members: { some: { userId: targetUserId } },
          creatorId: { not: targetUserId },
        };
      }
    }

    [nodes, total] = await Promise.all([
      db.node.findMany({
        where,
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
          tags: {
            include: {
              tag: true,
            },
          },
          // 如果用户已登录，查询该用户是否在成员列表中
          ...(currentUserId
            ? {
                members: {
                  where: { userId: currentUserId },
                  select: { id: true },
                  take: 1,
                },
              }
            : {}),
          _count: {
            select: {
              members: true,
              articles: true,
            },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      db.node.count({ where }),
    ]);

    const formattedNodes = nodes.map((node: any) => ({
      id: node.id,
      creatorId: node.creatorId,
      coverImage: node.avatar || "",
      name: node.name,
      description: node.desc || "",
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
        outputValue: `${(node.hotScore / 10).toFixed(1)}k CMW`, // 模拟产值
      },
      tags: node.tags.map((t: any) => ({
        name: t.tag.name,
        color: t.tag.color || getColorFromTag(t.tag.name),
      })),
      // 如果 members 数组不为空，说明当前用户是成员
      isJoined: currentUserId ? node.members && node.members.length > 0 : false,
    }));

    return success({
      list: formattedNodes,
      total,
      page,
      pageSize,
      hasMore: skip + nodes.length < total,
    });
  } catch (error) {
    console.error("[Node API] Error:", error);
    return success({
      list: [],
      total: 0,
      page,
      pageSize,
      hasMore: false,
    });
  }
}
