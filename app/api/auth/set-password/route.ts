// app/api/auth/set-password/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

/**
 * POST /api/auth/set-password
 * Body: { email: string, password: string, name?: string }
 *
 * Behavior:
 *  - This endpoint is for NEW account creation only.
 *  - If a user with the provided email already exists, it returns 409 and a clear message.
 *  - It does NOT overwrite existing users' passwords (prevents accidental overwrite).
 *  - For password resets / updates, implement a separate endpoint (recommended).
 */

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    // Check existence first — DO NOT overwrite existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Return informative message so user knows what to do next
      return NextResponse.json(
        {
          ok: false,
          message:
            "そのメールアドレスは既に登録されています。ログインするか、パスワードをお忘れの場合はパスワードリセットを行ってください。",
          // optional: include action hint codes (client may use to show buttons)
          code: "USER_EXISTS",
        },
        { status: 409 },
      );
    }

    // Hash password (bcrypt rounds configurable via env)
    const roundsEnv = Number(
      process.env.BCRYPT_SALT_ROUNDS || process.env.SALT_ROUNDS || 0,
    );
    const saltRounds =
      Number.isFinite(roundsEnv) && roundsEnv > 0
        ? Math.max(8, Math.min(20, roundsEnv))
        : 12;

    const passwordHash = await hash(password, saltRounds);

    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || undefined,
        password: passwordHash,
        status: "active",
        // emailVerified left null — verification flow should set this later
      },
      select: { id: true, email: true },
    });

    return NextResponse.json({ ok: true, userId: user.id }, { status: 200 });
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
