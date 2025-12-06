// app/api/auth/webauthn/register-options/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateRegistrationOptions } from "@simplewebauthn/server";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (typeof email !== "string" || email.length === 0) {
      return NextResponse.json(
        { ok: false, message: "email missing" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "user not found" },
        { status: 404 },
      );
    }

    const existing = await prisma.passkey.findMany({
      where: { userId: user.id },
    });

    // userID は string → Buffer (Node.js の Uint8Array)
    const userIDBinary = Buffer.from(user.id, "utf8");

    // 🟢 userName / userDisplayName は null を絶対混ぜない（TS対策）
    const safeUserName = typeof user.email === "string" ? user.email : "";

    const safeUserDisplayName =
      typeof user.name === "string"
        ? user.name
        : typeof user.email === "string"
          ? user.email
          : "User";

    // 🟢 excludeCredentials は credentialId を string のまま渡す
    const excludeCredentials = existing.map((pk) => ({
      id: pk.credentialId, // string OK
      type: "public-key" as const,
    }));

    const options = await generateRegistrationOptions({
      rpName: "My-FridgeAI",
      rpID: "localhost",

      userID: userIDBinary,
      userName: safeUserName,
      userDisplayName: safeUserDisplayName,

      excludeCredentials,

      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },

      timeout: 60000,
    });

    // challenge 保存
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken: options.challenge },
    });

    return NextResponse.json({ ok: true, options }, { status: 200 });
  } catch (err: any) {
    console.error("[register-options] error:", err);
    return NextResponse.json(
      { ok: false, message: "server error" },
      { status: 500 },
    );
  }
}
