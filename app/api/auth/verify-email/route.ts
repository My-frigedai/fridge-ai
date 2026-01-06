// app/api/auth/verify-email/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token)
      return NextResponse.json(
        { ok: false, message: "token required" },
        { status: 400 },
      );

    const tokenHash = hashToken(token);

    const ev = (await prisma.emailVerification.findFirst({
      where: { tokenHash, used: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    })) as any;

    if (!ev) {
      const redirectUrl = `${BASE_URL}/verify-request?status=invalid`;
      return NextResponse.redirect(redirectUrl);
    }

    // Mark used
    await prisma.emailVerification.update({
      where: { id: ev.id },
      data: { used: true },
    });

    if (ev.pendingUser) {
      // 仮登録の昇格フロー
      const pending = ev.pendingUser;
      // 再チェック: 既に同じ email の User がいるか
      const existingUser = await prisma.user.findUnique({
        where: { email: pending.email },
      });

      if (existingUser) {
        // 競合（稀）: 既にユーザーが作られていたら pending を削除して既存を有効化
        await (prisma as any).pendingUser.delete({ where: { id: pending.id } });
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { emailVerified: new Date() },
        });
        const redirectTo = `${BASE_URL}/post-verify?email=${encodeURIComponent(existingUser.email ?? "")}`;
        return NextResponse.redirect(redirectTo);
      }

      // 新規ユーザー作成（昇格）
      const newUser = await prisma.user.create({
        data: {
          email: pending.email,
          name: pending.name ?? undefined,
          password: pending.password ?? undefined,
          status: "active",
          emailVerified: new Date(),
        },
      });

      // 仮登録データの削除（クリーンアップ）
      await (prisma as any).pendingUser.delete({ where: { id: pending.id } });

      const redirectTo = `${BASE_URL}/post-verify?email=${encodeURIComponent(newUser.email ?? "")}`;
      return NextResponse.redirect(redirectTo);
    }

    if (ev.user) {
      // 既存ユーザー向けの旧フロー
      await prisma.user.update({
        where: { id: ev.userId as string },
        data: { emailVerified: new Date() },
      });

      const redirectTo = `${BASE_URL}/post-verify?email=${encodeURIComponent(ev.user.email ?? "")}`;
      return NextResponse.redirect(redirectTo);
    }

    // ここには通常来ないが保険
    const redirectUrl = `${BASE_URL}/verify-request?status=invalid`;
    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.error("[verify-email] error:", err);
    return NextResponse.json(
      { ok: false, message: "server error" },
      { status: 500 },
    );
  }
}
