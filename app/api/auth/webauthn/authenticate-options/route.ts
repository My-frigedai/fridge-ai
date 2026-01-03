// app/api/auth/webauthn/authenticate-options/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getWebAuthnRP } from "@/lib/webauthnRP";
import type { Passkey } from "@prisma/client";

/** helpers */
function bufferToBase64url(buf: Buffer | Uint8Array | ArrayBuffer) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf as any);
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body ?? {};
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { ok: false, message: "email required" },
        { status: 400 },
      );
    }

    const emailLower = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "no such user" },
        { status: 404 },
      );
    }

    const passkeys: Passkey[] = await prisma.passkey.findMany({
      where: { userId: user.id },
    });
    if (passkeys.length === 0) {
      return NextResponse.json(
        { ok: false, message: "no passkeys" },
        { status: 400 },
      );
    }

    const { rpID } = getWebAuthnRP();

    // Build allowCredentials (we keep credentialId as stored: assumed base64url)
    const allowedCredentials = passkeys.map((pk) => ({
      id: pk.credentialId, // base64url string expected in DB
      type: "public-key" as const,
      transports: pk.transports ? JSON.parse(pk.transports) : undefined,
    }));

    const opts = await generateAuthenticationOptions({
      timeout: 60000,
      rpID,
      allowCredentials: allowedCredentials,
      userVerification: "preferred",
    });

    if (!opts?.challenge) {
      console.error("[authenticate-options] no challenge generated:", opts);
      return NextResponse.json(
        { ok: false, message: "challenge generation failed" },
        { status: 500 },
      );
    }

    // Normalize challenge -> base64url string
    const challengeStr =
      typeof opts.challenge === "string"
        ? opts.challenge
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")
        : bufferToBase64url(opts.challenge as any);

    // store challenge and short expiry on user (so subsequent authenticate verifies it)
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: challengeStr, verifyExpires: expires },
    });

    // Build JSON-safe options (ensure string ids)
    const jsonSafeOpts: any = { ...opts, challenge: challengeStr };
    if (Array.isArray(jsonSafeOpts.allowCredentials)) {
      jsonSafeOpts.allowCredentials = jsonSafeOpts.allowCredentials.map(
        (c: any) => ({
          ...c,
          id:
            typeof c.id === "string"
              ? c.id.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
              : bufferToBase64url(c.id),
        }),
      );
    }

    if (!jsonSafeOpts.rpId && rpID) jsonSafeOpts.rpId = rpID;

    return NextResponse.json(
      { ok: true, options: jsonSafeOpts },
      { status: 200 },
    );
  } catch (err: any) {
    console.error("[authenticate-options] error:", err);
    return NextResponse.json(
      { ok: false, message: "server error" },
      { status: 500 },
    );
  }
}
