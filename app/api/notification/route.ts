import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { success, unauthorized } from "@/lib/api/response";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({
    where: { address: session.address.toLowerCase() },
    select: { id: true },
  });

  if (!user) return unauthorized();

  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const skip = (page - 1) * pageSize;

  const [notifications, total] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      include: {
        triggerUser: {
          select: { id: true, userName: true, avatarUrl: true },
        },
        article: {
          select: { id: true, title: true, description: true },
        },
        comment: {
          select: { id: true, content: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.notification.count({ where: { userId: user.id } }),
  ]);

  return success({
    list: notifications,
    total,
    page,
    pageSize,
    hasMore: skip + notifications.length < total,
  });
}

// Optional: Mark as read
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({
    where: { address: session.address.toLowerCase() },
    select: { id: true },
  });
  if (!user) return unauthorized();

  // Mark all as read for simplicity for now
  await db.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });

  return success(true);
}
