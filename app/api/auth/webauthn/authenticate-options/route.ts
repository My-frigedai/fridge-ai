// app/api/auth/webauthn/authenticate-options/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateAuthenticationOptions } from "@simplewebauthn/server";


function getRpOriginAndId() {
  const origin = process.env.NEXT_PUBLIC_BASE_URL;
  if (!origin) {
    throw new Error("Environment variable NEXT_PUBLIC_BASE_URL is required.");
  }
  const rpID = origin.replace(/^https?:\/\//, "");
  return { origin, rpID };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail } = body ?? {};

    if (!rawEmail) {
      return NextResponse.json({ ok: false, message: "email required" }, { status: 400 });
    }

    const email = String(rawEmail).toLowerCase().trim();

    // find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ ok: false, message: "no such user" }, { status: 404 });
    }

    // get passkeys for user
    const passkeys = await prisma.passkey.findMany({ where: { userId: user.id } });
    if (!passkeys || passkeys.length === 0) {
      return NextResponse.json({ ok: false, message: "no passkeys" }, { status: 400 });
    }

    // derive rpID (required by generateAuthenticationOptions)
    let rpID: string;
    try {
      ({ rpID } = getRpOriginAndId());
    } catch (err: any) {
      console.error("webauthn authenticate-options config error:", err?.message ?? err);
      // server misconfigured — fail loudly for admin but do not leak details to client
      return NextResponse.json({ ok: false, message: "server configuration error" }, { status: 500 });
    }

    /**
     * allowedCredentials: simplewebauthn expects IDs as base64url strings (not Node Buffers)
     * We store credentialId in DB as base64url (per your register handler). Use that directly.
     */
    const allowedCredentials = passkeys.map((pk) => ({
      id: pk.credentialId, // base64url string
      type: "public-key" as const,
      transports: pk.transports ? (() => {
        try {
          return JSON.parse(pk.transports);
        } catch {
          return undefined;
        }
      })() : undefined,
    }));

    const opts = generateAuthenticationOptions({
      rpID,
      timeout: 60000,
      allowCredentials: allowedCredentials,
      userVerification: "preferred",
    });

    // persist the challenge (one-time) to verify later
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
