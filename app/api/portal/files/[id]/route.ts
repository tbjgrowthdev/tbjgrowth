import { requireClient, ClientAuthError } from "@/lib/portal/auth";
import { getClientFile, type ClientFileKind } from "@/lib/portal/data";
import { fileError, isClientKey, serveClientFile } from "@/lib/portal/files";

// A client's own report, invoice or update attachment: /api/portal/files/{id}?kind=report|invoice|attachment.
// /api is outside middleware.ts, so this checks the session itself.
// Another client's file (or a draft report) is a 404, never a 403, so ids
// can't be probed.
export const dynamic = "force-dynamic";

const KINDS: readonly ClientFileKind[] = ["report", "invoice", "attachment"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireClient();
  } catch (error) {
    if (error instanceof ClientAuthError) return fileError(401, "Please sign in again.");
    throw error;
  }
  const { id } = await params;
  const kind = new URL(request.url).searchParams.get("kind") as ClientFileKind | null;
  if (!kind || !KINDS.includes(kind)) return fileError(404, "File not found");

  const file = await getClientFile(ctx, kind, id);
  // Defence in depth: the key must sit in this client's own folder.
  if (!file || !isClientKey(ctx.clientId, file.fileKey)) return fileError(404, "File not found");
  return serveClientFile(file.fileKey, file.name);
}
