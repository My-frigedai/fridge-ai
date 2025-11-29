// app/api/auth/[...nextauth]/route.ts
export const runtime = "nodejs";

import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),

    CredentialsProvider({
      id: "credentials",
      name: "Email (password or otp)",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otp: { label: "One-Time Passcode", type: "text" },
      },

      async authorize(credentials) {
        if (!credentials?.email) return null;

        const email = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // ── Password ────────────────────────────────
        if (credentials.password) {
          if (!user.password) return null;

          const ok = await compare(credentials.password, user.password);
          if (!ok) return null;

          return { id: user.id, name: user.name ?? undefined, email: user.email ?? undefined };
        }

        // ── OTP ────────────────────────────────
        if (credentials.otp) {
          const otpRecord = await prisma.otp.findFirst({
            where: { userId: user.id, code: credentials.otp },
            orderBy: { createdAt: "desc" },
          });

          if (!otpRecord || otpRecord.expiresAt < new Date()) return null;

          await prisma.otp.deleteMany({ where: { id: otpRecord.id } });

          return { id: user.id, name: user.name ?? undefined, email: user.email ?? undefined };
        }

        return null;
      },
    }),

    // ── Magic link email ─────────────────────────────
    EmailProvider({
      server: {
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 465),
        secure: Number(process.env.EMAIL_PORT || 465) === 465,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],

  // ── Session ─────────────────────────────
  session: {
    strategy: "jwt", // ← literal type OK！！
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },

  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
