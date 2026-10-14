import sanitizeHtml from "sanitize-html";

// Sanitizes rich-text HTML produced by the Tiptap editor (components/Admin/Editor.tsx)
// before it's stored or rendered. Content created/edited by a CONTRIBUTOR still has to
// pass through APPROVE+PUBLISH before it's public, but EDITOR/ADMIN can publish directly,
// and either way this is HTML that ends up in every visitor's browser via
// dangerouslySetInnerHTML — a compromised or malicious admin account is a stored-XSS
// vector otherwise. Pure JS (htmlparser2-based), no native/WASM deps, so it behaves the
// same in local `next dev` (Node) and the deployed Cloudflare Worker.
//
// Applied both where content is saved (actions/posts.ts, pages.ts, cases.ts, services.ts)
// and again where it's rendered — defense in depth against anything stored before this
// existed, or any other writer that bypasses the save-time call.
const ALLOWED_TAGS = [
  "p", "br", "hr",
  "strong", "b", "em", "i", "u", "s", "strike", "mark", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "code", "pre",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "span",
];

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return html ?? "";
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  });
}
