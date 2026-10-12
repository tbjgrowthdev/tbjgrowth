// The hard guarantee behind Content Locking — the lock banner is just a
// friendly heads-up and can go stale if a tab closes without releasing it,
// but comparing the record's updatedAt against what the form loaded always
// catches an actual conflicting write, lock or no lock.
export function checkStale(expectedUpdatedAt: string | Date | null | undefined, actualUpdatedAt: Date): string | null {
  if (!expectedUpdatedAt) return null;
  const expected = new Date(expectedUpdatedAt).getTime();
  if (expected !== actualUpdatedAt.getTime()) {
    return "This content was changed by someone else since you opened it. Reload the page to see the latest version before saving again.";
  }
  return null;
}
