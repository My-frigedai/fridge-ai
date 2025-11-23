// app/api/ingredients/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const userId = token.sub as string;
  const body = await req.json();

  const updated = await prisma.ingredient.updateMany({
    where: { id, userId },
    data: {
      name: body.name,
      quantity: Number(body.quantity || 0),
      unit: body.unit || "個",
      expiry: body.expiry ? new Date(body.expiry) : null,
      category: body.category || "その他",
    }
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "更新できませんでした（権限または存在しないID）" }, { status: 404 });
  }

  const rec = await prisma.ingredient.findUnique({ where: { id } });
  return NextResponse.json({ item: rec });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const userId = token.sub as string;

  await prisma.ingredient.deleteMany({ where: { id, userId } });

  return NextResponse.json({ ok: true });
}
