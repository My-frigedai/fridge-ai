// app/api/auth/webauthn/authenticate/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAuthenticationResponse, VerifiedAuthenticationResponse } from "@simplewebauthn/server";
import crypto from "crypto";

const ORIGIN = process.env.NEXT_PUBLIC_BASE_URL;
const expectedOrigin = ORIGIN ? new URL(ORIGIN).origin : undefined;
const rpID = ORIGIN ? new URL(ORIGIN).host : undefined;

export async function POST(req: Request) {
  try {
    if (!expectedOrigin || !rpID) {
      console.error("env misconfiguration for origin/rpID");
      return NextResponse.json({ ok: false, message: "server misconfiguration" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });

    const { email: rawEmail, assertionResponse } = body as any;
    if (!rawEmail || !assertionResponse) return NextResponse.json({ ok: false, message: "Missing parameters" }, { status: 400 });

    const email = String(rawEmail).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.verifyToken) return NextResponse.json({ ok: false, message: "No challenge stored" }, { status: 400 });
    const expectedChallenge = String(user.verifyToken);

    const passkeys = await prisma.passkey.findMany({ where: { userId: user.id } });
    if (!passkeys || passkeys.length === 0) return NextResponse.json({ ok: false, message: "No passkeys" }, { status: 400 });

    // Determine credential id (normalize to base64url string)
    // client may send rawId or id in base64url; ensure match with DB
    const incomingId = assertionResponse.id ?? assertionResponse.rawId;
    if (!incomingId) return NextResponse.json({ ok: false, message: "Missing credential id" }, { status: 400 });

    // some clients send ArrayBuffer-like; but JSON will typically be base64url string
    const credentialIdBase64url = typeof incomingId === "string" ? incomingId : String(incomingId);

    const pk = passkeys.find((p) => p.credentialId === credentialIdBase64url);
    if (!pk) return NextResponse.json({ ok: false, message: "Unknown credential" }, { status: 400 });

    // Verify assertion
    const verification = (await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    } as any)) as VerifiedAuthenticationResponse;

    if (!verification || !verification.verified) {
      console.error("verifyAuthenticationResponse failed:", verification);
      return NextResponse.json({ ok: false, message: "Verification failed" }, { status: 400 });
    }

    const newCounter = verification.authenticationInfo?.newCounter ?? pk.signCount;
    await prisma.passkey.update({ where: { id: pk.id }, data: { signCount: Number(newCounter) } });

    // clear challenge and issue one-time token (short-lived)
    const oneTime = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: null, verifyCode: oneTime, verifyExpires: expiresAt },
    });

    return NextResponse.json({ ok: true, token: oneTime, message: "webauthn success" });
  } catch (err: any) {
    console.error("webauthn authenticate error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
