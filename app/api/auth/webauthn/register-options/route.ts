// app/api/auth/webauthn/register-options/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateRegistrationOptions } from "@simplewebauthn/server";

const rpName = "My-FridgeAI";
const rpID = process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, "") || "localhost";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail, name } = body ?? {};
    if (!rawEmail) return NextResponse.json({ ok: false, message: "email required" }, { status: 400 });
    const email = String(rawEmail).toLowerCase().trim();

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // create minimal user (no password) if not exists
      user = await prisma.user.create({
        data: { email, name: name ? String(name) : undefined, status: "active" },
      });
    }

    const userId = user.id;
    const opts = generateRegistrationOptions({
      rpName,
      rpID,
      userID: userId,
      userName: email,
      timeout: 60000,
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "preferred",
      },
    });

    // save challenge to user.verifyToken temporarily
    await prisma.user.update({
      where: { id: userId },
      data: { verifyToken: opts.challenge },
    });

    return NextResponse.json({ ok: true, options: opts });
  } catch (err: any) {
    console.error("webauthn register-options error:", err);
    return NextResponse.json({ ok: false, message: "server error" }, { status: 500 });
  }
}
