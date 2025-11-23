// app/api/account/delete/route.ts
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

    await prisma.user.delete({ where: { id: token.sub } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete account error:", err);
    return NextResponse.json({ error: "アカウント削除に失敗しました" }, { status: 500 });
  }
}
