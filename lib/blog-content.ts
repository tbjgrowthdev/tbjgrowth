import { sanitizeRichText } from "@/lib/sanitize";
import { markdownishToHtml } from "@/lib/markdown-html";
import { estimateReadingTime, slugify } from "@/lib/utils";

export type ArticleHeading = { id: string; text: string; level: 2 | 3 };

export type PreparedArticle = {
  html: string;
  headings: ArticleHeading[];
  readMinutes: number;
};

function decodeEntities(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * Turns a stored post body into what the page renders:
 *   1. converts stray Markdown to HTML (old and AI-written posts),
 *   2. sanitizes it, same allow-list as before,
 *   3. adds stable heading ids (for the contents list and anchor links) and an
 *      accent span around a leading "1." number,
 *   4. wraps tables so they scroll sideways on small screens.
 * Steps 3-4 run on already-sanitized HTML and only add fixed markup built from
 * slugified text, so nothing unsanitized reaches the page.
 */
export function prepareArticle(content: string | null | undefined): PreparedArticle {
  const clean = sanitizeRichText(markdownishToHtml(content ?? ""));
  const headings: ArticleHeading[] = [];
  const used = new Set<string>();

  const html = clean
    .replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, attrs: string | undefined, inner: string) => {
      const text = decodeEntities(inner.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
      if (!text) return _m;
      let id = slugify(text) || `section-${headings.length + 1}`;
      let n = 2;
      while (used.has(id)) id = `${slugify(text) || "section"}-${n++}`;
      used.add(id);
      headings.push({ id, text, level: Number(lvl) as 2 | 3 });
      const numbered = inner.replace(/^\s*(\d{1,3}[.)])\s+/, '<span class="heading-num">$1</span> ');
      return `<h${lvl} id="${id}"${attrs ?? ""}>${numbered}</h${lvl}>`;
    })
    .replace(/<table\b/gi, '<div class="table-wrap"><table')
    .replace(/<\/table>/gi, "</table></div>");

  return { html, headings, readMinutes: estimateReadingTime(clean) };
}
