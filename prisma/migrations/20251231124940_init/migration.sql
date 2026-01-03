/*
  Warnings:

  - You are about to drop the `Account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailVerification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Favorite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Ingredient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Menu` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Passkey` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PasswordReset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TrustedDevice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UsageHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `verifyCode` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `verifyExpires` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `verifyToken` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Account_provider_providerAccountId_key";

-- DropIndex
DROP INDEX "EmailVerification_tokenHash_key";

-- DropIndex
DROP INDEX "Passkey_credentialId_key";

-- DropIndex
DROP INDEX "PasswordReset_tokenHash_key";

-- DropIndex
DROP INDEX "Session_sessionToken_key";

-- DropIndex
DROP INDEX "TrustedDevice_userId_tokenHash_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Account";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "EmailVerification";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Favorite";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Ingredient";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Menu";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Passkey";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PasswordReset";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Session";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TrustedDevice";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "UsageHistory";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "emailVerified" DATETIME
);
INSERT INTO "new_User" ("email", "emailVerified", "id") SELECT "email", "emailVerified", "id" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
