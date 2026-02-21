import { NextResponse } from "next/server";
import { generateNonce } from "siwe";
import { headers, cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyTurnstile } from "@/lib/utils/turnstile";
import { getSession } from "@/lib/auth/session";
import { createSignatureNonce } from "@/lib/auth/signature";

export async function GET() {
  const nonce = generateNonce();
  const cookieStore = await cookies();

  cookieStore.set("siwe_nonce", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.json({ nonce });
}

export async function POST(req: Request) {
  try {
    const { turnstileToken, action, targetId } = await req.json();

    // 1. 验证 Turnstile Token
    const ip = req.headers.get("x-forwarded-for") || undefined;
    const isValid = await verifyTurnstile(turnstileToken, ip);

    if (!isValid) {
      return NextResponse.json(
        { message: "Invalid Turnstile token" },
        { status: 400 }
      );
    }

    // 2. 验证用户登录状态
    const session = await getSession();
    if (!session || !session.address) {
       return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { address: session.address.toLowerCase() },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json(
       { message: "User not found" },
       { status: 401 }
     );
   }

    // 3. 生成并存储 Nonce
    const { nonce, deadline } = await createSignatureNonce(user.id, action, targetId);

    return NextResponse.json({
      code: 200,
      data: {
        nonce,
        deadline
      }
    });
  } catch (error) {
    console.error("Nonce generation failed:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
