// app/api/auth/webauthn/authenticate-options/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail } = body ?? {};
    if (!rawEmail) return NextResponse.json({ ok: false, message: "email required" }, { status: 400 });
    const email = String(rawEmail).toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ ok: false, message: "no such user" }, { status: 404 });

    const passkeys = await prisma.passkey.findMany({ where: { userId: user.id } });
    if (!passkeys || passkeys.length === 0) {
      return NextResponse.json({ ok: false, message: "no passkeys" }, { status: 400 });
    }

    const allowedCredentials = passkeys.map(pk => ({
      id: Buffer.from(pk.credentialId, "base64url"),
      type: "public-key",
      transports: pk.transports ? JSON.parse(pk.transports) : undefined,
    }));

    const opts = generateAuthenticationOptions({
      timeout: 60000,
      allowCredentials: allowedCredentials as any,
      userVerification: "preferred",
    });

    // save challenge to user.verifyToken
    await prisma.user.update({ where: { id: user.id }, data: { verifyToken: opts.challenge } });

    return NextResponse.json({ ok: true, options: opts });
  } catch (err: any) {
    console.error("webauthn authenticate-options error:", err);
    return NextResponse.json({ ok: false, message: "server error" }, { status: 500 });
  }
}
