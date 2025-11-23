// app/api/register/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "メールとパスワードは必須です" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "すでに登録済みのメールです" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { email, password: hashedPassword },
  });

  return NextResponse.json({ success: true, user });
}
