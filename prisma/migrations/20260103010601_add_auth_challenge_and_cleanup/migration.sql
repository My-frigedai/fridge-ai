-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challenge" TEXT NOT NULL,
    "userId" TEXT,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthChallenge_challenge_key" ON "AuthChallenge"("challenge");
