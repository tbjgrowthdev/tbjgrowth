# CMS Workflow

The editorial state machine for Post, Page, and CaseStudy content. Implemented in one place — `lib/workflow.ts` — and reused everywhere a status changes: the per-content admin UI, bulk actions, the AI Content Pipeline's Human Approval stage, and automation rules.

## States

`PostStatus` (`prisma/schema.prisma`) — despite the name, this single enum is shared by Post, Page, and CaseStudy (see "One state machine, three content types" below):

| Status | Meaning |
|---|---|
| `DRAFT` | Being written. Not visible publicly. |
| `REVIEW` | Submitted, waiting on a reviewer. |
| `CHANGES_REQUESTED` | A reviewer sent it back with a required comment. |
| `APPROVED` | Signed off, not yet live or scheduled. |
| `SCHEDULED` | Will auto-publish via a `ScheduledJob` (see `app/(admin)/actions/scheduling.ts`). |
| `PUBLISHED` | Live. `publishedAt` is set the first time content reaches this status and is never touched again by later unpublish/archive — it records when content last went live, not whether it's live now. |
| `ARCHIVED` | Pulled from all the above; can only go back to `DRAFT` via `restore`. |

## Transitions

Every change of status goes through `transitionContent(contentType, id, action, comment?)` in `lib/workflow.ts`, which looks up the action in a fixed table (`TRANSITIONS`):

| Action | From | To | Permission | Comment required |
|---|---|---|---|---|
| `submit` | DRAFT | REVIEW | `CREATE` | |
| `resubmit` | CHANGES_REQUESTED | REVIEW | `EDIT` | |
| `approve` | REVIEW | APPROVED | `APPROVE` | |
| `requestChanges` | REVIEW | CHANGES_REQUESTED | `APPROVE` | yes |
| `reject` | REVIEW | DRAFT | `APPROVE` | yes |
| `schedule` | DRAFT, APPROVED | SCHEDULED | `SCHEDULE` | |
| `publish` | DRAFT, APPROVED, SCHEDULED | PUBLISHED | `PUBLISH` | |
| `unpublish` | PUBLISHED, SCHEDULED | DRAFT | `PUBLISH` | |
| `archive` | PUBLISHED, SCHEDULED, DRAFT, APPROVED | ARCHIVED | `PUBLISH` | |
| `restore` | ARCHIVED | DRAFT | `EDIT` | |

Named verbs rather than a bare "set status to X" on purpose — it matches the admin UI's own vocabulary (Reject / Request Changes / Re-submit), and it lets two different actions land on the same destination status under different rules. `reject` and `unpublish` both end at `DRAFT`, but only `reject` requires `APPROVE` + a comment.

A transition not listed for the content's current status fails with `Cannot {action} content currently in "{status}" status` — `transitionContent` is the only enforcement point; there's no separate guard elsewhere that could drift out of sync with this table.

**Self-submission guard**: for `submit`/`resubmit` specifically, a Contributor (someone without `APPROVE`) may only act on their own content (`current.authorId === session.user.id`). Anyone holding `APPROVE` can act on anything — those roles already manage other people's content by design (see [Permission Matrix](./permission-matrix.md)).

## One state machine, three content types

`transitionContent`, `assignUser`, and `setReviewDeadline` all take a `ContentType` (`POST | PAGE | CASE_STUDY`) and dispatch through a lookup table (`MODEL`) to the matching Prisma delegate (`prisma.post` / `prisma.page` / `prisma.caseStudy`). The three models have incompatible `data` shapes, but the subset `lib/workflow.ts` actually touches (`findUnique`/`update` by id, a record with `status`/`slug`/`publishedAt`/etc.) is identical across all three, expressed as one `WorkflowRecord` type rather than three near-duplicate code paths.

Each content type gets a one-line wrapper in its own actions file for ergonomics, e.g. `app/(admin)/actions/posts.ts`:

```ts
export async function transitionPost(id: string, action: WorkflowAction, comment?: string) {
  return transitionContent("POST", id, action, comment);
}
```

Same pattern for `transitionPage` (`pages.ts`) and `transitionCaseStudy` (`cases.ts`). Editing content through the normal save action never changes `status` as a side effect — status only ever moves through `transitionContent`.

## What a transition actually does

In order, inside `transitionContent`:

1. Validates the action exists, the comment requirement is met, and the caller holds the required permission (`requirePermission`, throws `AuthError` on failure).
2. Loads the current record and checks the self-submission guard and the `from` list.
3. Updates `status` (and `publishedAt` if newly PUBLISHED).
4. Writes an `ApprovalHistory` row (see below).
5. Revalidates the relevant admin and public paths for that content type (`REVALIDATE_PATHS`).
6. If this is the *first* time the content reaches PUBLISHED and it's indexable, pings search engines (`notifySearchEnginesOfUrl`) and fires a `CONTENT_PUBLISHED` automation event (`fireAutomationEvent` — fire-and-forget; it swallows its own errors so a broken automation rule can never block a publish).
7. Writes an audit-log entry (`logAudit`, category `Publishing` or `Approval` depending on the action).

