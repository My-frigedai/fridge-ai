// app/api/auth/webauthn/register-options/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Passkey } from "@prisma/client";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getWebAuthnRP } from "@/lib/webauthnRP";

/** helpers */
function bufferToBase64url(buf: Buffer | Uint8Array | ArrayBuffer) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf as any);
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function toBuffer(input: unknown): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === "string") {
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    return Buffer.from(b64 + pad, "base64");
  }
  if (input instanceof ArrayBuffer) return Buffer.from(new Uint8Array(input));
  if (ArrayBuffer.isView(input)) return Buffer.from(input as any);
  throw new Error("Unsupported input type");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body ?? {};

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { ok: false, message: "email missing" },
        { status: 400 },
      );
    }

    const emailLower = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "user not found" },
        { status: 404 },
      );
    }

    const existing: Passkey[] = await prisma.passkey.findMany({
      where: { userId: user.id },
    });

    const { rpID } = getWebAuthnRP();
    const userIDBuf = Buffer.from(String(user.id), "utf8");

    const opts = await generateRegistrationOptions({
      rpName: "My-FridgeAI",
      rpID,
      userID: userIDBuf,
      userName: user.email ?? emailLower,
      userDisplayName: user.name ?? user.email ?? emailLower,
      timeout: 60000,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: existing.length
        ? existing.map((p: Passkey) => ({
            id: p.credentialId,
            type: "public-key" as const,
          }))
        : undefined,
    });

    if (!opts?.challenge) {
      return NextResponse.json(
        { ok: false, message: "challenge generation failed" },
        { status: 500 },
      );
    }

    const challengeStr =
      typeof opts.challenge === "string"
        ? opts.challenge
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")
        : bufferToBase64url(toBuffer(opts.challenge));

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: challengeStr },
    });

    const jsonSafeOpts: any = { ...opts, challenge: challengeStr };

    jsonSafeOpts.user = {
      id: bufferToBase64url(userIDBuf),
      name: user.email,
      displayName: user.name ?? user.email,
    };

    if (Array.isArray(jsonSafeOpts.excludeCredentials)) {
      jsonSafeOpts.excludeCredentials = jsonSafeOpts.excludeCredentials.map(
        (c: any) => ({
          ...c,
          id:
            typeof c.id === "string" ? c.id : bufferToBase64url(toBuffer(c.id)),
        }),
      );
    }

    if (!jsonSafeOpts.rpId && rpID) jsonSafeOpts.rpId = rpID;

    return NextResponse.json({ ok: true, options: jsonSafeOpts });
  } catch (err) {
    console.error("[register-options] error:", err);
    return NextResponse.json(
      { ok: false, message: "server error" },
      { status: 500 },
    );
  }
}
