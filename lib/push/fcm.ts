import type { PushMessage } from "@/lib/push/messages";

// Firebase Cloud Messaging (HTTP v1) sender that runs inside the Cloudflare
// Worker: no firebase-admin SDK, just fetch + a service-account JWT signed
// with WebCrypto.
//
// Configuration: FCM_SERVICE_ACCOUNT_JSON = the whole service-account key
// file (Firebase console → Project settings → Service accounts → Generate new
// private key) as one string. Without it every send is a logged no-op, so
// a site without Firebase set up keeps working.

export type SendResult = { sent: number; invalidTokens: string[] };

type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };

type SenderDeps = {
  serviceAccountJson: string | undefined;
  fetch: typeof fetch;
  now: () => number;
};

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_LIFETIME_S = 3600;
const REFRESH_MARGIN_MS = 60_000;
const MAX_CONCURRENT = 20;

// FCM error statuses that mean the token will never work again.
const DEAD_TOKEN_STATUSES = new Set(["UNREGISTERED", "NOT_FOUND", "INVALID_ARGUMENT", "SENDER_ID_MISMATCH"]);

function base64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function parseServiceAccount(json: string | undefined): ServiceAccount | null {
  if (!json) return null;
  try {
    const sa = JSON.parse(json) as ServiceAccount;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    return null;
  }
}

function isDeadToken(status: number, body: unknown): boolean {
  if (status === 404) return true;
  const error = (body as { error?: { status?: string; details?: Array<{ errorCode?: string }> } })?.error;
  if (!error) return false;
  if (error.details?.some((d) => d.errorCode && DEAD_TOKEN_STATUSES.has(d.errorCode))) return true;
  return !!error.status && DEAD_TOKEN_STATUSES.has(error.status);
}

export function createFcmSender(deps: SenderDeps) {
  let cached: { token: string; expiresAt: number } | null = null;
  let warned = false;

  async function accessToken(sa: ServiceAccount): Promise<string> {
    if (cached && deps.now() < cached.expiresAt - REFRESH_MARGIN_MS) return cached.token;

    const iat = Math.floor(deps.now() / 1000);
    const tokenUri = sa.token_uri || TOKEN_URI;
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: tokenUri, iat, exp: iat + TOKEN_LIFETIME_S }));
    const key = await crypto.subtle.importKey("pkcs8", pemToPkcs8(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));

    const response = await deps.fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${header}.${claims}.${base64url(signature)}`,
      }).toString(),
    });
    if (!response.ok) throw new Error(`FCM OAuth token exchange failed: HTTP ${response.status}`);
    const json = (await response.json()) as { access_token: string; expires_in?: number };
    cached = { token: json.access_token, expiresAt: deps.now() + (json.expires_in ?? TOKEN_LIFETIME_S) * 1000 };
    return cached.token;
  }

  async function sendOne(sa: ServiceAccount, bearer: string, token: string, msg: PushMessage): Promise<"sent" | "dead" | "failed"> {
    const response = await deps.fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: { url: msg.url },
          android: { priority: "high", notification: { default_sound: true } },
        },
      }),
    });
    if (response.ok) return "sent";
    const body = await response.json().catch(() => null);
    if (isDeadToken(response.status, body)) return "dead";
    console.error(`FCM send failed: HTTP ${response.status}`, body);
    return "failed";
  }

  async function send(tokens: string[], msg: PushMessage): Promise<SendResult> {
    const result: SendResult = { sent: 0, invalidTokens: [] };
    if (tokens.length === 0) return result;
    const sa = parseServiceAccount(deps.serviceAccountJson);
    if (!sa) {
      if (!warned) {
        warned = true;
        console.warn("[push] FCM_SERVICE_ACCOUNT_JSON is not set or invalid; push notifications are disabled.");
      }
      return result;
    }

    const bearer = await accessToken(sa);
    for (let i = 0; i < tokens.length; i += MAX_CONCURRENT) {
      const batch = tokens.slice(i, i + MAX_CONCURRENT);
      const outcomes = await Promise.allSettled(batch.map((t) => sendOne(sa, bearer, t, msg)));
      outcomes.forEach((o, j) => {
        if (o.status === "fulfilled" && o.value === "sent") result.sent++;
        else if (o.status === "fulfilled" && o.value === "dead") result.invalidTokens.push(batch[j]);
        else if (o.status === "rejected") console.error("FCM send threw:", o.reason);
      });
    }
    return result;
  }

  return { send };
}

// The app-wide sender, reading the env lazily per call (Worker secrets are
// runtime-only, not available at module load during the build).
let defaultSender: ReturnType<typeof createFcmSender> | null = null;
let defaultSenderConfig: string | undefined;

export function sendFcm(tokens: string[], msg: PushMessage): Promise<SendResult> {
  const config = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!defaultSender || config !== defaultSenderConfig) {
    defaultSenderConfig = config;
    defaultSender = createFcmSender({ serviceAccountJson: config, fetch: (...args) => fetch(...args), now: Date.now });
  }
  return defaultSender.send(tokens, msg);
}
