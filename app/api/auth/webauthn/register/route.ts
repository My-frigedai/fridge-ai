// app/api/auth/webauthn/register/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyRegistrationResponse,
  VerifiedRegistrationResponse,
} from "@simplewebauthn/server";

const rpID = process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, "") || "localhost";
const expectedOrigin = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail, attestationResponse } = body ?? {};
    if (!rawEmail || !attestationResponse) {
      return NextResponse.json({ ok: false, message: "bad request" }, { status: 400 });
    }
    const email = String(rawEmail).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.verifyToken) {
      return NextResponse.json({ ok: false, message: "no challenge stored" }, { status: 400 });
    }

    const expectedChallenge = user.verifyToken;

    const verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    }) as VerifiedRegistrationResponse;

    if (!verification.verified) {
      return NextResponse.json({ ok: false, message: "registration verification failed" }, { status: 400 });
    }

    const { registrationInfo } = verification;
    const credentialID = Buffer.from(registrationInfo!.credentialID).toString("base64url");
    const publicKey = registrationInfo!.credentialPublicKey;
    const signCount = registrationInfo!.credentialPublicKey ? Number(registrationInfo!.counter ?? 0) : 0;

    // store passkey
    await prisma.passkey.create({
      data: {
        userId: user.id,
        credentialId,
        publicKey: Buffer.from(publicKey).toString("base64"),
        signCount: signCount,
        transports: JSON.stringify(registrationInfo!.transports || []),
        name: "Passkey",
      },
    });

    // remove stored challenge
    await prisma.user.update({ where: { id: user.id }, data: { verifyToken: null } });

    return NextResponse.json({ ok: true, message: "registered" });
  } catch (err: any) {
    console.error("webauthn register error:", err);
    return NextResponse.json({ ok: false, message: "server error" }, { status: 500 });
  }
}