Steps 3 and 4 are two sequential `await`s, not one `$transaction` — see "Implementation note" below.

## ApprovalHistory

`ApprovalHistory` is the audit trail for everything in this document, not just status transitions. A row is written for:

- Every real transition (`fromStatus` → `toStatus` differ), via `transitionContent`.
- Reviewer/SEO-reviewer/approver **assignment** changes, via `assignUser` (action `assign:<role>`).
- Review **deadline** changes, via `setReviewDeadline` (action `setDeadline`).
- SEO sign-off, via `recordSeoReview` (action `seoApprove` / `seoRequestChanges`).

The latter three all write `fromStatus === toStatus` — they're logged events, not state changes — and the admin UI (`components/Admin/WorkflowPanel.tsx`'s `NON_TRANSITION_LABEL`) renders them with a plain action label instead of a confusing "Draft → Draft" line, in the same timeline as real transitions. `getApprovalHistory(contentType, contentId)` (any authenticated session, no specific permission) reads the full timeline for a piece of content.

## Assignment and deadlines

`assignUser(contentType, id, role, userId)` sets one of three routing fields — `reviewerId`, `seoReviewerId`, `approverId` — requires `APPROVE`. This is **informational routing, not a hard gate**: the assignee is who's expected to act, but anyone who already holds `APPROVE` can still act even if the assignee is someone else or unset. `setReviewDeadline(contentType, id, deadline)` (also requires `APPROVE`) sets or clears `reviewDeadline`; nothing in this codebase currently enforces the deadline automatically — it's a visible target, not an escalation trigger.

## SEO review (parallel, not a stage)

`recordSeoReview(contentType, id, approved, comment?)` requires `SEO_MANAGEMENT` and logs an opinion into `ApprovalHistory` **without moving `status`**. It's deliberately not a stage in the state machine: a general editorial approval and an SEO Manager's sign-off can happen in either order, and both land in the same audit timeline. Rejecting (`approved: false`) requires a comment, same rule as `requestChanges`/`reject`.

## Admin UI

`components/Admin/WorkflowPanel.tsx` is the single workflow surface used by Posts, Pages, and CaseStudies. `ACTIONS_BY_STATUS` maps each status to the buttons that make sense from there (e.g. `REVIEW` shows Approve / Request Changes / Reject; `ARCHIVED` shows only Restore to Draft) — this is a presentation-layer convenience list, not a second source of truth; the real gate is always `TRANSITIONS` in `lib/workflow.ts`. Actions flagged `needsComment` open a required comment field before submitting; actions flagged `danger` (archive, reject) get a confirming visual treatment.

`components/Admin/Posts/BulkActionsBar.tsx` drives bulk status changes (`app/(admin)/actions/bulk-posts.ts`'s `bulkChangeStatus`/`bulkSchedule`) — each selected post goes through the exact same single-item `transitionContent` call, one at a time via `Promise.all`, so a bulk action honors per-item permission and transition-validity rules instead of a raw `updateMany` bypassing them. Partial success is expected and reported per item (e.g. 8 of 10 selected posts succeed because 2 were already ARCHIVED) — not treated as all-or-nothing.

## Where else this is called from

- **AI Content Pipeline** (`lib/content-pipeline/stages.ts`, its APPROVAL stage) calls `transitionContent` directly for `submit`/`schedule`/`publish` once a human approves a pipeline run — see [AI Workflow](./ai-workflow.md). Publishing out of the pipeline is not a separate mechanism; it's the same gate as a hand-written draft.
- **Automation Engine** (`lib/automation/actions.ts`) can call `assignUser` as a configured rule action (e.g. auto-assign a reviewer on some event) — dynamically imported from `lib/workflow.ts` specifically to avoid a circular import, since `transitionContent` itself fires automation events back into that engine.

## Implementation note: no multi-statement transactions

`transitionContent`, `assignUser`, and `setReviewDeadline` each do their status/field update and their `ApprovalHistory` write as two sequential `await`s rather than one `prisma.$transaction([...])`. This isn't a style choice — the Neon HTTP adapter this app's Prisma client uses (`lib/prisma.ts`) rejects any transaction with more than one operation ("Transactions are not supported in HTTP mode"), a hard limitation discovered and fixed across the codebase on 2026-10-22. The status update runs first because it's the change that matters; a failure writing the audit row (rare) leaves the transition itself intact rather than silently losing it. See [Known Limitations](./known-limitations.md) for the full scope of this constraint.
