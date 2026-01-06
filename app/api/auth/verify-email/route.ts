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
    if (!token) {
      // JSON の場合は JSON を返す（フロント呼び出し）
      const accept = req.headers.get("accept") ?? "";
      if (accept.includes("application/json")) {
        return NextResponse.json(
          { ok: false, message: "token required" },
          { status: 400 },
        );
      }
      return NextResponse.redirect(`${BASE_URL}/verify-request?status=invalid`);
    }

    const tokenHash = hashToken(token);

    const ev = await prisma.emailVerification.findFirst({
      where: { tokenHash, used: false, expiresAt: { gt: new Date() } },
      include: { pendingUser: true, user: true },
    });

    if (!ev) {
      const accept = req.headers.get("accept") ?? "";
      if (accept.includes("application/json")) {
        return NextResponse.json(
          { ok: false, message: "invalid_or_expired" },
          { status: 400 },
        );
      }
      const redirectUrl = `${BASE_URL}/verify-request?status=invalid`;
      return NextResponse.redirect(redirectUrl);
    }

    // mark used
    await prisma.emailVerification.update({
      where: { id: ev.id },
      data: { used: true },
    });

    if (ev.pendingUser) {
      const pending = ev.pendingUser;
      // check existing user with same email
      const existingUser = await prisma.user.findUnique({
        where: { email: pending.email },
      });

      if (existingUser) {
        await prisma.pendingUser.delete({ where: { id: pending.id } });
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { emailVerified: new Date() },
        });

        const accept = req.headers.get("accept") ?? "";
        if (accept.includes("application/json")) {
          return NextResponse.json(
            {
              ok: true,
              action: "verified",
              email: existingUser.email,
              redirect: "/home",
            },
            { status: 200 },
          );
        }
        return NextResponse.redirect(
          `${BASE_URL}/post-verify?email=${encodeURIComponent(existingUser.email ?? "")}`,
        );
      }

      // create real user
      const newUser = await prisma.user.create({
        data: {
          email: pending.email,
          name: pending.name ?? undefined,
          password: pending.password ?? undefined,
          status: "active",
          emailVerified: new Date(),
        },
      });

      // delete pending
      await prisma.pendingUser.delete({ where: { id: pending.id } });

      const accept = req.headers.get("accept") ?? "";
      if (accept.includes("application/json")) {
        return NextResponse.json(
          {
            ok: true,
            action: "created",
            email: newUser.email,
            redirect: "/home",
          },
          { status: 200 },
        );
      }
      return NextResponse.redirect(
        `${BASE_URL}/post-verify?email=${encodeURIComponent(newUser.email ?? "")}`,
      );
    }

    if (ev.user) {
      await prisma.user.update({
        where: { id: ev.userId as string },
        data: { emailVerified: new Date() },
      });
      const accept = req.headers.get("accept") ?? "";
      if (accept.includes("application/json")) {
        return NextResponse.json(
          {
            ok: true,
            action: "updated",
            email: ev.user.email,
            redirect: "/home",
          },
          { status: 200 },
        );
      }
      return NextResponse.redirect(
        `${BASE_URL}/post-verify?email=${encodeURIComponent(ev.user.email ?? "")}`,
      );
    }

    // Fallback
    const accept = req.headers.get("accept") ?? "";
    if (accept.includes("application/json")) {
      return NextResponse.json(
        { ok: false, message: "invalid" },
        { status: 400 },
      );
    }
    return NextResponse.redirect(`${BASE_URL}/verify-request?status=invalid`);
  } catch (err: any) {
    console.error("[verify-email] error (no secret output)", {
      err: String(err),
    });
    return NextResponse.json(
      { ok: false, message: "server error" },
      { status: 500 },
    );
  }
}
