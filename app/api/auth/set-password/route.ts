// app/api/auth/set-password/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const PENDING_EXP_MS = 1000 * 60 * 60 * 24; // 24h

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendVerificationEmail(to: string, token: string) {
  const verificationUrl = `${BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "My-FridgeAI: メールアドレス確認";
  const text = `以下のリンクをクリックしてメールアドレスを確認してください。\n\n${verificationUrl}\n\nリンクは24時間有効です。`;
  // nodemailer transporter (simple)
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: !!(process.env.EMAIL_SECURE === "true"),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = body?.email;
    const rawPassword = body?.password;
    const rawName = body?.name;

    if (!rawEmail || !rawPassword) {
      return NextResponse.json(
        { ok: false, message: "email と password は必須です。" },
        { status: 400 },
      );
    }

    const email = String(rawEmail).toLowerCase().trim();
    const password = String(rawPassword);
    const name = rawName ? String(rawName).trim() : undefined;

    if (!validateEmail(email)) {
      return NextResponse.json(
        { ok: false, message: "有効なメールアドレスを入力してください。" },
        { status: 400 },
      );
    }

    if (
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: `パスワードは${MIN_PASSWORD_LENGTH}文字以上、${MAX_PASSWORD_LENGTH}文字以下で入力してください。`,
        },
        { status: 400 },
      );
    }

    // 既存の確定ユーザーをチェック
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "そのメールアドレスは既に登録されています。ログインするか、パスワードをお忘れの場合はパスワードリセットを行ってください。",
          code: "USER_EXISTS",
        },
        { status: 409 },
      );
    }

    // 既に仮登録があれば確認（期限切れなら削除して先に進む）
    const now = new Date();
    const existingPending = await prisma.pendingUser.findUnique({
      where: { email },
    });

    if (existingPending) {
      if (existingPending.expiresAt > now) {
        // 有効な仮登録がある — 再送 or 案内を促す
        return NextResponse.json(
          {
            ok: false,
            message:
              "指定のメールアドレス宛に既に確認メールを送信しています。メール内のリンクをクリックして確認してください。",
            code: "PENDING_EXISTS",
          },
          { status: 409 },
        );
      } else {
        // 期限切れならクリーンアップして続行
        await prisma.pendingUser.delete({ where: { id: existingPending.id } });
      }
    }

    // ハッシュ化
    const roundsEnv = Number(
      process.env.BCRYPT_SALT_ROUNDS || process.env.SALT_ROUNDS || 0,
    );
    const saltRounds =
      Number.isFinite(roundsEnv) && roundsEnv > 0
        ? Math.max(8, Math.min(20, roundsEnv))
        : 12;

    const passwordHash = await hash(password, saltRounds);

    // トークン発行（メール内のプレーンなトークン）
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);

    // 仮登録作成
    const expiresAt = new Date(Date.now() + PENDING_EXP_MS);
    const pending = await prisma.pendingUser.create({
      data: {
        email,
        name,
        password: passwordHash,
        token: tokenHash,
        expiresAt,
      },
      select: { id: true, email: true },
    });

    // EmailVerification レコード作成（pendingUserId をセット）
    await prisma.emailVerification.create({
      data: {
        pendingUserId: pending.id,
        tokenHash,
        code: token.slice(0, 8), // optional short code
        expiresAt,
      },
    });

    // メール送信（nodemailer）
    try {
      await sendVerificationEmail(email, token);
    } catch (sendErr) {
      console.error("[set-password] email send failed:", sendErr);
      // 送信失敗時は仮登録を消す（冪等性）
      await prisma.pendingUser.delete({ where: { id: pending.id } });
      return NextResponse.json(
        {
          ok: false,
          message:
            "確認メールの送信に失敗しました。メール設定を確認するか、後ほど再試行してください。",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error(
      "[set-password] unexpected error:",
      err && err.stack ? err.stack : err,
    );
    return NextResponse.json(
      { ok: false, message: "サーバーエラーが発生しました。" },
      { status: 500 },
    );
  }
}
