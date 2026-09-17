/**
 * Secure server-side PMS credential management.
 * Production/runtime encryption fails closed when no 32-byte base64 key is configured.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const TAG_LENGTH_BYTES = 16;
const TEST_KEY_B64 = "K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72olP16NWD2yE=";

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const configured = process.env.PMS_CRED_AES_KEY || process.env.AI_CRED_AES_KEY;
  const raw = configured || (process.env.NODE_ENV === "test" ? TEST_KEY_B64 : undefined);

  if (!raw) {
    throw new Error(
      "[PMS Crypto] Missing PMS_CRED_AES_KEY. Runtime credential encryption is fail-closed."
    );
  }

  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `[PMS Crypto] Key must be exactly ${KEY_LENGTH_BYTES} bytes after base64 decoding. Found: ${buf.length}`
    );
  }

  cachedKey = buf;
  return buf;
}

export interface EncryptedPmsCredential {
  ciphertextHex: string;
  ivHex: string;
  tagHex: string;
  last4: string;
}

export function encryptPmsSecret(plaintext: string): EncryptedPmsCredential {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("[PMS Crypto] Invalid plaintext provided to encryptPmsSecret");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertextHex: ciphertext.toString("hex"),
    ivHex: iv.toString("hex"),
    tagHex: tag.toString("hex"),
    last4: plaintext.length >= 4 ? plaintext.slice(-4) : plaintext.padStart(4, "*"),
  };
}

export function decryptPmsSecret(encrypted: {
  ciphertextHex: string;
  ivHex: string;
  tagHex: string;
}): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encrypted.ivHex, "hex");
  const tag = Buffer.from(encrypted.tagHex, "hex");
  const ciphertext = Buffer.from(encrypted.ciphertextHex, "hex");

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error("[PMS Crypto] Invalid IV length during decryption");
  }
  if (tag.length !== TAG_LENGTH_BYTES) {
    throw new Error("[PMS Crypto] Invalid authentication tag length during decryption");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function sanitizeCredentialsForAudit(
  data: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (/password|secret|apikey|token|key|ciphertext|credential/i.test(key)) {
      result[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeCredentialsForAudit(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Test helper only; avoids cross-test key cache leakage. */
export function resetPmsCredentialKeyCacheForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("[PMS Crypto] Key cache reset is test-only");
  }
  cachedKey = null;
}
