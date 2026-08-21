
-- Make password credentials optional for federated-only accounts.
ALTER TABLE "users"
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_providerSubject_key"
ON "auth_identities"("provider", "providerSubject");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_userId_provider_key"
ON "auth_identities"("userId", "provider");

-- CreateIndex
CREATE INDEX "auth_identities_userId_idx"
ON "auth_identities"("userId");

-- AddForeignKey
ALTER TABLE "auth_identities"
ADD CONSTRAINT "auth_identities_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
