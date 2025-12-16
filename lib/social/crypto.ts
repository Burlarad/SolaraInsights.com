/**
 * Token Encryption/Decryption for Social OAuth Tokens
 *
 * Uses AES-256-GCM for symmetric encryption.
 * The encryption key should be stored in SOCIAL_TOKEN_ENCRYPTION_KEY env var.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment variables.
 * Must be exactly 32 bytes (256 bits) for AES-256.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;

  if (!key) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY environment variable is not set");
  }

  // Key should be base64-encoded 32 bytes
  const keyBuffer = Buffer.from(key, "base64");

  if (keyBuffer.length !== 32) {
    throw new Error(
      `SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes (256 bits). Got ${keyBuffer.length} bytes.`
    );
  }

  return keyBuffer;
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string containing: IV + ciphertext + auth tag
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Combine: IV (16 bytes) + encrypted data + auth tag (16 bytes)
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, "base64"),
    authTag,
  ]);

  return combined.toString("base64");
}

/**
 * Decrypt an encrypted token string.
 * Input should be base64-encoded string from encryptToken().
 */
export function decryptToken(encryptedData: string): string {
  const key = getEncryptionKey();

  const combined = Buffer.from(encryptedData, "base64");

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

/**
 * Generate a new encryption key (for setup purposes).
 * Run this once and store the result in SOCIAL_TOKEN_ENCRYPTION_KEY.
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("base64");
}
