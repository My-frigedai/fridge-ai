// app/api/account/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.sub) {
      return NextResponse.json(
        { error: "ログインが必要です" },
        { status: 401 }
      );
    }

    await prisma.user.delete({
      where: { id: token.sub },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("delete account error:", err);
    return NextResponse.json(
      { error: "アカウント削除に失敗しました" },
      { status: 500 }
    );
  }
}
