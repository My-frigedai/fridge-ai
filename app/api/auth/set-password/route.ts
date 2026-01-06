// app/api/auth/set-password/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const PENDING_EXP_MS = Number(
  process.env.PENDING_EXP_MS || 1000 * 60 * 60 * 24,
); // 24h
const RESEND_COOLDOWN_MS = Number(process.env.RESEND_COOLDOWN_MS || 60 * 1000); // 60s

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function maskEmail(email: string) {
  try {
    const [local, domain] = String(email).split("@");
    if (!domain) return "***";
    if (local.length <= 1) return `*@${domain}`;
    return `${local[0]}***@${domain}`;
  } catch {
    return "***";
  }
}

function makeTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 587);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!host || !user || !pass) {
    // 詳細は控える。デプロイ前に env を確認すること。
    throw new Error("メール送信環境が未設定です");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.EMAIL_SECURE === "true",
    auth: { user, pass },
  });
}

/** HTML + plain テキストでプロっぽいメールを作る */
function buildVerificationEmail(to: string, verificationUrl: string) {
  const subject = "My-FridgeAI — メールアドレスを確認してください";
  const plain = [
    `My-FridgeAI にご登録いただきありがとうございます。`,
    ``,
    `以下のリンクをクリックしてメールアドレスの確認を完了してください:`,
    verificationUrl,
    ``,
    `このリンクは ${Math.round(PENDING_EXP_MS / 3600000)} 時間有効です。`,
    ``,
    `この操作を行っていない場合は、このメールを無視してください。`,
    ``,
    `— My-FridgeAI チーム`,
  ].join("\n");

  const html = `
  <div style="font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111; line-height:1.5;">
    <div style="max-width:680px;margin:0 auto;padding:24px;">
      <header style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
        <div style="width:48px;height:48px;border-radius:8px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">MF</div>
        <div>
          <h1 style="margin:0;font-size:18px;">My-FridgeAI</h1>
          <div style="color:#666;font-size:13px;">登録メールアドレスの確認</div>
        </div>
      </header>

      <p>My-FridgeAI にご登録いただきありがとうございます。下のボタンをクリックしてメールアドレスの確認を完了してください。</p>

      <p style="text-align:center;margin:28px 0;">
        <a href="${verificationUrl}" style="background:#111;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block;">
          メールアドレスを確認して続行する
        </a>
      </p>

      <p style="color:#666;font-size:13px;">リンクをクリックできない場合は、以下のURLをコピーしてブラウザに貼り付けてください。</p>
      <p style="word-break:break-all;color:#0b5fff">${verificationUrl}</p>

      <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
      <p style="color:#888;font-size:12px;">このメールには返信できません。ご不明点はサポートまでご連絡ください。</p>
    </div>
  </div>
  `;

  return { subject, plain, html };
}

