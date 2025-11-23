// middleware.ts
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const { pathname } = req.nextUrl;

  // ✅ 静的ファイルやNext.js内部リソースは除外
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/api") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // ✅ 認証不要ページを拡張
  const publicPaths = ["/login", "/register", "/terms", "/privacy"];
  const isPublicPage = publicPaths.some(path => pathname.startsWith(path));

  if (!token && !isPublicPage) {
    const loginUrl = new URL("/register", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
