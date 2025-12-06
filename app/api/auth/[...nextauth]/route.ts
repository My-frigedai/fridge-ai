// app/api/auth/[...nextauth]/route.ts
export const runtime = "nodejs";

import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Email (password or token)",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
        token: { label: "Token", type: "text" }, // one-time token from passkey flow
      },
      async authorize(credentials) {
        // if called with token (from passkey authenticate), accept token-based login
        try {
          if (credentials?.token) {
            const token = String(credentials.token);
            const user = await prisma.user.findFirst({
              where: {
                verifyCode: token,
                verifyExpires: { gt: new Date() }, // not expired
                status: "active",
              },
            });
            if (!user) return null;
            // consume token (one-time)
            await prisma.user.update({
              where: { id: user.id },
              data: { verifyCode: null, verifyExpires: null },
            });
            return { id: user.id, email: user.email, name: user.name ?? undefined };
          }

          // fallback: email/password flow
          if (!credentials?.email || !credentials?.password) return null;
          const email = String(credentials.email).toLowerCase().trim();
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user || !user.password) return null;
          if (user.status !== "active") return null;
          const ok = await compare(String(credentials.password), user.password);
          if (!ok) return null;
          return { id: user.id, email: user.email, name: user.name ?? undefined };
        } catch (err) {
          console.error("CredentialsProvider authorize error:", err);
          return null;
        }
      },
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: Number(process.env.EMAIL_PORT || 465) === 465,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: {
    strategy: "jwt",
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
