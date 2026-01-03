// types/next-auth.d.ts
import NextAuth from "next-auth";
import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      emailVerified?: Date | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    emailVerified?: Date | null;
  }
}
