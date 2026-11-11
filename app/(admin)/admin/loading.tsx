// Instant fallback for every /admin/* navigation. It renders inside the
// layout's content area only (sidebar and top bar stay mounted), so the
// router can show it immediately instead of keeping the old page on screen
// while the next one renders on the server.
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true">
        <div className="mb-2 h-8 w-56 rounded-lg bg-border" />
        <div className="mb-6 h-4 w-80 max-w-full rounded-md bg-border/60" />
        <div className="admin-card space-y-4 p-5">
          <div className="h-5 w-40 rounded-md bg-border" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 border-t border-border pt-4">
              <div className="h-4 w-1/3 rounded-md bg-border/70" />
              <div className="h-4 w-1/4 rounded-md bg-border/50" />
              <div className="ml-auto h-4 w-16 rounded-md bg-border/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
