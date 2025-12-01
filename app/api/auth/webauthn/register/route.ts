// app/api/auth/webauthn/register/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyRegistrationResponse,
  VerifiedRegistrationResponse,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

/** Helper: base64url -> base64 */
function base64urlToBase64(b64url: string): string {
  let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  return s;
}

/** Helper: ArrayBuffer/ArrayBufferView/Uint8Array/Buffer -> Buffer */
function toBuffer(input: ArrayBuffer | ArrayBufferView | Buffer | Uint8Array): Buffer {
  return Buffer.from(input as any);
}

/** Helper: Buffer -> base64url (no padding) */
function bufferToBase64url(buf: Buffer): string {
  const b64 = buf.toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Required origin (strict) */
const ORIGIN = process.env.NEXT_PUBLIC_BASE_URL;
if (!ORIGIN) {
  throw new Error("Environment variable NEXT_PUBLIC_BASE_URL is required.");
}
const expectedOrigin = ORIGIN;
const rpID = ORIGIN.replace(/^https?:\/\//, "");

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

    const expectedChallenge = String(user.verifyToken);

    // Cast incoming attestation to RegistrationResponseJSON for library
    const attestationJSON = attestationResponse as RegistrationResponseJSON;

    // Verify registration
    const verification = (await verifyRegistrationResponse({
      response: attestationJSON,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    })) as VerifiedRegistrationResponse;

    if (!verification.verified) {
      return NextResponse.json({ ok: false, message: "registration verification failed" }, { status: 400 });
    }

    const registrationInfo = (verification as any).registrationInfo;
    if (!registrationInfo) {
      return NextResponse.json({ ok: false, message: "missing registration info" }, { status: 500 });
    }

    // We'll extract credential bytes and counter robustly across possible shapes.
    let credentialIDBuf: Buffer | null = null;
    let publicKeyBuf: Buffer | null = null;
    let signCount = Number((registrationInfo as any).counter ?? 0);
    let transports: unknown[] = [];

    // Case A: older shape where registrationInfo has credentialID / credentialPublicKey directly
    if ("credentialID" in registrationInfo && "credentialPublicKey" in registrationInfo) {
      try {
        credentialIDBuf = toBuffer((registrationInfo as any).credentialID);
        publicKeyBuf = toBuffer((registrationInfo as any).credentialPublicKey);
        signCount = Number((registrationInfo as any).counter ?? signCount);
        transports = (registrationInfo as any).transports ?? [];
      } catch (e) {
        console.warn("failed to parse registrationInfo direct fields:", e);
      }
    }

    // Case B: newer shape where there's a `credential` object
    if ((!credentialIDBuf || !publicKeyBuf) && "credential" in registrationInfo) {
      const cred = (registrationInfo as any).credential;
      // credential.rawId or credential.id may exist (rawId is ArrayBuffer/Uint8Array)
      if (cred) {
        if (cred.rawId) {
          credentialIDBuf = toBuffer(cred.rawId);
        } else if (cred.id && typeof cred.id === "string") {
          // cred.id might be base64url or base64 string
          const idStr: string = cred.id;
          const idBase64 = idStr.includes("-") || idStr.includes("_") ? base64urlToBase64(idStr) : idStr;
          credentialIDBuf = Buffer.from(idBase64, "base64");
        }

        // publicKey might be in cred.publicKey or registrationInfo.credentialPublicKey
        if (cred.publicKey) {
          publicKeyBuf = toBuffer(cred.publicKey);
        } else if ((registrationInfo as any).credentialPublicKey) {
          publicKeyBuf = toBuffer((registrationInfo as any).credentialPublicKey);
        }

        signCount = Number(cred.counter ?? (registrationInfo as any).counter ?? signCount);
        transports = cred.transports ?? (registrationInfo as any).transports ?? [];
      }
    }

    // Case C: fallback — some libs may expose buffers in other fields
    if (!credentialIDBuf) {
      if ((registrationInfo as any).rawId) {
        credentialIDBuf = toBuffer((registrationInfo as any).rawId);
      } else {
        // cannot proceed
        console.error("unable to extract credential id from registrationInfo:", registrationInfo);
        return NextResponse.json({ ok: false, message: "failed to extract credential id" }, { status: 500 });
      }
    }
    if (!publicKeyBuf) {
      if ((registrationInfo as any).credentialPublicKey) {
        publicKeyBuf = toBuffer((registrationInfo as any).credentialPublicKey);
      } else {
        console.error("unable to extract publicKey from registrationInfo:", registrationInfo);
        return NextResponse.json({ ok: false, message: "failed to extract public key" }, { status: 500 });
      }
    }

    // Normalize and store:
    const credentialIdBase64url = bufferToBase64url(credentialIDBuf);
    const publicKeyBase64 = publicKeyBuf.toString("base64");

    // Persist into DB
    await prisma.passkey.create({
      data: {
        userId: user.id,
        credentialId: credentialIdBase64url,
        publicKey: publicKeyBase64,
        signCount: Number(signCount),
        transports: JSON.stringify(transports || []),
        name: "Passkey",
      },
    });

    // Clear the one-time challenge
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: null },
    });

    return NextResponse.json({ ok: true, message: "registered" });
  } catch (err: any) {
    console.error("webauthn register error:", err);
    return NextResponse.json({ ok: false, message: "server error" }, { status: 500 });
  }
}
