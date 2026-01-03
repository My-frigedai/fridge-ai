// app/api/migrateLocal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.NEXTAUTH_SECRET) {
      console.error("NEXTAUTH_SECRET is undefined");
      return NextResponse.json(
        { error: "サーバー設定エラー" },
        { status: 500 },
      );
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.sub) {
      return NextResponse.json(
        { error: "ログインが必要です" },
        { status: 401 },
      );
    }

    const userId = token.sub;
    const body = await req.json();
    const items = body.items;

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "不正なデータ形式です" },
        { status: 400 },
      );
    }

    const created = [];
    for (const it of items) {
      try {
        const q = Number(it.quantity || 0);
        const expiry = it.expiry ? new Date(it.expiry) : null;

        const rec = await prisma.ingredient.create({
          data: {
            userId,
            name: String(it.name || ""),
            quantity: q,
            unit: it.unit || "個",
            expiry,
            category: it.category || "その他",
          } as any,
        });

        created.push(rec);
      } catch (e) {
        console.error("migrate item failed:", e, it);
      }
    }

    return NextResponse.json({
      ok: true,
      createdCount: created.length,
      created,
    });
  } catch (err) {
    console.error("migrateLocal error:", err);
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 });
  }
}
