// app/api/auth/password/reset/confirm/route.ts
import prisma from "@/lib/prisma";
import { createHash } from "crypto";
import { hash } from "bcryptjs";

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { email, token, newPassword } = await req.json();
    if (!email || !token || !newPassword) return new Response(JSON.stringify({ ok: false, message: "不正なリクエスト" }), { status: 400 });

    if (newPassword.length < 8) return new Response(JSON.stringify({ ok: false, message: "パスワードは8文字以上にしてください。" }), { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!user) return new Response(JSON.stringify({ ok: false }), { status: 400 });

    const tokenHash = hashToken(String(token));
    const pr = await prisma.passwordReset.findFirst({
      where: { userId: user.id, tokenHash, used: false },
      orderBy: { createdAt: "desc" },
    });

    if (!pr || pr.expiresAt < new Date()) return new Response(JSON.stringify({ ok: false }), { status: 400 });

    const passwordHash = await hash(newPassword, 10);

    await prisma.user.update({ where: { id: user.id }, data: { password: passwordHash } });
    await prisma.passwordReset.update({ where: { id: pr.id }, data: { used: true } });

    return new Response(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error("Password reset confirm error:", err);
    return new Response(JSON.stringify({ ok: false, message: "サーバーエラー" }), { status: 500 });
  }
}
