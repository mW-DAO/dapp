import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { success, badRequest, unauthorized, apiError } from "@/lib/api/response";
import { getSession } from "@/lib/auth/session";
import { requireActiveUser } from "@/lib/auth/permissions";
import { z } from "zod";

const createNodeSchema = z.object({
  name: z.string().min(2, "超级节点名称至少需要 2 个字符").max(50, "名称太长了"),
  desc: z.string().optional(),
  avatar: z.string().url("头像必须是有效的链接"),
  tags: z.array(z.string()).optional(),
});

import { getColorFromTag } from "@/lib/utils/tag";

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return unauthorized("Not authenticated");
  }

  try {
    const body = await req.json();
    // 检查用户状态
    const user = await requireActiveUser(session.address);
    const userId = user.id;

    const validatedData = createNodeSchema.parse(body);

    // The original code had a currentUser lookup, but requireActiveUser already provides the user object.
    // We can use the 'user' object returned by requireActiveUser directly.
    // const currentUser = await db.user.findUnique({
    //   where: { address: session.address.toLowerCase() },
    //   select: { id: true },
    // });

    // if (!currentUser) {
    //   return unauthorized("User not found");
    // }

    // 处理标签：忽略大小写匹配，但保留原样存储
    const tagOperations = validatedData.tags
      ? await Promise.all(
          validatedData.tags.map(async (tagInput) => {
            const trimmedTag = tagInput.trim();
            // 查找是否存在（忽略大小写）
            const existingTag = await db.tag.findFirst({
              where: {
                name: { equals: trimmedTag, mode: "insensitive" },
              },
            });

            if (existingTag) {
              return {
                tag: { connect: { id: existingTag.id } },
              };
            }

            return {
              tag: {
                create: {
                  name: trimmedTag, // 保留原大小写
                  color: getColorFromTag(trimmedTag),
                },
              },
            };
          })
        )
      : undefined;

    // 创建节点
    const node = await db.node.create({
      data: {
        creatorId: userId,
        name: validatedData.name,
        desc: validatedData.desc,
        avatar: validatedData.avatar,
        tags: {
          create: tagOperations,
        },
      },
    });

    // 自动将创建者加入节点作为 Member（可选，视业务逻辑而定，通常创建者自动加入）
    await db.nodeMember.create({
      data: {
        userId: userId,
        nodeId: node.id,
        role: "OWNER",
      },
    });

    return success(node, "Node created successfully");
  } catch (err) {
    if (err instanceof z.ZodError) {
      return apiError(err.issues[0].message, 400);
    }
    console.error("[Node Create API] Error:", err);
    return apiError("Failed to create node", 500);
  }
}
