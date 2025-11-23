// app/api/auth/password/reset/request/route.ts
import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";
import { randomBytes, createHash } from "crypto";

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return new Response(JSON.stringify({ ok: false, message: "メールアドレスが必要です。" }), { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    // セキュリティ上の理由で、存在しなくても成功を返す（存在確認を攻撃者に与えない）
    if (!user) return new Response(JSON.stringify({ ok: true }));

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT || 465),
      secure: Number(process.env.EMAIL_SERVER_PORT || 465) === 465,
      auth: { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL?.replace(/\/$/, "") || ""}/reset-password/verify?token=${rawToken}&email=${encodeURIComponent(user.email!)}`;

    const html = `<p>パスワード再設定のリクエストを受け付けました。下のリンクをクリックして、パスワードを再設定してください（リンクの有効期限：10分）。</p>
                  <p><a href="${resetUrl}" target="_blank" rel="noreferrer">${resetUrl}</a></p>`;

    await transporter.sendMail({
      to: user.email!,
      from: process.env.EMAIL_FROM,
      subject: "My-FridgeAI — パスワード再設定",
      text: `再設定リンク: ${resetUrl}`,
      html,
    });

    return new Response(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error("Password reset request error:", err);
    return new Response(JSON.stringify({ ok: false, message: "サーバーエラー" }), { status: 500 });
  }
}
