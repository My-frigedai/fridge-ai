// app/api/auth/reset/request/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const EMAIL_HOST = process.env.EMAIL_HOST!;
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 465);
const EMAIL_USER = process.env.EMAIL_USER!;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD!;
const EMAIL_FROM = process.env.EMAIL_FROM!;
const NEXTAUTH_URL = process.env.NEXTAUTH_URL!;

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ ok: true }); // 仕様: 常に成功レスポンス

    const normalized = String(email).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalized } });

    // 常に 200 を返す（存在確認はしない）
    if (!user) {
      // still return success to avoid enumeration
      return NextResponse.json({ ok: true });
    }

    const token = jwt.sign({ userId: user.id }, process.env.NEXTAUTH_SECRET!, { expiresIn: "1h" });
    const resetUrl = `${NEXTAUTH_URL}/reset-password/${token}`;

    const transport = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
    });

    await transport.sendMail({
      to: user.email!,
      from: EMAIL_FROM,
      subject: "【My-FridgeAI】パスワード再設定のご案内",
      text: `下のリンクからパスワードを再設定してください（60分で無効になります）:\n\n${resetUrl}`,
      html: `<p>下のリンクからパスワードを再設定してください（60分で無効になります）:</p>
             <p><a href="${resetUrl}" target="_blank" rel="noreferrer">${resetUrl}</a></p>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("reset request error:", err);
    // 常にOK（攻撃者に詳細を見せない）
    return NextResponse.json({ ok: true });
  }
}
