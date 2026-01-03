// app/api/auth/password-reset/confirm/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { hash as bcryptHash } from "bcryptjs";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: emailRaw, token, password: newPassword } = body ?? {};

    if (
      !emailRaw ||
      typeof emailRaw !== "string" ||
      !token ||
      typeof token !== "string" ||
      !newPassword ||
      typeof newPassword !== "string"
    ) {
      return NextResponse.json(
        { ok: false, message: "不正なリクエストです" },
        { status: 400 },
      );
    }
    const email = emailRaw.toLowerCase().trim();

    // basic password policy (server-side)
    if (newPassword.length < 8) {
      return NextResponse.json(
        { ok: false, message: "パスワードは8文字以上にしてください" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Avoid leaking: still return generic error
      return NextResponse.json(
        { ok: false, message: "無効なトークンか、ユーザーが存在しません" },
        { status: 400 },
      );
    }

    const tokenHash = hashToken(token);

    const pr = await prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        tokenHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!pr) {
      return NextResponse.json(
        { ok: false, message: "無効または期限切れのトークンです" },
        { status: 400 },
      );
    }

    // hash password and update
    const hashed = await bcryptHash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    // mark reset token used
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, tokenHash, used: false },
      data: { used: true },
    });

    return NextResponse.json({
      ok: true,
      message: "パスワードを更新しました。ログインしてください。",
    });
  } catch (err: any) {
    console.error("[password-reset confirm] error:", err?.stack ?? err);
    return NextResponse.json(
      { ok: false, message: "サーバーエラーが発生しました" },
      { status: 500 },
    );
  }
}
