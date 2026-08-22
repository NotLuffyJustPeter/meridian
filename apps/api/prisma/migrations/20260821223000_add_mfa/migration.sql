
CREATE TABLE "totp_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretCiphertext" TEXT NOT NULL,
    "secretIv" TEXT NOT NULL,
    "secretAuthTag" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3),
    "lastUsedTotpCounter" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "totp_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mfa_recovery_codes" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mfa_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "totp_credentials_userId_key" ON "totp_credentials"("userId");
CREATE INDEX "totp_credentials_userId_enabledAt_idx" ON "totp_credentials"("userId", "enabledAt");

CREATE UNIQUE INDEX "mfa_recovery_codes_credentialId_codeHash_key"
ON "mfa_recovery_codes"("credentialId", "codeHash");
CREATE INDEX "mfa_recovery_codes_credentialId_usedAt_idx"
ON "mfa_recovery_codes"("credentialId", "usedAt");

CREATE UNIQUE INDEX "mfa_challenges_tokenHash_key" ON "mfa_challenges"("tokenHash");
CREATE INDEX "mfa_challenges_userId_idx" ON "mfa_challenges"("userId");
CREATE INDEX "mfa_challenges_expiresAt_idx" ON "mfa_challenges"("expiresAt");
CREATE INDEX "mfa_challenges_userId_consumedAt_idx"
ON "mfa_challenges"("userId", "consumedAt");

ALTER TABLE "totp_credentials"
ADD CONSTRAINT "totp_credentials_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mfa_recovery_codes"
ADD CONSTRAINT "mfa_recovery_codes_credentialId_fkey"
FOREIGN KEY ("credentialId") REFERENCES "totp_credentials"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mfa_challenges"
ADD CONSTRAINT "mfa_challenges_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
