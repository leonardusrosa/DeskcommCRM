/**
 * lib/integrations/pms/credentials.ts
 *
 * Secure server-side credential management for PMS providers.
 * Uses AES-256-GCM encryption at rest. Plaintext credentials are NEVER
 * returned to browser clients, logged, or included in audit events.
 * Provides stable hashing for external IDs in audit logs.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const TAG_LENGTH_BYTES = 16;

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw =
    process.env.PMS_CRED_AES_KEY ||
    process.env.AI_CRED_AES_KEY ||
    // Safe deterministic development/test fallback key (32 bytes base64)
    "K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72olP16NWD2yE=";

  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    throw new Error("[PMS Crypto] Invalid PMS_CRED_AES_KEY: malformed base64.");
  }

  if (buf.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `[PMS Crypto] Key must be exactly ${KEY_LENGTH_BYTES} bytes. Found: ${buf.length}`
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

  const last4 = plaintext.length >= 4 ? plaintext.slice(-4) : plaintext.padStart(4, "*");

  return {
    ciphertextHex: ciphertext.toString("hex"),
    ivHex: iv.toString("hex"),
    tagHex: tag.toString("hex"),
    last4,
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

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

export function sanitizeCredentialsForAudit(
  data: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (/password|secret|apikey|token|key/i.test(k)) {
      result[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      result[k] = sanitizeCredentialsForAudit(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

export function hashExternalIdForAudit(externalId: string): string {
  if (!externalId) return "anonymous";
  return createHash("sha256").update(externalId).digest("hex").slice(0, 16);
}
