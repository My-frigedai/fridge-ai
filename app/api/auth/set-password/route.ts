// app/api/auth/set-password/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, name } = body ?? {};
    if (!email || !password) return NextResponse.json({ ok: false, message: "email and password required" }, { status: 400 });

    const emailStr = String(email).toLowerCase().trim();
    const nameStr = name ? String(name) : undefined;

    // hash password (bcrypt)
    const hashed = await hash(String(password), 10);

    // create or update user
    const user = await prisma.user.upsert({
      where: { email: emailStr },
      update: { password: hashed, name: nameStr, status: "active" },
      create: { email: emailStr, password: hashed, name: nameStr, status: "active" },
    });

    return NextResponse.json({ ok: true, message: "saved" });
  } catch (err: any) {
    console.error("[set-password] error:", err);
    return NextResponse.json({ ok: false, message: "server error" }, { status: 500 });
  }
}
