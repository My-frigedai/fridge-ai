// app/api/auth/reset/confirm/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { hash } from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) return NextResponse.json({ ok: false, message: "無効なリクエストです。" }, { status: 400 });

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.NEXTAUTH_SECRET!);
    } catch (err) {
      return NextResponse.json({ ok: false, message: "トークンが無効または期限切れです。" }, { status: 400 });
    }

    const userId = payload.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ ok: false, message: "ユーザーが見つかりません。" }, { status: 404 });

    const hashed = await hash(password, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("reset confirm error:", err);
    return NextResponse.json({ ok: false, message: "サーバーエラーが発生しました。" }, { status: 500 });
  }
}