async function sendVerificationEmailSafe(to: string, verificationUrl: string) {
  const transporter = makeTransporter();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || "";
  // ログは機密情報を出さない
  console.info("[mail] sending verification", {
    to: maskEmail(to),
    fromConfigured: !!from,
  });

  const { subject, plain, html } = buildVerificationEmail(to, verificationUrl);
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text: plain,
    html,
  });

  console.info("[mail] sent", {
    to: maskEmail(to),
    messageId: info?.messageId ?? null,
  });
  return info;
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

    // 既存ユーザーチェック
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        {
          ok: false,
          message: "そのメールは既に使用されています。ログインしてください。",
          code: "USER_EXISTS",
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const existingPending = await prisma.pendingUser.findUnique({
      where: { email },
    });

    // 既存 pending がまだ有効なら「再送」フロー（クールダウンあり）
    if (existingPending && existingPending.expiresAt > now) {
      const lastEv = await prisma.emailVerification.findFirst({
        where: { pendingUserId: existingPending.id },
        orderBy: { createdAt: "desc" },
      });

      if (
        lastEv &&
        now.getTime() - (lastEv.createdAt?.getTime() ?? 0) < RESEND_COOLDOWN_MS
      ) {
        return NextResponse.json(
          {
            ok: false,
            message: "確認メールの再送は少し時間をおいてから行ってください。",
            code: "RESEND_COOLDOWN",
          },
          { status: 429 },
        );
      }

      // 新しい plain token を生成して DB と verification を更新
      const newPlainToken = crypto.randomBytes(32).toString("hex");
      const newTokenHash = hashToken(newPlainToken);
      const newExpiresAt = new Date(Date.now() + PENDING_EXP_MS);

      console.info("[set-password] resend requested", {
        email: maskEmail(email),
        pendingId: existingPending.id,
      });

      try {
        await prisma.$transaction(async (tx) => {
          await tx.pendingUser.update({
            where: { id: existingPending.id },
            data: { token: newTokenHash, expiresAt: newExpiresAt },
          });

          await tx.emailVerification.create({
            data: {
              pendingUserId: existingPending.id,
              tokenHash: newTokenHash,
              code: newPlainToken.slice(0, 8),
              expiresAt: newExpiresAt,
            },
          });
        });
      } catch (dbErr) {
        console.error(
          "[set-password] db error during resend (no secret output)",
          { err: String(dbErr) },
        );
        return NextResponse.json(
          { ok: false, message: "サーバーエラーが発生しました。" },
          { status: 500 },
        );
      }

      // 送信（リンクはフロントページへのもの）
      const verificationUrl = `${BASE_URL}/verify-email?token=${encodeURIComponent(newPlainToken)}`;
      try {
        await sendVerificationEmailSafe(email, verificationUrl);
        return NextResponse.json({ ok: true, resent: true }, { status: 200 });
      } catch (mailErr) {
        console.error(
          "[set-password] mail send failed during resend (no secret output)",
          { err: String(mailErr), email: maskEmail(email) },
        );
        await prisma.emailVerification
          .deleteMany({
            where: { pendingUserId: existingPending.id, used: false },
          })
          .catch(() => null);
        return NextResponse.json(
          {
            ok: false,
            message:
              "確認メールの送信に失敗しました。後ほど再試行してください。",
          },
          { status: 500 },
        );
      }
    }

    // expired の場合は一度削除して新規作成
    if (existingPending && existingPending.expiresAt <= now) {
      await prisma.pendingUser.delete({ where: { id: existingPending.id } });
    }

    // ハッシュ化
    const roundsEnv = Number(
      process.env.BCRYPT_SALT_ROUNDS || process.env.SALT_ROUNDS || 12,
    );
    const saltRounds =
      Number.isFinite(roundsEnv) && roundsEnv > 0
        ? Math.max(8, Math.min(20, roundsEnv))
        : 12;
    const passwordHash = await hash(password, saltRounds);

    // token (plain) と hash を生成
    const plainToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(plainToken);
    const expiresAt = new Date(Date.now() + PENDING_EXP_MS);

    // トランザクションで pending + verification を作成
    let pending;
    try {
      await prisma.$transaction(async (tx) => {
        const p = await tx.pendingUser.create({
          data: {
            email,
            name,
            password: passwordHash,
            token: tokenHash,
            expiresAt,
          },
          select: { id: true, email: true },
        });
        pending = p;

        await tx.emailVerification.create({
          data: {
            pendingUserId: p.id,
            tokenHash,
            code: plainToken.slice(0, 8),
            expiresAt,
          },
        });
      });
    } catch (dbErr) {
      console.error("[set-password] db create failed (no secret output)", {
        err: String(dbErr),
      });
      return NextResponse.json(
        { ok: false, message: "サーバーエラーが発生しました。" },
        { status: 500 },
      );
    }

    // メール送信
    const verificationUrl = `${BASE_URL}/verify-email?token=${encodeURIComponent(plainToken)}`;
    try {
      await sendVerificationEmailSafe(email, verificationUrl);
    } catch (sendErr) {
      console.error("[set-password] email send failed (no secret output)", {
        err: String(sendErr),
        email: maskEmail(email),
      });
      // cleanup: pending + un-used verifications
      try {
        await prisma.$transaction(async (tx) => {
          await tx.emailVerification.deleteMany({
            where: { pendingUserId: pending!.id, used: false },
          });
          await tx.pendingUser.delete({ where: { id: pending!.id } });
        });
      } catch (cleanupErr) {
        console.error("[set-password] cleanup failed (no secret output)", {
          err: String(cleanupErr),
        });
      }
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
    console.error("[set-password] unexpected error (no secret output)", {
      err: String(err),
    });
    return NextResponse.json(
      { ok: false, message: "サーバーエラーが発生しました。" },
      { status: 500 },
    );
  }
}
