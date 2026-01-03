// middleware.ts
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /* =========================
     1. 完全に除外するパス
  ========================= */

  // NextAuth（最重要）
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Next.js 内部・静的アセット
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // API（認証不要なものは各 API 側で制御）
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  /* =========================
     2. 公開ページ
  ========================= */

  const publicPaths = ["/login", "/register", "/terms", "/privacy"];
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isPublic) {
    return NextResponse.next();
  }

  /* =========================
     3. 認証チェック
  ========================= */

  let token = null;
  try {
    token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });
  } catch (err) {
    console.warn("[middleware] getToken error:", err);
  }

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/* =========================
   4. matcher（最重要）
========================= */

export const config = {
  matcher: [
    /*
      - ページだけを対象にする
      - api / _next / static は除外
    */
    "/((?!api|_next|static|favicon.ico).*)",
  ],
};
