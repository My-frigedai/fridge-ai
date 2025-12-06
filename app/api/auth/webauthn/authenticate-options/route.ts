// app/api/auth/webauthn/authenticate-options/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail } = body ?? {};
    if (!rawEmail)
      return NextResponse.json(
        { ok: false, message: "email required" },
        { status: 400 },
      );
    const email = String(rawEmail).toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return NextResponse.json(
        { ok: false, message: "no such user" },
        { status: 404 },
      );

    const passkeys = await prisma.passkey.findMany({
      where: { userId: user.id },
    });
    if (!passkeys || passkeys.length === 0)
      return NextResponse.json(
        { ok: false, message: "no passkeys" },
        { status: 400 },
      );

    const ORIGIN = process.env.NEXT_PUBLIC_BASE_URL;
    if (!ORIGIN) {
      console.error("Missing NEXT_PUBLIC_BASE_URL");
      return NextResponse.json(
        { ok: false, message: "server misconfiguration" },
        { status: 500 },
      );
    }
    let rpID: string;
    try {
      rpID = new URL(ORIGIN).host;
    } catch {
      console.error("Invalid NEXT_PUBLIC_BASE_URL:", ORIGIN);
      return NextResponse.json(
        { ok: false, message: "server misconfiguration" },
        { status: 500 },
      );
    }

    // allowCredentials — ensure id values are base64url strings (they are stored as such)
    const allowCredentials = passkeys.map((pk) => ({
      id: String(pk.credentialId),
      type: "public-key" as const,
      transports: pk.transports ? JSON.parse(pk.transports) : undefined,
    }));

    const opts = await generateAuthenticationOptions({
      rpID,
      timeout: 60000,
      allowCredentials,
      userVerification: "preferred",
    } as any);

    if (!opts || !opts.challenge) {
      console.error("generateAuthenticationOptions returned invalid:", opts);
      return NextResponse.json(
        { ok: false, message: "challenge generation failed" },
        { status: 500 },
      );
    }

    // store challenge
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: String(opts.challenge) },
    });

    // return options directly; ensure allowCredentials ids are strings
    const jsonSafe = { ...opts };
    if (Array.isArray(jsonSafe.allowCredentials))
      jsonSafe.allowCredentials = jsonSafe.allowCredentials.map((c: any) => ({
        ...c,
        id: String(c.id),
      }));
    if (!jsonSafe.rpId && rpID) jsonSafe.rpId = rpID;

    return NextResponse.json({ ok: true, options: jsonSafe });
  } catch (err: any) {
    console.error("webauthn authenticate-options error:", err);
    return NextResponse.json(
      { ok: false, message: "server error" },
      { status: 500 },
    );
  }
}
