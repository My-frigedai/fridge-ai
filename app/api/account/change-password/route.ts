// app/api/account/change-password/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.sub) {
      return NextResponse.json(
        { error: "認証が必要です。" },
        { status: 401 }
      );
    }

    // クライアントから送られてきたデータを取得
    const { password } = await req.json();
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "パスワードが不正です。" },
        { status: 400 }
      );
    }

    // パスワードのハッシュ化
    const hashed = await bcrypt.hash(password, 10);

    // DB 更新
    await prisma.user.update({
      where: { id: token.sub },
      data: { password: hashed },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("change password error:", err);
    return NextResponse.json(
      { error: "パスワード変更に失敗しました。" },
      { status: 500 }
    );
  }
}
