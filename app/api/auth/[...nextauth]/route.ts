// app/api/auth/[...nextauth]/route.ts
export const runtime = "nodejs";

import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
// EmailProvider intentionally removed to avoid duplicate emails with custom flow
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";

/**
 * Production-safe NextAuth configuration
 * - EmailProvider removed so NextAuth will NOT send magic-link emails.
 * - Keep Google OAuth and Credentials (email+password) untouched.
 * - Add secure cookie/session defaults suitable for production.
 * - Do not leak secrets in logs (debug disabled in production).
 */

const isProd = process.env.NODE_ENV === "production";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    // Google OAuth (unchanged)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),

    // Credentials (email + password) — keep behavior identical to before
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) return null;
        if (user.status !== "active") return null;
        if (!user.emailVerified) return null;
        if (!user.password) return null;

        const ok = await compare(credentials.password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
        };
      },
    }),
  ],

  // Session: JWT strategy (same as before) with production-friendly cookie settings
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Cookie options: ensure secure flag in production and SameSite Lax (reasonable default)
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProd,
      },
    },
  },

  // Pages — keep the same custom pages
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-request",
    error: "/login?error",
  },

  // Callbacks: keep existing checks but remove special-case for provider === "email"
  callbacks: {
    async signIn({ user, account }) {
      if (!user?.id) return false;

      // For OAuth providers (e.g. Google) we still validate DB state
      // Email magic links handled by custom flow; NextAuth email provider is disabled.
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id as string },
        select: {
          status: true,
          emailVerified: true,
        },
      });

      if (!dbUser) return false;
      if (dbUser.status !== "active") return false;
      if (!dbUser.emailVerified) return false;

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as any).id;
        token.email = (user as any).email;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).userId;
        session.user.email = token.email as string | null;
      }
      return session;
    },
  },

  // Don't enable debug logs in production
  debug: !isProd,

  // Secret must exist in production
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
