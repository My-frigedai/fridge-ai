// app/api/auth/password/reset/verify/route.ts
export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { createHash } from "crypto";

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { email, token } = await req.json();
    if (!email || !token) return new Response(JSON.stringify({ ok: false }), { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!user) return new Response(JSON.stringify({ ok: false }), { status: 400 });

    const tokenHash = hashToken(String(token));
    const pr = await prisma.passwordReset.findFirst({
      where: { userId: user.id, tokenHash, used: false },
      orderBy: { createdAt: "desc" },
    });

    if (!pr || pr.expiresAt < new Date()) return new Response(JSON.stringify({ ok: false }), { status: 400 });

    return new Response(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error("Password reset verify error:", err);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
}
