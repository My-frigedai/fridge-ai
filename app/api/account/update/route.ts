// app/api/account/update/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.sub) {
      return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
    }

    const { name, email } = await req.json();

    const user = await prisma.user.update({
      where: { id: token.sub },
      data: { name, email },
    });

    return NextResponse.json({ user });
  } catch (err) {
    console.error("update account error:", err);
    return NextResponse.json(
      { error: "更新に失敗しました。" },
      { status: 500 },
    );
  }
}
