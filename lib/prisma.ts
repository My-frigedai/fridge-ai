// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

console.log("🗂 Using DATABASE_URL:", process.env.DATABASE_URL); // デバッグ用

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

async function initPrisma() {
  try {
    await prisma.$connect();
    console.log("✅ Prisma Client connected");
  } catch (err) {
    console.error("❌ Failed to connect Prisma Client:", err);
  }
}
initPrisma();

export default prisma;
