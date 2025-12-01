// app/api/auth/webauthn/authenticate-options/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail } = body ?? {};

    if (!rawEmail) {
      return NextResponse.json({ ok: false, message: "email required" }, { status: 400 });
    }

    const email = String(rawEmail).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ ok: false, message: "no such user" }, { status: 404 });
    }

    const passkeys = await prisma.passkey.findMany({ where: { userId: user.id } });

    if (!passkeys || passkeys.length === 0) {
      return NextResponse.json({ ok: false, message: "no passkeys" }, { status: 400 });
    }

    const rpID = process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, "") || "localhost";

    const allowedCredentials = passkeys.map((pk) => ({
      id: pk.credentialId,
      type: "public-key",
      transports: pk.transports ? JSON.parse(pk.transports) : undefined,
    }));

    // ← await を追加
    const opts = await generateAuthenticationOptions({
      rpID,
      timeout: 60000,
      allowCredentials: allowedCredentials,
      userVerification: "preferred",
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: opts.challenge },
    });

    return NextResponse.json({ ok: true, options: opts });
  } catch (err: any) {
    console.error("webauthn authenticate-options error:", err);
    return NextResponse.json({ ok: false, message: "server error" }, { status: 500 });
  }
}
