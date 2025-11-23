// app/api/auth/send-otp/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";
import { randomBytes } from "crypto";
import { compare } from "bcryptjs";

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 465);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || `My-FridgeAI <no-reply@localhost>`;
const BASE_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

async function createTransport() {
  const config = {
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
  };
  const transport = nodemailer.createTransport(config);
  await transport.verify();
  console.log("✅ SMTP verified", { host: EMAIL_HOST, port: EMAIL_PORT });
  return transport;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("send-otp body:", body);
    const { email, password, mode } = body ?? {}; 
    // mode: "register" | "login"

    if (!email) {
      return NextResponse.json({ message: "メールアドレスを入力してください。" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (mode === "login") {
      if (!password) {
        return NextResponse.json({ message: "メールアドレスとパスワードを入力してください。" }, { status: 400 });
      }
      if (!user || !user.password) {
        return NextResponse.json({ message: "メールアドレスまたはパスワードが一致しません。" }, { status: 401 });
      }
      const ok = await compare(password, user.password);
      if (!ok) {
        return NextResponse.json({ message: "メールアドレスまたはパスワードが一致しません。" }, { status: 401 });
      }
    } else if (mode === "register") {
      if (!user) {
        return NextResponse.json({ message: "登録されていないメールアドレスです。" }, { status: 404 });
      }
    }

    // 6桁コード + トークン
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10分

    try {
      await prisma.user.update({
        where: { email },
        data: {
          verifyCode: code,
          verifyToken: token,
          verifyExpires: expires,
        } as any,
      });
    } catch (dbErr) {
      console.error("Prisma update error (send-otp):", dbErr);
      return NextResponse.json({ message: "サーバーのデータ保存でエラーが発生しました（Prisma）。" }, { status: 500 });
    }

    // メール送信
    const transport = await createTransport();
    const verifyUrl = `${BASE_URL}/verify?token=${token}&email=${encodeURIComponent(email)}`;

    let subject = "";
    let text = "";
    let html = "";

    if (mode === "login") {
      subject = "My-FridgeAI — ログイン確認コード";
      text = `My-FridgeAI のログイン確認コード: ${code}\nまたは以下のリンクでログインを完了できます: ${verifyUrl}\n（コードは10分で無効です）`;
      html = `
        <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial; color:#111;">
          <h3>My-FridgeAI ログイン確認</h3>
          <p>以下の確認コードを入力してください。</p>
          <div style="font-size:20px; letter-spacing:6px; margin:12px 0; padding:10px 16px; background:#f6f7fb; border-radius:8px;">${code}</div>
          <p>または下のボタンでログインを完了できます。</p>
          <p><a href="${verifyUrl}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;">ログインを完了する</a></p>
          <hr style="margin-top:16px;"/>
          <small style="color:#666;">このメールに心当たりがない場合は破棄してください。${BASE_URL}</small>
        </div>
      `;
    } else if (mode === "register") {
      subject = "【FridgeAI】メールアドレスのご確認をお願いします";
      text = `FridgeAI にご登録いただきありがとうございます。\n\n以下の確認コードをアプリに入力してください:\n${code}\n\nまたは以下のリンクをクリックして認証を完了できます:\n${verifyUrl}\n\nこのコードの有効期限は10分です。`;
      html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto;">
          <h2 style="color:#ff6600;">FridgeAI にご登録ありがとうございます！</h2>
          <p>こんにちは <strong>${user?.name || "ユーザー"} さん</strong>。</p>
          <p>以下の確認コードをアプリに入力してください:</p>
          <div style="background:#f4f4f4;padding:12px;text-align:center;font-size:20px;letter-spacing:4px;font-weight:bold;">
            ${code}
          </div>
          <p>または、下記リンクをクリックすると認証が完了します。</p>
          <p><a href="${verifyUrl}" target="_blank" style="color:#ff6600;font-weight:bold;">👉 認証リンクを開く</a></p>
          <p style="font-size:12px;color:#666;">このコードの有効期限は10分です。</p>
          <hr/>
          <p style="font-size:12px;color:#888;">このメールに心当たりがない場合は破棄してください。<br/>FridgeAI公式: <a href="${BASE_URL}" style="color:#888;">${BASE_URL}</a></p>
        </div>
      `;
    }

    await transport.sendMail({ from: EMAIL_FROM, to: email, subject, text, html });
    console.log("✅ OTP email sent to", email);

    return NextResponse.json({ ok: true, message: "確認コードを送信しました。" });
  } catch (err: any) {
    console.error("send-otp error:", err);
    return NextResponse.json(
      { ok: false, message: err?.message || "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}
