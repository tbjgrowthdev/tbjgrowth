import { after, NextRequest, NextResponse } from "next/server";
import { AuthError, requirePermission } from "@/lib/auth-guard";
import { AI_STAGE_RUNNERS } from "@/lib/content-pipeline/stage-runners";

export const dynamic = "force-dynamic";

// Runs one AI pipeline stage and streams the outcome back.
//
// Why this is not a plain Server Action: a stage can take minutes (Draft
// is one long AI call, plus a possible JSON-repair call). A Server Action
// keeps one request open and silent for that whole time, and long silent
// requests get dropped on the way (the browser reported
// ERR_QUIC_PROTOCOL_ERROR / "network error"). Here a blank line is written
// every few seconds so the connection is never idle, and the final line
// is the JSON result. If the connection drops anyway, the stage keeps
// running and its AiJob row records the outcome; the wizard polls the job
// list to pick it up.
//
// /api/* is outside middleware.ts's matcher, so auth is checked here, and
// the Origin check stands in for the CSRF protection Server Actions get
// built in.

const HEARTBEAT_MS = 5_000;

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ success: false, error: "Cross-origin request rejected" }, { status: 403 });

  const { id: runId } = await params;
  let stage: unknown;
  try {
    stage = (await req.json())?.stage;
  } catch {
    // handled below
  }
  const runner = typeof stage === "string" ? AI_STAGE_RUNNERS[stage] : undefined;
  if (!runner) return NextResponse.json({ success: false, error: `Unknown pipeline stage "${String(stage)}"` }, { status: 400 });

  try {
    await requirePermission(runner.permission);
  } catch (error) {
    const message = error instanceof AuthError ? error.message : "Authorization check failed";
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }

  // Started outside the stream so it doesn't depend on the client reading
  // it. after() asks the runtime (waitUntil on Cloudflare) to keep the work
  // going for a while if the client disconnects mid-stage.
  const work = runner
    .run(runId)
    .then((result) => ({ success: result.success, error: result.success ? undefined : result.error }))
    .catch((error: unknown) => {
      console.error(`Pipeline stage ${String(stage)} crashed for run ${runId}:`, error);
      return { success: false, error: (error as Error)?.message || "Stage failed" };
    });
  after(() => work);

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // Client went away; the stage itself carries on.
        }
      };
      write("\n");
      heartbeat = setInterval(() => write("\n"), HEARTBEAT_MS);
      work.then((result) => {
        clearInterval(heartbeat);
        write(JSON.stringify(result) + "\n");
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      clearInterval(heartbeat);
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
