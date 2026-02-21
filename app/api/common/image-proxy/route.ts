import { NextRequest, NextResponse } from "next/server";
import { badRequest } from "@/lib/api/response";

export const runtime = "edge"; // Use Edge runtime for better streaming performance if possible, or standard.
// Note: 'fs' and standard Node streams might differ in Edge. Let's stick to standard node if unsure or use standard Fetch API which works in Edge.

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return badRequest("Missing URL");

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "", // Remove referer to bypass hotlink protection
      },
      next: { revalidate: 3600 }, // Cache on Vercel CDN for 1 hour
    });

    if (!res.ok) {
      return new NextResponse("Failed to fetch image", { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";

    return new NextResponse(res.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[Image Proxy] Error:", err);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
