# Landing-Page Blocks & Reusable Blocks

Admin → **Pages** can build a real landing page from blocks (hero, calls to
action, cards, testimonials, FAQ, pricing, trust badges, lead form, rich text)
instead of one rich-text column. Blocks can be **reusable**: one shared block
placed on many pages, where editing it once updates every page. Programmatic
SEO templates can show blocks too (typically a CTA and a lead form).

This implements the part of Master Plan Phase 26 (Reusable Content Blocks)
needed for landing pages: CTA, FAQ, testimonials, pricing, trust badges,
contact/lead form, with central update. **Not built:** newsletter and
"related content" blocks (nothing in this change prevents adding them — see
"Adding a block type").

## Design in one paragraph

A page stores its layout as a JSON array in one new nullable column,
`Page.blocks`. Each entry is either a concrete block `{ id, type, data }` or a
reference `{ id, type: "reusable", blockId }`. Reusable blocks live in a new
table, `ContentBlock`. References are resolved **at render time**, so editing a
`ContentBlock` row changes every page that references it without touching those
pages. `Page.content` is left alone: a page with no `blocks` renders exactly as
it always did.

Why JSON in a column rather than a `PageBlock` table: the Neon HTTP adapter has
no transactions, nested creates or `createMany` (see
[known-limitations.md](known-limitations.md)). A relational layout would turn
every save into many writes that can half-succeed. One JSON column keeps a page
save a single `update`, and versioning / scheduled updates / restore already
treat the page as a flat record of scalar fields, so `blocks` slots in as one
more field.

## Data model (migration `20261107000000_add_content_blocks`)

Additive only — two nullable columns and one table; nothing is dropped,
rewritten or backfilled. Adding a nullable column with no default is a
metadata-only change in Postgres, so it is safe on a populated database.

| Change | Notes |
|---|---|
| `Page.blocks TEXT NULL` | `NULL` = classic page. Empty block list is stored as `NULL`. |
| `PSeoTemplate.blocks TEXT NULL` | Rendered after the body on every page generated from the template, resolved per request (no regeneration needed). |
| `ContentBlock` | `name` (unique), `type` (a concrete block type), `data` (JSON), `createdById`/`updatedById` (plain id pointers). |

There is **no join table** for "which pages use this block". Usage is found by
a substring pre-filter on the block id (a cuid) over `Page.blocks` /
`PSeoTemplate.blocks`, then confirmed by parsing, so an id that merely appears
inside copy never counts (`lib/blocks/usage.ts`).

## Block types

Defined once in `lib/blocks/schema.ts` (zod). The editor form is generated from
`lib/blocks/fields.ts`; the public markup is `components/Blocks/BlockRenderer.tsx`.

| Type | Content | Data source |
|---|---|---|
| `hero` | eyebrow, heading, subheading, up to 2 buttons, image | inline |
| `richText` | formatted HTML (the existing TipTap editor) | inline, sanitized |
| `cta` | heading, text, 1–2 buttons | inline |
| `cards` | features/services grid, 2–4 columns, optional per-card link | inline |
| `testimonials` | chosen (or first six) testimonials | `Testimonial` table |
| `faq` | custom Q&A, or chosen/all FAQs; emits one `FAQPage` JSON-LD for the page | inline or `Faq` table |
| `pricing` | chosen (or all active) packages | Admin → Pricing (`getPublicPricing`) |
| `trustBadges` | labels with optional logos | inline |
| `leadForm` | name/email (+ optional phone, company, message) | saves a `FormSubmission` |

The lead form calls the existing public `submitContactForm` action — same
validation, same per-email throttle (3 per 10 minutes), same Leads inbox and
notification email. `source` is recorded as `Landing page: /<slug>` or
`pSEO page: /<slug>`. It is not a new write path.

Pages render exactly one `<h1>`: the first hero's heading, or the page title if
there is no hero. On pSEO pages the page's own `<h1>` stays and a hero is an `<h2>`.

## Security: how output stays sanitized

Everything stored or rendered goes through `lib/blocks/schema.ts`:

1. **Save time (strict).** `normalizeBlocksInput` validates the editor payload
   with zod. Unknown keys are stripped, strings and lists are length-capped
   (≤ 60 blocks per page, ≤ 24 items per list), and an invalid block rejects
   the save with a message naming the block. `richText` HTML is run through
   `sanitizeRichText`.
2. **Links and images.** Every link must pass `isSafeHref` (site path, `#anchor`,
   `http(s)`, `mailto:`, `tel:` — never `javascript:`, `data:`, protocol-relative
   `//host`, or anything with control characters/backslashes). Every image must
   pass `isSafeImageUrl`, and is only displayed if `isDisplayableImageUrl` also
   allows the host (same list as the CSP `img-src`).
