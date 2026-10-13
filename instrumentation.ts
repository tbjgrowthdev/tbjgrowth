import type { Instrumentation } from "next";

// Next's low-level error hook — fires for errors thrown in Server
// Components, Route Handlers, Server Actions, and Middleware, without
// touching any of those call sites individually. Deliberately NOT using
// the Sentry SDK here: this Worker has already broken twice this session
// from new runtime dependencies hitting Cloudflare Workers restrictions
// (WASM compile, persistent-connection reuse), so error capture goes
// through the same plain-fetch-based approach as everything else in
// lib/email.ts rather than adding another SDK to the deploy.
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  const { captureError } = await import("@/lib/error-monitor");
  const error = err as Error & { digest?: string };
  await captureError({
    message: error?.message || String(err),
    stack: error?.stack ?? null,
    path: request?.path ?? null,
    digest: error?.digest ?? null,
    source: "server",
  });
};
