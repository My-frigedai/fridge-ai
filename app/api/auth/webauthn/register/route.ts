// app/api/auth/webauthn/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getWebAuthnRP } from "@/lib/webauthnRP";

/**
 * POST /api/auth/webauthn/register
 * body: {
 *   email: string
 *   attestationResponse: RegistrationResponseJSON
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { ok: false, message: "invalid json" },
        { status: 400 },
      );
    }

    const { email: rawEmail, attestationResponse } = body;
    if (!rawEmail || !attestationResponse) {
      return NextResponse.json(
        { ok: false, message: "missing parameters" },
        { status: 400 },
      );
    }

    const email = String(rawEmail).toLowerCase().trim();

    // ユーザー取得
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.verifyToken) {
      return NextResponse.json(
        { ok: false, message: "challenge not found" },
        { status: 400 },
      );
    }

    const expectedChallenge = user.verifyToken;
    const { origin, rpID } = getWebAuthnRP();

    // ---- WebAuthn 検証 ----
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: attestationResponse,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch (err: any) {
      console.error("[webauthn][register] verify error:", err);
      return NextResponse.json(
        { ok: false, message: err?.message ?? "verification failed" },
        { status: 400 },
      );
    }

    if (!verification.verified) {
      return NextResponse.json(
        { ok: false, message: "registration not verified" },
        { status: 400 },
      );
    }

    const registrationInfo = verification.registrationInfo;
    if (!registrationInfo || !registrationInfo.credential) {
      return NextResponse.json(
        { ok: false, message: "missing registration info" },
        { status: 500 },
      );
    }

    const credential = registrationInfo.credential;

    const credentialIdBase64url = Buffer.from(credential.id).toString(
      "base64url",
    );

    const publicKeyBase64 = Buffer.from(credential.publicKey).toString(
      "base64",
    );

    const signCount = credential.counter ?? 0;
    const transports = credential.transports ?? [];

    await prisma.passkey.create({
      data: {
        userId: user.id,
        credentialId: credentialIdBase64url,
        publicKey: publicKeyBase64,
        signCount,
        transports: JSON.stringify(transports),
        name: "Passkey",
      },
    });

    // challenge は必ず破棄（再利用防止）
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webauthn][register] unexpected:", err);
    return NextResponse.json(
      { ok: false, message: "server error" },
      { status: 500 },
    );
  }
}
