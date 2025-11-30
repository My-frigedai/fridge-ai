// app/api/register/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

const PASSWORD_POLICY = {
  minLen: 12,
  regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?`~]).+$/,
};

function validatePassword(pw: string) {
  if (typeof pw !== "string") return "パスワードの形式が不正です。";
  if (pw.length < PASSWORD_POLICY.minLen) return `パスワードは${PASSWORD_POLICY.minLen}文字以上にしてください。`;
  if (!PASSWORD_POLICY.regex.test(pw))
    return "パスワードには大文字・小文字・数字・記号を含めてください。";
  return null;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail, password, name } = body ?? {};

    if (!rawEmail || !password) {
      return NextResponse.json({ ok: false, message: "メールとパスワードは必須です" }, { status: 400 });
    }

    const email = String(rawEmail).toLowerCase().trim();

    const v = validatePassword(String(password));
    if (v) return NextResponse.json({ ok: false, message: v }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, message: "このメールアドレスは既に登録されています。" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(String(password), 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: name ? String(name) : undefined,
        password: hashed,
        status: "active",
      },
    });

    return NextResponse.json({ ok: true, message: "登録が完了しました。ログインしてください。" });
  } catch (err: any) {
    console.error("register error:", err);
    return NextResponse.json({ ok: false, message: "サーバーエラー" }, { status: 500 });
  }
}
