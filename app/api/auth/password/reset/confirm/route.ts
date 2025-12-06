// app/api/auth/password/reset/confirm/route.ts
export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { email, token, newPassword } = await req.json();

    if (!email || !token || !newPassword) {
      return NextResponse.json(
        { ok: false, message: "不正なリクエスト" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { ok: false, message: "パスワードは8文字以上にしてください。" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const tokenHash = hashToken(String(token));
    const pr = await prisma.passwordReset.findFirst({
      where: { userId: user.id, tokenHash, used: false },
      orderBy: { createdAt: "desc" },
    });

    if (!pr || pr.expiresAt < new Date()) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const passwordHash = await hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    });

    await prisma.passwordReset.update({
      where: { id: pr.id },
      data: { used: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Password reset confirm error:", err);
    return NextResponse.json(
      { ok: false, message: "サーバーエラー" },
      { status: 500 },
    );
  }
}
