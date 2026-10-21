import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, the recommended size for GCM

/**
 * INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key — e.g.
 * generated with `openssl rand -base64 32`. Read fresh on every call
 * (not cached at module load) so a key rotation via env var takes effect
 * without a restart being required first in environments that hot-swap
 * env vars; validated strictly so a misconfigured key fails loudly at the
 * point of use rather than silently storing garbage or weak ciphertext.
 */
function getKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured — generate one with `openssl rand -base64 32`");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("INTEGRATION_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded)");
  return key;
}

/** Encrypts an arbitrary JSON-serializable value into "<iv>:<authTag>:<ciphertext>" (each base64). */
export function encryptJson(value: unknown): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/** Inverse of encryptJson. Throws if the key is wrong or the ciphertext was tampered with (GCM auth-tag check) rather than returning corrupted data. */
export function decryptJson<T>(packed: string): T {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = packed.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error("Malformed encrypted credential payload");

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
