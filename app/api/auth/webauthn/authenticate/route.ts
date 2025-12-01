// app/api/auth/webauthn/authenticate/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyAuthenticationResponse,
  VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";

/* base64url -> Buffer */
function base64urlToBuffer(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  return Buffer.from(s, "base64");
}

/* Required BASE URL */
const ORIGIN = process.env.NEXT_PUBLIC_BASE_URL;
if (!ORIGIN) throw new Error("NEXT_PUBLIC_BASE_URL is required");

const expectedOrigin = ORIGIN;
const rpID = ORIGIN.replace(/^https?:\/\//, "");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email: rawEmail, assertionResponse } = body;

    if (!rawEmail || !assertionResponse) {
      return NextResponse.json({ ok: false, message: "bad request" }, { status: 400 });
    }

    const email = String(rawEmail).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.verifyToken) {
      return NextResponse.json({ ok: false, message: "no challenge stored" }, { status: 400 });
    }

    const expectedChallenge = user.verifyToken;

    const passkeys = await prisma.passkey.findMany({ where: { userId: user.id } });
    if (!passkeys.length) {
      return NextResponse.json({ ok: false, message: "no passkeys" }, { status: 400 });
    }

    const credId = String(assertionResponse.id);
    const pk = passkeys.find((p) => p.credentialId === credId);

    if (!pk) {
      return NextResponse.json({ ok: false, message: "unknown credential" }, { status: 400 });
    }

    /* Prepare authenticator */
    const authenticator = {
      credentialID: base64urlToBuffer(pk.credentialId),
      credentialPublicKey: Buffer.from(pk.publicKey, "base64"),
      counter: Number(pk.signCount || 0),
    };

    /* ----------------------------- IMPORTANT -----------------------------
     * simplewebauthn v10+
     * authenticator は 第2引数 で渡す！
     * ------------------------------------------------------------------- */
    const verification = (await verifyAuthenticationResponse(
      {
        response: assertionResponse,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
      },
      authenticator
    )) as VerifiedAuthenticationResponse;

    if (!verification.verified) {
      return NextResponse.json({ ok: false, message: "verification failed" }, { status: 400 });
    }

    // update counter
    const newCounter = verification.authenticationInfo?.newCounter ?? pk.signCount;
    await prisma.passkey.update({
      where: { id: pk.id },
      data: { signCount: Number(newCounter) },
    });

    // one-time challenge clear
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: null },
    });

    return NextResponse.json({ ok: true, userId: user.id, message: "webauthn success" });
  } catch (err) {
    console.error("webauthn authenticate error:", err);
    return NextResponse.json({ ok: false, message: "server error" }, { status: 500 });
  }
}
