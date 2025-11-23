import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.sub) {
      return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }

    const { password } = await req.json();
    const hashed = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: token.sub },
      data: { password: hashed },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("change password error:", err);
    return NextResponse.json({ error: "パスワード変更に失敗しました。" }, { status: 500 });
  }
}
