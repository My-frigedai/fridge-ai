// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

console.log("🗂 Using DATABASE_URL:", process.env.DATABASE_URL); // デバッグ用ログ

// 型を拡張して global に prisma をキャッシュ
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query", "error", "warn"], // ログ設定
  });

// 開発環境では Hot Reload 時に再生成されないようにキャッシュ
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// 起動時に接続を試みる（Engine is not yet connected 対策）
async function initPrisma() {
  try {
    await prisma.$connect();
    console.log("✅ Prisma Client connected");
  } catch (err) {
    console.error("❌ Failed to connect Prisma Client:", err);
  }
}

// すぐに初期化を呼ぶ
initPrisma();

export default prisma;
