// app/api/auth/verify-email/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token)
      return NextResponse.json(
        { ok: false, message: "token required" },
        { status: 400 },
      );

    const tokenHash = hashToken(token);

    const ev = await prisma.emailVerification.findFirst({
      where: { tokenHash, used: false, expiresAt: { gt: new Date() } },
    });

    if (!ev) {
      // invalid or expired
      // redirect to a friendly page (you can create a client page to show the message)
      const redirectUrl = `${BASE_URL}/verify-request?status=invalid`;
      return NextResponse.redirect(redirectUrl);
    }

    // mark used and set user's emailVerified
    await prisma.emailVerification.update({
      where: { id: ev.id },
      data: { used: true },
    });

    await prisma.user.update({
      where: { id: ev.userId },
      data: { emailVerified: new Date() },
    });

    // redirect user to passkey suggestion page
    const redirectTo = `${BASE_URL}/post-verify?email=${encodeURIComponent((await prisma.user.findUnique({ where: { id: ev.userId } }))?.email ?? "")}`;
    return NextResponse.redirect(redirectTo);
  } catch (err: any) {
    console.error("[verify-email] error:", err);
    return NextResponse.json(
      { ok: false, message: "server error" },
      { status: 500 },
    );
  }
}
