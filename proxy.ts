import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/auth/session";

// 1. Specify protected routes
const protectedRoutes = ["/profile", "/api/protected"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 2. Check if the current route is protected
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute) {
    const cookie = request.cookies.get("auth_token");
    const session = await decrypt(cookie?.value);

    // 3. Redirect to login or return 401 if no valid session
    if (!session?.address) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      } else {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
