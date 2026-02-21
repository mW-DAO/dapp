import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { success, unauthorized, apiError } from "@/lib/api/response";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/permissions";

const updateSchema = z.object({
  username: z.string().min(2, "用户名至少 2 个字符").max(20, "用户名最多 20 个字符").optional(),
  bio: z.string().max(200, "简介最多 200 个字符").optional(),
  avatar: z.string().url("头像必须是有效的 URL").or(z.literal("")).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return unauthorized("Not authenticated");
  }

  try {
    const body = await req.json();
    const validatedData = updateSchema.parse(body);

    const normalizedAddress = session.address.toLowerCase();

    // 检查用户状态
    await requireActiveUser(normalizedAddress);

    // 更新用户资料
    const updatedUser = await db.user.update({
      where: { address: normalizedAddress },
      data: {
        ...(validatedData.username && { userName: validatedData.username }),
        ...(validatedData.bio !== undefined && { userBio: validatedData.bio }),
        ...(validatedData.avatar !== undefined && { avatarUrl: validatedData.avatar }),
      },
    });

    return success({
      username: updatedUser.userName,
      bio: updatedUser.userBio,
      avatar: updatedUser.avatarUrl,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return apiError(err.issues[0].message, 400);
    }
    console.error("[User Update API] Error:", err);
    return apiError("Failed to update profile", 500);
  }
}
