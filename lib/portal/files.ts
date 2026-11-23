// Private client files (reports, invoices, update attachments) in the R2
// bucket bound as CLIENT_FILES (tbj-client-files, wrangler.jsonc). The bucket
// has no public access and no custom domain: files leave it only through
// /api/portal/files/[id] (the signed-in client, scoped to their clientId) and
// /api/admin/client-files/[id] (staff with CLIENT_MANAGEMENT).
//
// Keys are clients/{clientId}/{uuid}. Only the key is stored in the database.
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

// Declared type -> the bytes it must start with. Checking the bytes means a
// renamed HTML or SVG file can't be stored as a "PDF".
const ALLOWED: Record<string, { ext: string; magic: number[][] }> = {
  "application/pdf": { ext: "pdf", magic: [[0x25, 0x50, 0x44, 0x46, 0x2d]] }, // %PDF-
  "image/png": { ext: "png", magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  "image/jpeg": { ext: "jpg", magic: [[0xff, 0xd8, 0xff]] },
};

type R2Object = { body: ReadableStream; size: number; httpMetadata?: { contentType?: string } };
export type ClientFilesBucket = {
  put(key: string, value: ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
};

/** The private bucket, or null outside Cloudflare (next dev) or if the binding is missing. */
export function getClientFilesBucket(): ClientFilesBucket | null {
  try {
    return ((getCloudflareContext().env as unknown as { CLIENT_FILES?: ClientFilesBucket }).CLIENT_FILES ?? null) as ClientFilesBucket | null;
  } catch {
    return null;
  }
}

export type UploadCheck = { ok: true; contentType: string; bytes: Uint8Array } | { ok: false; error: string };

/** PDF, PNG or JPG, at most 20 MB, and the bytes must match the declared type. */
export async function checkUpload(file: unknown): Promise<UploadCheck> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file" };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "The file is larger than 20 MB" };
  const rule = ALLOWED[file.type];
  if (!rule) return { ok: false, error: "Only PDF, PNG and JPG files can be uploaded" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!rule.magic.some((m) => m.every((b, i) => bytes[i] === b))) return { ok: false, error: "The file doesn't look like a real PDF, PNG or JPG" };
  return { ok: true, contentType: file.type, bytes };
}

export function clientFileKey(clientId: string): string {
  return `clients/${clientId}/${crypto.randomUUID()}`;
}

/** True when `key` is inside this client's own folder. Checked again at download time. */
export function isClientKey(clientId: string, key: string): boolean {
  return key.startsWith(`clients/${clientId}/`) && !key.includes("..");
}

/** Stores a checked upload; returns its key. Throws if the bucket is missing or the write fails. */
export async function storeClientFile(clientId: string, upload: { contentType: string; bytes: Uint8Array }): Promise<string> {
  const bucket = getClientFilesBucket();
  if (!bucket) throw new Error("CLIENT_FILES bucket is not bound");
  const key = clientFileKey(clientId);
  await bucket.put(key, upload.bytes, { httpMetadata: { contentType: upload.contentType } });
  return key;
}

/** Best effort: a leftover object is harmless (private, unreferenced). */
export async function deleteClientFile(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await getClientFilesBucket()?.delete(key);
  } catch (error) {
    console.error("[client-files] delete failed:", error);
  }
}

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function fileError(status: 401 | 403 | 404, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

/** A download response for `key`, named `name` (extension follows the stored type). 404 if the object is gone. */
export async function serveClientFile(key: string, name: string): Promise<Response> {
  const object = await getClientFilesBucket()?.get(key);
  if (!object) return fileError(404, "File not found");
  const contentType = object.httpMetadata?.contentType && ALLOWED[object.httpMetadata.contentType] ? object.httpMetadata.contentType : "application/octet-stream";
  const ext = ALLOWED[contentType]?.ext;
  const base = name.replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 100) || "file";
  const filename = ext ? `${base}.${ext}` : base;
  return new Response(object.body, {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(object.size),
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export type ReportMetric = { label: string; value: string; change?: string };

/** Up to 4 headline numbers typed by staff: [{ label, value, change? }], short plain text only. Empty = none. */
export function parseReportMetrics(raw: unknown): { ok: true; metrics: ReportMetric[] | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, metrics: null };
  let data: unknown;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { ok: false, error: "Headline numbers are not valid" };
  }
  if (!Array.isArray(data)) return { ok: false, error: "Headline numbers are not valid" };
  if (data.length > 4) return { ok: false, error: "At most 4 headline numbers" };
  const out: ReportMetric[] = [];
  const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;
  for (const item of data) {
    const m = item as Record<string, unknown>;
    if (!m || typeof m !== "object" || !text(m.label, 40) || !text(m.value, 40)) return { ok: false, error: "Each headline number needs a short label and value" };
    if (m.change !== undefined && m.change !== "" && !text(m.change, 20)) return { ok: false, error: "The change must be short text, e.g. +12%" };
    out.push({ label: (m.label as string).trim(), value: (m.value as string).trim(), ...(typeof m.change === "string" && m.change.trim() ? { change: m.change.trim() } : {}) });
  }
  return { ok: true, metrics: out.length ? out : null };
}
