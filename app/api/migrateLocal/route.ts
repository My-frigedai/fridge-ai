// app/api/migrateLocal/route.ts
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma"; 

export async function POST(req: Request) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  
  const userId = token.sub as string;
  const { items } = await req.json();

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "不正なデータ形式です" }, { status: 400 });
  }

  const created = [];
  for (const it of items) {
    try {
      const q = Number(it.quantity || 0) || 0;
      const expiry = it.expiry ? new Date(it.expiry) : null;
      const rec = await prisma.ingredient.create({
        data: {
          userId,
          name: String(it.name || ""),
          quantity: q,
          unit: it.unit || "個",
          expiry,
          category: it.category || "その他",
        },
      });
      created.push(rec);
    } catch (e) {
      console.error("migrate item failed:", e);
    }
  }

  return NextResponse.json({ ok: true, createdCount: created.length, created });
}
