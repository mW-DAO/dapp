import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { success, unauthorized, notFound } from "@/lib/api/response";
import { getSession } from "@/lib/auth/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({
    where: { address: session.address.toLowerCase() },
    select: { id: true },
  });

  if (!user) return unauthorized();

  const { id } = await params;

  // Verify ownership
  const notification = await db.notification.findUnique({
    where: { id },
  });

  if (!notification) return notFound("Notification not found");

  if (notification.userId !== user.id) {
    return unauthorized("You do not own this notification");
  }

  // Mark as read
  await db.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return success(true);
}
