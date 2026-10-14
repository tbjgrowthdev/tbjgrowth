import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";

// otpauth depends only on @noble/hashes (pure JS, no native/WASM) and qrcode
// renders its SVG output with no native canvas dependency — both behave the
// same in local `next dev` and the Cloudflare Worker.

const ISSUER = "TBJ Growth Admin";

function buildTotp(secret: string, label: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

export function generateTwoFactorSecret(email: string) {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const totp = buildTotp(secret, email);
  return { secret, uri: totp.toString() };
}

export async function generateQrCodeSvg(uri: string): Promise<string> {
  return QRCode.toString(uri, { type: "svg", margin: 1, width: 240 });
}

// Allows the previous and next 30s window too, so a slightly-off device
// clock (the single most common real-world TOTP failure) doesn't lock
// someone out.
export function verifyTotpCode(secret: string, code: string, email: string): boolean {
  const totp = buildTotp(secret, email);
  const delta = totp.validate({ token: code.trim(), window: 1 });
  return delta !== null;
}

// Web Crypto's getRandomValues, not Node's `crypto` module — globally
// available in both local `next dev` (Node 19+) and the Cloudflare Worker
// with no compat flag or import needed.
function randomBackupCode(): string {
  const bytes = new Uint8Array(5);
  globalThis.crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase().slice(0, 8);
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, randomBackupCode);
}

export async function hashBackupCodes(codes: string[]): Promise<string> {
  const hashed = await Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
  return JSON.stringify(hashed);
}

// Single-use: on a match, that hash is removed from the stored set and the
// caller (lib/auth.ts) persists the shrunk list, so the same backup code
// can't be replayed.
export async function verifyAndConsumeBackupCode(
  storedJson: string | null,
  inputCode: string
): Promise<{ valid: boolean; remaining: string | null }> {
  if (!storedJson) return { valid: false, remaining: storedJson };

  let hashes: string[];
  try {
    hashes = JSON.parse(storedJson);
  } catch {
    return { valid: false, remaining: storedJson };
  }

  const normalized = inputCode.trim().toUpperCase();
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i])) {
      const remaining = [...hashes.slice(0, i), ...hashes.slice(i + 1)];
      return { valid: true, remaining: JSON.stringify(remaining) };
    }
  }
  return { valid: false, remaining: storedJson };
}
