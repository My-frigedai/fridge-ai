export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";

// GET: 食材一覧取得
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const userId = token.sub!;
    const list = await prisma.ingredient.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items: list });
  } catch (e) {
    console.error("ingredients API error:", e);
    return NextResponse.json(
      { error: "食材リストの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: 新規追加
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const userId = token.sub!;
    const body = await req.json();

    const created = await prisma.ingredient.create({
      data: {
        userId,
        name: body.name,
        quantity: Number(body.quantity ?? 0),
        unit: body.unit ?? "個",
        expiry: body.expiry ? new Date(body.expiry) : null,
        category: body.category ?? "その他",
      },
    });

    return NextResponse.json({ item: created });
  } catch (e) {
    console.error("ingredient create error:", e);
    return NextResponse.json(
      { error: "食材の追加に失敗しました" },
      { status: 500 }
    );
  }
}
