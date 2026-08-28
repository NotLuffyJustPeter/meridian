export interface PasswordResetJobPayload {
  resetTokenId: string;
  to: string;
  name: string;
  resetUrl: string;
  traceContext: Record<string, string>;
}

export interface EncryptedJobPayload {
  version: 1;
  iv: string;
  authTag: string;
  ciphertext: string;
}
