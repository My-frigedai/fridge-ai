// app/api/auth/webauthn/authenticate/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Passkey } from "@prisma/client";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getWebAuthnRP } from "@/lib/webauthnRP";
import crypto from "crypto";

/** helpers */
function base64urlToBase64(s: string) {
  let out = s.replace(/-/g, "+").replace(/_/g, "/");
  while (out.length % 4 !== 0) out += "=";
  return out;
}
function normalizeBase64url(input: string | ArrayBuffer | Uint8Array) {
  if (typeof input === "string") {
    // convert to base64url canonical form (no padding)
    return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  // ArrayBuffer/Uint8Array -> base64url
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input as any);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function parsePublicKeyFromStored(stored: string) {
  // stored could be base64 (standard) or base64url; detect and convert to Buffer
  if (stored.includes("-") || stored.includes("_")) {
    const b64 = base64urlToBase64(stored);
    return Buffer.from(b64, "base64");
  } else {
    return Buffer.from(stored, "base64");
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail, assertionResponse } = body ?? {};

    if (!rawEmail || !assertionResponse) {
      return NextResponse.json(
        { ok: false, message: "Missing parameters" },
        { status: 400 },
      );
    }

    const email = String(rawEmail).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.verifyToken) {
      return NextResponse.json(
        { ok: false, message: "No challenge stored" },
        { status: 400 },
      );
    }

    // optional: check expiry if verifyExpires is present
    if (user.verifyExpires && new Date() > user.verifyExpires) {
      return NextResponse.json(
        { ok: false, message: "Challenge expired" },
        { status: 400 },
      );
    }

    const passkeys: Passkey[] = await prisma.passkey.findMany({
      where: { userId: user.id },
    });
    if (passkeys.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No passkeys" },
        { status: 400 },
      );
    }

    const assertionIdRaw = (assertionResponse as any).id;
    if (
      !assertionIdRaw ||
      (typeof assertionIdRaw !== "string" &&
        !(assertionIdRaw instanceof ArrayBuffer))
    ) {
      return NextResponse.json(
        { ok: false, message: "Invalid assertion id" },
        { status: 400 },
      );
    }

    // normalize incoming assertion id -> base64url string
    const assertionIdBase64url =
      typeof assertionIdRaw === "string"
        ? normalizeBase64url(assertionIdRaw)
        : normalizeBase64url(
            Buffer.from(assertionIdRaw as ArrayBuffer).toString("base64"),
          );

    // find passkey by credentialId (credentialId in DB assumed base64url)
    const pk = passkeys.find((p) => {
      const dbId = normalizeBase64url(p.credentialId);
      return dbId === assertionIdBase64url;
    });

    if (!pk) {
      console.warn(
        "[authenticate] unknown credential id:",
        assertionIdBase64url,
        "user:",
        user.id,
      );
      return NextResponse.json(
        { ok: false, message: "Unknown credential" },
        { status: 400 },
      );
    }

    const { origin, rpID } = getWebAuthnRP();
    const expectedChallenge = String(user.verifyToken);

    // prepare credential object expected by simplewebauthn
    const credential = {
      id: pk.credentialId, // base64url string OK
      publicKey: parsePublicKeyFromStored(pk.publicKey), // Buffer
      counter: Number(pk.signCount ?? 0),
    };

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertionResponse as any,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential,
      } as any);
    } catch (e: any) {
      console.error(
        "[authenticate] verify error:",
        e && (e.stack || e.message) ? e.stack || e.message : e,
      );
      return NextResponse.json(
        { ok: false, message: e?.message ?? "Verification error" },
        { status: 400 },
      );
    }

    if (!verification || !verification.verified) {
      console.warn("[authenticate] verification failed", verification);
      return NextResponse.json(
        { ok: false, message: "Verification failed" },
        { status: 400 },
      );
    }

    // update signCount safely
    const newCounter = Number(
      (verification.authenticationInfo &&
        verification.authenticationInfo.newCounter) ??
        pk.signCount ??
        0,
    );
    await prisma.passkey.update({
      where: { id: pk.id },
      data: { signCount: newCounter },
    });

    // consume challenge, issue one-time token (short lived) for credentials provider sign-in
    const oneTime = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyToken: null,
        verifyCode: oneTime,
        verifyExpires: expiresAt,
      },
    });

    // return token to client
    return NextResponse.json({ ok: true, token: oneTime }, { status: 200 });
  } catch (err: any) {
    console.error(
      "[authenticate] unexpected error:",
      err && (err.stack || err.message) ? err.stack || err.message : err,
    );
    return NextResponse.json(
      { ok: false, message: "server error" },
      { status: 500 },
    );
  }
}
