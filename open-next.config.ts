import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

// Without these three overrides OpenNext uses "dummy" implementations: nothing
// is ever stored, so every public page view is rendered live (and queries
// Neon) no matter what `revalidate` says. Bindings live in wrangler.jsonc.
export default {
  ...defineCloudflareConfig({
    // Rendered pages are stored in R2; the regional cache keeps a copy in the
    // data center's Cache API so a hit doesn't wait on R2.
    incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
    // Records when revalidatePath() ran, so a cached page older than an admin
    // edit is thrown away on its next request (see lib/revalidate.ts).
    tagCache: d1NextTagCache,
    // Re-renders a page in the background once its `revalidate` window ends.
    queue: doQueue,
  }),
  buildCommand: "npx prisma generate && npx next build",
};