3. **Render time (lenient, defense in depth).** `parseStoredBlocks` re-validates
   whatever is in the database and **drops** a block that fails instead of
   breaking the page; reusable blocks are re-validated when resolved; the
   renderer re-checks every `href` and re-sanitizes `richText` HTML.
4. All text fields are rendered as React text, which escapes them. The only
   `dangerouslySetInnerHTML` is the sanitized `richText` block.

Three save paths write `Page.blocks`, and all three normalize: `createPage` /
`updatePage`, scheduled **UPDATE** jobs (`lib/scheduled-jobs.ts` — previously
the staged payload was applied raw, so it now also sanitizes `content`), and
version **restore**. pSEO template saves normalize in `programmatic-seo.ts`.

## Workflow, versioning, scheduling

- **Versioning:** `blocks` is part of the `PAGE` snapshot (`lib/versioning.ts`).
  Restoring a version taken before blocks existed clears the layout (that
  version *was* a classic page) instead of leaving the current blocks on top of
  restored text.
- **Workflow / scheduling:** unchanged. Blocks are page content, so they go
  through the same Draft → Review → Approved → Published states and the same
  scheduled-update mechanism as the rest of the page.
- **`updatePage` only touches `blocks` when the caller sends it**, so no older
  caller can wipe a layout by omission. The classic editor sends `[]` (→ `NULL`)
  deliberately: choosing "Classic text" and saving removes the layout (the
  version history keeps it; `content` is never cleared).
- **Switching a classic page to blocks** copies its existing text into a
  `richText` block, which the editor can reorder or delete.
- **Dependency check on delete** (`lib/dependency-check.ts`): button/card links
  to a page's URL inside other pages' blocks, pSEO template blocks and reusable
  blocks are reported as "Internal Links", so deleting a page that a CTA points
  to now warns.

## Reusable blocks

Admin → **Pages → Reusable Blocks** (`/admin/blocks`): create, edit, see usage,
delete. In a page, **Insert** a reusable block from the picker, or use
**Save as reusable block…** on any block to promote it (the block is replaced by
a reference to the new shared row).

- **A reusable block is live immediately on every page that uses it** — it has
  no draft state and an edit is not re-reviewed per page. Therefore *editing or
  deleting* one needs `PUBLISH` (and `DELETE` for deletion), the same bar as
  publishing; *creating* one needs only `CREATE`, since a new block appears
  nowhere until a page that goes through the normal workflow references it.
  The edit screen lists where the block is used before you save.
- The block's **type is fixed** after creation (pages were composed around it).
- Deleting a block that is in use is blocked, with the list of usages and a
  "Delete anyway" confirmation (same shared dialog as other deletes). A forced
  delete is safe for visitors: references to a missing block are skipped.
- Saving a block revalidates every page that uses it (`revalidatePath`), plus
  the locale-prefixed page and pSEO routes, so changes don't wait for the
  hourly ISR window.
- Audit log: create/update/delete are recorded with before/after data. There is
  no per-block version history (only the audit log).

## Known limitations

- **Translations:** `Page` translations overlay `title`/`content`/SEO fields.
  Blocks are not translated; a translated page shows the same blocks as the
  default language.
- **Content tooling reads `content`, not `blocks`.** Content-health, cannibalization,
  orphan-page, link-graph and search features that scan `Page.content` do not see
  copy or links inside blocks. (The editor's SEO panel does score block copy.)
- **No `{{column}}` placeholders in pSEO blocks** — block text is the same on
  every generated page.
- Trust badges are inline only; the existing `TrustedPartner` logos are not selectable.
- Pricing blocks show monthly price(s) and features per package, not the full
  comparison table or currency switcher of `/pricing`.
- No Phase 26 newsletter/related-content blocks.

## Adding a block type

1. Add the name to `BLOCK_TYPES` in `lib/blocks/types.ts` and a default in `defaultBlockData`.
2. Add a zod schema to `BLOCK_DATA_SCHEMAS` in `lib/blocks/schema.ts` (the `satisfies Record<BlockType, …>` makes TypeScript list what you missed).
3. Add its editor fields, label and help text in `lib/blocks/fields.ts`.
4. Add a `case` to `BlockView` in `components/Blocks/BlockRenderer.tsx` (and to `load.ts` if it needs library data).
5. Add tests to `tests/blocks.test.ts`. No migration is needed — block data is JSON.
