// app/api/auth/webauthn/register-options/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateRegistrationOptions } from "@simplewebauthn/server";

/** Helpers -------------------------------------------------------- */

// to Buffer safely from many inputs
function toBuffer(input: unknown): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === "string") {
    // assume it's base64 or base64url or plain id string:
    // if contains '-' or '_' treat as base64url -> convert to base64 first
    if (/[+-_]/.test(input) && /[_-]/.test(input)) {
      // base64url -> base64
      const b64 = (input as string).replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
      return Buffer.from(b64 + pad, "base64");
    }
    // otherwise assume it's base64 already
    try {
      return Buffer.from(input as string, "base64");
    } catch {
      // fallback: encode as utf8 string buffer
      return Buffer.from(String(input), "utf8");
    }
  }
  if (input instanceof ArrayBuffer) return Buffer.from(new Uint8Array(input));
  if (ArrayBuffer.isView(input)) return Buffer.from((input as ArrayBufferView) as any);
  throw new Error("Unsupported input type for toBuffer");
}

// buffer -> base64url (no padding)
function bufferToBase64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// normalize credentialId-like value -> base64url string (safe)
function normalizeToBase64urlString(v: unknown): string {
  if (typeof v === "string") {
    // if already base64url (contains '-' or '_') return as-is
    if (v.includes("-") || v.includes("_")) return v;
    // if looks like base64, convert to base64url
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(v)) {
      return (v as string).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    // otherwise, return raw string (best-effort)
    return v;
  }
  // Buffer/ArrayBuffer/Uint8Array -> base64url
  const buf = toBuffer(v);
  return bufferToBase64url(buf);
}

/** Config --------------------------------------------------------- */
const rpName = "My-FridgeAI";
const rpID = process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, "") || "localhost";

/** Route ---------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail, name } = body ?? {};
    if (!rawEmail) return NextResponse.json({ ok: false, message: "email required" }, { status: 400 });
    const email = String(rawEmail).toLowerCase().trim();

    // ensure user exists
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name: name ? String(name) : undefined, status: "active" },
      });
    }

    // Build excludeCredentials as base64url strings (library/runtime accepts strings safely)
    const existingPasskeys = await prisma.passkey.findMany({ where: { userId: user.id } });
    const excludeCredentials = existingPasskeys.map((pk) => ({
      id: normalizeToBase64urlString(pk.credentialId), // string (base64url)
      type: "public-key" as const,
      transports: pk.transports ? JSON.parse(pk.transports) : undefined,
    }));

    // userID: use string form (user.id). We'll pass as string (base64url-like if you prefer)
    // This avoids the Uint8Array vs ArrayBuffer generic mismatch on some type defs.
    const userIdForOptions = String(user.id);

    // Build options object (we cast to any when calling generateRegistrationOptions
    // to avoid brittle TS mismatches across simplewebauthn versions).
    const optsPayload = {
      rpName,
      rpID,
      userID: userIdForOptions,
      userName: email,
      timeout: 60000,
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "preferred",
      },
      excludeCredentials: excludeCredentials.length ? excludeCredentials : undefined,
    };

    // Call the library — cast to any to avoid type-level mismatches across versions.
    // At runtime the library expects IDs/challenge as base64/base64url strings or Uint8Arrays;
    // we supply strings (base64url) which are safe and JSON-serializable for the client.
    const opts = (generateRegistrationOptions as any)(optsPayload);

    // Ensure challenge is a string (if lib gives Uint8Array, convert)
    let challengeStr: string;
    if (typeof opts.challenge === "string") {
      challengeStr = opts.challenge;
    } else if (opts.challenge instanceof Uint8Array || opts.challenge instanceof ArrayBuffer) {
      const buf = toBuffer(opts.challenge);
      challengeStr = bufferToBase64url(buf);
    } else {
      // fallback stringify
      challengeStr = String(opts.challenge);
    }

    // persist challenge (one-time) as base64url string
    await prisma.user.update({ where: { id: user.id }, data: { verifyToken: challengeStr } });

    // Return options to client, but ensure binary fields are strings so JSON is safe.
    const jsonSafeOpts: any = { ...opts, challenge: challengeStr };
    if (jsonSafeOpts.user && (jsonSafeOpts.user.id instanceof Uint8Array || jsonSafeOpts.user.id instanceof ArrayBuffer)) {
      jsonSafeOpts.user = { ...jsonSafeOpts.user, id: bufferToBase64url(toBuffer(jsonSafeOpts.user.id)) };
    } else if (jsonSafeOpts.user && typeof jsonSafeOpts.user.id === "string") {
      // leave as-is
    }

    if (Array.isArray(jsonSafeOpts.excludeCredentials)) {
      jsonSafeOpts.excludeCredentials = jsonSafeOpts.excludeCredentials.map((c: any) => {
        let id = c.id;
        if (id instanceof Uint8Array || id instanceof ArrayBuffer) id = bufferToBase64url(toBuffer(id));
        // ensure final id is a string (base64url)
        id = normalizeToBase64urlString(id);
        return { ...c, id };
      });
    }

    return NextResponse.json({ ok: true, options: jsonSafeOpts });
  } catch (err: any) {
    console.error("webauthn register-options error:", err);
    return NextResponse.json({ ok: false, message: "server error" }, { status: 500 });
  }
}
