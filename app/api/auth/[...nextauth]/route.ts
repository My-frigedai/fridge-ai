// app/api/auth/[...nextauth]/route.ts
export const runtime = "nodejs";

import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    // --- Google OAuth ---
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),

    // --- Email Magic Link (唯一のメール認証) ---
    EmailProvider({
      server: {
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: Number(process.env.EMAIL_PORT || 587) === 465,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),

    // --- Credentials (email + password) ---
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

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

  // --- Session ---
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  // --- Pages ---
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-request",
    error: "/login?error",
  },

  // --- Callbacks ---
  callbacks: {
    async signIn({ user, account }) {
      if (!user?.id) return false;

      // Email magic link は NextAuth に完全委任
      if (account?.provider === "email") {
        return true;
      }

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

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== "production",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
