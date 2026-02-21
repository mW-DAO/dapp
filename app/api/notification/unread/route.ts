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

  const count = await db.notification.count({
    where: {
      userId: user.id,
      isRead: false,
    },
  });

  return success({ count });
}
