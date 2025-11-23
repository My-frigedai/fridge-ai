// app/api/auth/verify-otp/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("verify-otp JSON parse error:", parseErr);
      return NextResponse.json(
        { ok: false, message: "リクエスト形式が不正です。" },
        { status: 400 }
      );
    }

    console.log("verify-otp body:", body);
    const { email, code } = body ?? {};

    if (!email || !code) {
      return NextResponse.json(
        { ok: false, message: "メールアドレスと確認コードを入力してください。" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.verifyCode || !user.verifyExpires) {
      return NextResponse.json(
        { ok: false, message: "確認コードが無効です。" },
        { status: 400 }
      );
    }

    if (new Date() > new Date(user.verifyExpires)) {
      return NextResponse.json(
        { ok: false, message: "確認コードの有効期限が切れています。" },
        { status: 400 }
      );
    }

    if (String(user.verifyCode) !== String(code)) {
      return NextResponse.json(
        { ok: false, message: "確認コードが一致しません。" },
        { status: 400 }
      );
    }

    try {
      await prisma.user.update({
        where: { email },
        data: {
          verifyCode: null,
          verifyToken: null,
          verifyExpires: null,
          emailVerified: new Date(),
          status: "active",
        },
      });
    } catch (dbErr) {
      console.error("Prisma update error (verify-otp):", dbErr);
      return NextResponse.json(
        { ok: false, message: "サーバーのデータ保存でエラーが発生しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "確認が完了しました。" });
  } catch (err: any) {
    console.error("verify-otp top-level error:", err);
    return NextResponse.json(
      { ok: false, message: "サーバー内部でエラーが発生しました。" },
      { status: 500 }
    );
  }
}
