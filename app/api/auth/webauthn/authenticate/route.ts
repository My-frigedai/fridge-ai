// app/api/auth/webauthn/authenticate/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyAuthenticationResponse,
  VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";

const rpID = process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, "") || "localhost";
const expectedOrigin = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail, assertionResponse } = body ?? {};
    if (!rawEmail || !assertionResponse) return NextResponse.json({ ok: false, message: "bad request" }, { status: 400 });

    const email = String(rawEmail).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.verifyToken) return NextResponse.json({ ok: false, message: "no challenge stored" }, { status: 400 });

    const expectedChallenge = user.verifyToken;

    const passkeys = await prisma.passkey.findMany({ where: { userId: user.id } });
    if (!passkeys || passkeys.length === 0) return NextResponse.json({ ok: false, message: "no passkeys" }, { status: 400 });

    // find matching passkey by id in assertionResponse
    const credIdBase64 = Buffer.from(assertionResponse.id, "base64url").toString("base64url");
    const pk = passkeys.find(p => p.credentialId === credIdBase64);
    if (!pk) return NextResponse.json({ ok: false, message: "unknown credential" }, { status: 400 });

    const verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(pk.credentialId, "base64url"),
        credentialPublicKey: Buffer.from(pk.publicKey, "base64"),
        counter: pk.signCount,
      },
    }) as VerifiedAuthenticationResponse;

    if (!verification.verified) {
      return NextResponse.json({ ok: false, message: "verification failed" }, { status: 400 });
    }

    // update signCount
    const newCounter = verification.authenticationInfo?.newCounter ?? pk.signCount;
    await prisma.passkey.update({ where: { id: pk.id }, data: { signCount: Number(newCounter) } });

    // clear challenge
    await prisma.user.update({ where: { id: user.id }, data: { verifyToken: null } });

    // return success with user id to create session client-side
    return NextResponse.json({ ok: true, userId: user.id, message: "webauthn success" });
  } catch (err: any) {
    console.error("webauthn authenticate error:", err);
    return NextResponse.json({ ok: false, message: "server error" }, { status: 500 });
  }
}
