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

### Case-study blocks (also usable on pages)

| Type | Fields | Renders nothing when |
|---|---|---|
| `metricHero` | `eyebrow`, `label`*, `value`*, `from`, `to`, `caption` (`from`/`to` together or neither) | (label and value are required) |
| `factsStrip` | `items[{label*, value*}]`, max 6 (4–6 looks best) | no items |
| `dataTable` | `heading`, `intro`, `columns[]` (1–6, headers*), `rows[][]` (max 20, plain text, each row as long as `columns`), `footnote`, `highlightLastColumn` | no rows |
| `proofGallery` | `heading`, `columns` (1–3), `items[{imageUrl, imageAlt, caption, badge}]` max 12 | no item has a displayable image |
| `pullQuote` | `quote`, `name`, `role` | `quote` is empty |
| `takeaway` | `label` (default "Key takeaway"; empty hides it), `text`* | (text is required) |

`*` = required. Everything is plain text rendered as React children; none of
these accepts HTML. `proofGallery` items without an image (or with one that
fails `isDisplayableImageUrl`) are skipped, so unfinished screenshots never
show a placeholder. The "what renders" rules live in `lib/blocks/visible.ts`.

`cards` also has an optional `variant`: `default`, `stats` (the title is shown
as a large figure, e.g. "5.2×") or `steps` (numbered). Old data has no variant
and renders as before.

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

## Case studies

`CaseStudy.blocks` (migration `20261109000000_add_case_study_blocks`, one
nullable `TEXT` column, metadata-only) works like `Page.blocks`: `NULL` = the
classic case study that renders `content`. **Run the migration before deploying
the code that reads the column.** The form has a Classic / Blocks switch (classic
content is carried over as a `richText` block on first switch). The public page
keeps its header (title, client, results, excerpt, website button, featured
image) and renders the blocks after it; the header's `<h1>` is the only h1.

### Case study layout

The renderer takes `layout="caseStudy"` (only the case study page passes it);
Pages and pSEO keep the original look. In this layout every block follows one
width system that lines up with the header: `FRAME` (the header's content
width) for the table, metric, takeaway, quote and CTA; `WIDE` (`max-w-6xl`) for
cards, facts, galleries and badges; reading text is narrower (`READ`) and
left-aligned. Section headings are left-aligned (centered only for the
"statement" blocks: metric, takeaway, CTA), and vertical spacing is one scale.

- `richText.eyebrow` (optional, plain text, 120 chars): a small label above the
  content. Put the main heading (Heading 2) at the start of the content, e.g.
  eyebrow "The business challenge", heading "Loved by regulars, unseen by
  everyone else."
- `cards.introPlacement` (`auto` | `above` | `below`, default `auto`): `auto`
  shows the intro below stat cards (a footnote) and above other cards. On Pages,
  only an explicit `below` moves it.
- `proofGallery.intro` (optional): text directly above the images.
- A closing `richText` that is a single short paragraph renders as a small
  footnote (`isFootnoteHtml`); a short single-paragraph `richText` directly
  before a gallery, table or cards block with no heading of its own sits close
  to it.

With no excerpt, the meta description falls back to the first prose block
(`blocksToExcerpt`, render time only, never stored). Versioning, scheduled
updates and restore treat `blocks` as they do for pages. Reusable-block usage
counts and the delete check include case studies.

## Import JSON

Pages, pSEO templates and case studies can load a JSON file into the form. It
only **fills the form**: nothing is saved until you save, and the save action
validates everything again. Paste the JSON or choose a `.json` file (read with
`FileReader` in the browser, 256 KB max; the file is not uploaded). The text is
validated by the `validateImport` server action, which writes nothing, then the
dialog shows either the **first error** (field, or block number/type/field) and
loads nothing, or a **preview** with the field count, the block summary and any
warnings.

Where the button is: in the block editor on Pages and pSEO templates (blocks
only), and on the **Content** card of the case study form (the whole form, in
either layout).

### Accepted shapes

1. A bare list of blocks (works everywhere): `[ { "type": "...", "data": {...} }, ... ]`
2. `{ "blocks": [...] }` (works everywhere).
3. A **case study document**: the form's own field names at the top level, plus
   `blocks`. On Pages and pSEO templates only `blocks` is used; every other key
   is reported as "only applies to case studies and was ignored".

Every key is optional; an absent key is never touched (an import never clears a
field). Block `id`s are not needed and are always replaced with fresh ones.

| Key | Type | Rule |
|---|---|---|
| `title`, `clientName`, `industry`, `serviceType` | text | ≤ 200 chars |
| `slug` | text | normalized like the form does (`"My Slug"` → `my-slug`, with a warning); a slug that already belongs to another case study is flagged before you save |
| `results` | text | ≤ 500 (the "Results Summary") |
| `excerpt` | text | ≤ 1000 |
| `websiteUrl` | text | full `http(s)://` URL |
| `featuredImage` | text | `/path` or `http(s)` image URL |
| `featuredImageAlt` | text | ≤ 300 |
| `imageGallery` | list of text | image URLs as above, ≤ 20, de-duplicated |
| `isFeatured` | true/false | "Show on Home Page" |
| `content` | text (HTML) | the classic rich-text content; sanitized. Kept even in block mode |
| `metaTitle`, `focusKeyword` | text | ≤ 200 / ≤ 120 |
| `metaDescription` | text | ≤ 500 |
| `secondaryKeywords` | list of text | ≤ 20, each ≤ 120, trimmed, de-duplicated |
| `canonicalUrl` | text | full `http(s)://` URL |
| `isIndexable`, `allowFollow` | true/false | robots options |
| `maxSnippet`, `maxVideoPreview` | whole number | `-1` (unlimited) up to 10 000 / 86 400 |
| `maxImagePreview` | text | `none`, `standard` or `large` |
| `ogTitle`, `ogDescription`, `ogImage` | text | Open Graph; `ogImage` is an image URL |
| `twitterCard` | text | `summary` or `summary_large_image` |
| `twitterTitle`, `twitterDescription`, `twitterImage` | text | `twitterImage` is an image URL |
| `schemaJson` | object, list, or JSON text | must be real JSON, ≤ 20 000 chars, and must not contain `</script` or `<!--`; stored as formatted text |
| `blocks` | list | validated block by block; ≤ 60 blocks |

