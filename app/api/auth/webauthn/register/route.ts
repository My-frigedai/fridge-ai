import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyRegistrationResponse } from "@simplewebauthn/server";

function base64urlToBase64(s: string) {
  let out = s.replace(/-/g, "+").replace(/_/g, "/");
  while (out.length % 4 !== 0) out += "=";
  return out;
}
function toBuffer(input: unknown): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === "string") {
    if (/^[A-Za-z0-9\-_]+$/.test(input)) {
      return Buffer.from(base64urlToBase64(input), "base64");
    }
    if (/^[A-Za-z0-9+/=]+$/.test(input)) {
      return Buffer.from(input, "base64");
    }
    return Buffer.from(String(input), "utf8");
  }
  if (input instanceof ArrayBuffer) return Buffer.from(new Uint8Array(input));
  if (ArrayBuffer.isView(input))
    return Buffer.from(input as ArrayBufferView as any);
  throw new Error("Unsupported input type for toBuffer");
}
function bufferToBase64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const ORIGIN = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
let expectedOrigin: string;
let rpID: string;
try {
  expectedOrigin = new URL(ORIGIN).origin;
  rpID = new URL(ORIGIN).host;
} catch (e) {
  expectedOrigin = ORIGIN;
  rpID = ORIGIN.replace(/^https?:\/\//, "");
  console.error(
    "[register] invalid NEXT_PUBLIC_BASE_URL parsed fallback",
    ORIGIN,
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail, attestationResponse } = body ?? {};
    if (!rawEmail || !attestationResponse) {
      console.error("[register] bad request body:", body);
      return NextResponse.json(
        { ok: false, message: "bad request" },
        { status: 400 },
      );
    }
    const email = String(rawEmail).toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.verifyToken) {
      console.error("[register] no user or no challenge stored for", email);
      return NextResponse.json(
        { ok: false, message: "no challenge stored" },
        { status: 400 },
      );
    }
    const expectedChallenge = String(user.verifyToken);

    const attestationJSON = attestationResponse;

    let verification: any;
    try {
      verification = await verifyRegistrationResponse({
        response: attestationJSON,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
      } as any);
    } catch (vErr: any) {
      console.error(
        "[register] verifyRegistrationResponse threw:",
        vErr && vErr.stack ? vErr.stack : vErr,
      );
      return NextResponse.json(
        {
          ok: false,
          message: `verification error: ${vErr?.message || String(vErr)}`,
        },
        { status: 400 },
      );
    }

    if (!verification || !verification.verified) {
      console.error("[register] verification failed:", verification);
      return NextResponse.json(
        { ok: false, message: "registration verification failed" },
        { status: 400 },
      );
    }

    const registrationInfo = (verification as any).registrationInfo;
    if (!registrationInfo) {
      console.error("[register] missing registrationInfo", verification);
      return NextResponse.json(
        { ok: false, message: "missing registration info" },
        { status: 500 },
      );
    }

    // extract
    let credentialIDBuf: Buffer | null = null;
    let publicKeyBuf: Buffer | null = null;
    let signCount = Number((registrationInfo as any).counter ?? 0);
    let transports: unknown[] = [];

    if (
      "credentialID" in registrationInfo &&
      "credentialPublicKey" in registrationInfo
    ) {
      try {
        credentialIDBuf = toBuffer((registrationInfo as any).credentialID);
        publicKeyBuf = toBuffer((registrationInfo as any).credentialPublicKey);
      } catch (e) {
        console.warn("[register] parse direct fields failed:", e);
      }
    }

    if (
      (!credentialIDBuf || !publicKeyBuf) &&
      "credential" in registrationInfo
    ) {
      const cred = (registrationInfo as any).credential;
      if (cred) {
        if (cred.rawId) credentialIDBuf = toBuffer(cred.rawId);
        else if (cred.id && typeof cred.id === "string")
          credentialIDBuf = Buffer.from(base64urlToBase64(cred.id), "base64");

        if (cred.publicKey) publicKeyBuf = toBuffer(cred.publicKey);
        else if ((registrationInfo as any).credentialPublicKey)
          publicKeyBuf = toBuffer(
            (registrationInfo as any).credentialPublicKey,
          );

        signCount = Number(
          cred.counter ?? (registrationInfo as any).counter ?? signCount,
        );
        transports =
          cred.transports ?? (registrationInfo as any).transports ?? [];
      }
    }

    if (!credentialIDBuf && (registrationInfo as any).rawId)
      credentialIDBuf = toBuffer((registrationInfo as any).rawId);
    if (!publicKeyBuf && (registrationInfo as any).credentialPublicKey)
      publicKeyBuf = toBuffer((registrationInfo as any).credentialPublicKey);

    if (!credentialIDBuf || !publicKeyBuf) {
      console.error("[register] unable to extract credential/publicKey:", {
        credentialIDBuf: !!credentialIDBuf,
        publicKeyBuf: !!publicKeyBuf,
        registrationInfo,
      });
      return NextResponse.json(
        { ok: false, message: "failed to extract credential data" },
        { status: 500 },
      );
    }

    const credentialIdBase64url = bufferToBase64url(credentialIDBuf as Buffer);
    const publicKeyBase64 = publicKeyBuf.toString("base64");

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

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: null },
    });

    console.log("[register] passkey stored for user", user.id);
    return NextResponse.json({ ok: true, message: "registered" });
  } catch (err: any) {
    console.error(
      "[register] unexpected error:",
      err && err.stack ? err.stack : err,
    );
    return NextResponse.json(
      { ok: false, message: "server error (see server logs)" },
      { status: 500 },
    );
  }
}