**Never imported:** `status` (new case studies stay Draft and move through the
workflow), plus `id`, `authorId`, `publishedAt`, `createdAt`, `updatedAt` and
the reviewer fields. They produce a warning.

**Warnings, not silence:** an unknown or misspelled key (`"clientname"`,
`"metaDesc"`) is reported with a "did you mean `clientName`?" hint; a normalized
slug; an image URL on a host the site won't display; an empty `blocks` list.
Warnings never block the import.

**Existing content:** if the form already has values for some imported fields
the dialog lists them and asks **Overwrite them** or **Only fill empty fields**
(Cancel closes the dialog without changing anything). "Filled" means a
non-empty text or list, or a toggle/number that is not at its default. Blocks
have their own **Append** / **Replace** choice. Importing blocks switches the
case study to the Blocks layout; the Content editor and SEO panel are refreshed
so imported text is visible.

### Example

```json
{
  "title": "How Acme grew social reach 4x in six months",
  "slug": "acme-social-reach",
  "clientName": "Acme Retail",
  "industry": "Retail",
  "serviceType": "Social media marketing",
  "results": "+423% monthly social reach",
  "websiteUrl": "https://acme.example",
  "excerpt": "A consistent content system took Acme from 18,400 to 96,300 monthly reach.",
  "featuredImage": "https://res.cloudinary.com/your-cloud/image/upload/acme-hero.jpg",
  "featuredImageAlt": "Acme social analytics dashboard",
  "imageGallery": [],
  "isFeatured": false,
  "metaTitle": "Acme case study: +423% social reach | TBJ Growth",
  "metaDescription": "How TBJ Growth grew Acme's monthly social reach by 423% in six months.",
  "focusKeyword": "social media case study",
  "secondaryKeywords": ["social media growth", "retail marketing"],
  "canonicalUrl": "",
  "isIndexable": true,
  "allowFollow": true,
  "maxSnippet": -1,
  "maxImagePreview": "large",
  "maxVideoPreview": -1,
  "ogTitle": "", "ogDescription": "", "ogImage": "",
  "twitterCard": "summary_large_image",
  "twitterTitle": "", "twitterDescription": "", "twitterImage": "",
  "schemaJson": "",
  "blocks": [
    { "type": "metricHero", "data": { "eyebrow": "Social media", "label": "Monthly social reach", "value": "+423%", "from": "18,400", "to": "96,300" } },
    { "type": "factsStrip", "data": { "items": [ { "label": "Client", "value": "Acme Retail" }, { "label": "Timeframe", "value": "6 months" } ] } },
    { "type": "dataTable", "data": { "heading": "Results", "columns": ["Metric", "Before", "After", "Change"], "rows": [["Monthly reach", "18,400", "96,300", "+423%"]], "highlightLastColumn": true } },
    { "type": "proofGallery", "data": { "heading": "Proof", "columns": 2, "items": [ { "imageUrl": "", "imageAlt": "", "caption": "Coming soon", "badge": "Illustrative" } ] } },
    { "type": "pullQuote", "data": { "quote": "", "name": "", "role": "" } },
    { "type": "takeaway", "data": { "text": "Consistency, not virality, compounded the reach." } },
    { "type": "cta", "data": { "heading": "Want results like this?", "buttonLabel": "Book a call", "buttonHref": "/contact" } }
  ]
}
```

The empty `proofGallery` item and the empty `pullQuote` are valid and render
nothing on the public page until they are filled in.

The serialized block list is capped at 512 KB (`MAX_BLOCKS_JSON_BYTES`) in
addition to the 60-block and per-field limits.

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
- **Case studies in block mode:** content-health, SEO audit, cannibalization,
  refresh-detect and the quality gate read `CaseStudy.content`, which is the
  stale classic text for a block case study. Links inside case-study blocks are
  not part of the delete dependency check. Blocks are not translated.

## Adding a block type

1. Add the name to `BLOCK_TYPES` in `lib/blocks/types.ts` and a default in `defaultBlockData`.
2. Add a zod schema to `BLOCK_DATA_SCHEMAS` in `lib/blocks/schema.ts` (the `satisfies Record<BlockType, …>` makes TypeScript list what you missed).
3. Add its editor fields, label and help text in `lib/blocks/fields.ts`.
4. Add a `case` to `BlockView` in `components/Blocks/BlockRenderer.tsx` (and to `load.ts` if it needs library data).
5. Add tests to `tests/blocks.test.ts`. No migration is needed — block data is JSON.
