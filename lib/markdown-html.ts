// Converts Markdown that ended up in an HTML body field into HTML.
//
// Why this exists: post bodies are HTML (Tiptap), but AI-generated or imported
// content sometimes arrives with Markdown syntax: either a whole body of
// Markdown, or HTML where each line is wrapped in <p> with the Markdown markers
// still inside ("<p>## 1. Optimize...</p>"). sanitizeRichText keeps that as
// literal text, so readers saw "##" and "**" on the page.
//
// Scope is deliberately small: headings, bullet/numbered lists, blockquotes,
// horizontal rules, fenced code, and inline bold/italic/code/links. Clean HTML
// is returned unchanged, so running this twice is harmless.
//
// SAFETY: this only rearranges text into a fixed set of tags. It is NOT a
// sanitizer. Every caller must still pass the result through sanitizeRichText
// (render and save paths both do), which is what removes scripts, event
// handlers and unsafe URLs.

const BLOCK_TAG_RE = /<(?:p|h[1-6]|ul|ol|li|blockquote|pre|table|div|hr|figure)\b/i;
const P_RE = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi;
const HEADING_RE = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/;
const UL_RE = /^[-*+•]\s+(\S.*)$/;
const OL_RE = /^(\d{1,3})[.)]\s+(\S.*)$/;
const QUOTE_RE = /^(?:>|&gt;)\s?(.*)$/;
const HR_RE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const BOLD_RE = /\*\*[^*\n]+\*\*/;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inline Markdown: code, bold, italic, links. */
function inline(text: string): string {
  return text
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(>])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?<]|$)/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*|mailto:[^)\s]+)\)/g,
      (_m, label: string, url: string) => `<a href="${url.replace(/"/g, "%22")}">${label}</a>`
    );
}

function splitLines(inner: string): string[] {
  return inner
    .split(/<br\s*\/?>|\r?\n/i)
    .map((l) => l.trim())
    .filter(Boolean);
}

function isBlockMarkdownLine(line: string): boolean {
  return HEADING_RE.test(line) || UL_RE.test(line) || HR_RE.test(line);
}

/** True when the body looks like it contains Markdown rather than clean HTML. */
export function looksLikeMarkdown(content: string): boolean {
  if (!content || !content.trim()) return false;
  if (!BLOCK_TAG_RE.test(content)) return true; // no HTML structure at all
  for (const m of content.matchAll(P_RE)) {
    const inner = m[1];
    if (BOLD_RE.test(inner)) return true;
    if (splitLines(inner).some(isBlockMarkdownLine)) return true;
  }
  return false;
}

type Token = { k: "raw"; v: string } | { k: "line"; v: string } | { k: "blank" };

function tokenizeHtml(html: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const m of html.matchAll(P_RE)) {
    const index = m.index ?? 0;
    if (index > last) tokens.push({ k: "raw", v: html.slice(last, index) });
    const lines = splitLines(m[1]);
    if (lines.some(isBlockMarkdownLine)) {
      for (const line of lines) tokens.push({ k: "line", v: line });
    } else {
      tokens.push({ k: "raw", v: `<p>${inline(m[1])}</p>` });
    }
    last = index + m[0].length;
  }
  if (last < html.length) tokens.push({ k: "raw", v: html.slice(last) });
  return tokens;
}

function tokenizeMarkdown(text: string): Token[] {
  const tokens: Token[] = [];
  const lines = escapeHtml(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      tokens.push({ k: "raw", v: `<pre><code>${code.join("\n")}</code></pre>` });
    } else if (!line) {
      tokens.push({ k: "blank" });
    } else {
      tokens.push({ k: "line", v: line });
    }
  }
  return tokens;
}

function render(tokens: Token[], joinPlainLines: boolean): string {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.k === "raw") {
      out.push(t.v);
      i++;
    } else if (t.k === "blank") {
      i++;
    } else {
      const line = t.v;
      let m: RegExpMatchArray | null;
      if ((m = line.match(HEADING_RE))) {
        const level = Math.min(m[1].length, 6);
        out.push(`<h${level}>${inline(m[2])}</h${level}>`);
        i++;
      } else if (HR_RE.test(line)) {
        out.push("<hr>");
        i++;
      } else if (UL_RE.test(line)) {
        const items: string[] = [];
        while (i < tokens.length && tokens[i].k === "line" && UL_RE.test((tokens[i] as { v: string }).v)) {
          items.push(`<li>${inline((tokens[i] as { v: string }).v.match(UL_RE)![1])}</li>`);
          i++;
        }
        out.push(`<ul>${items.join("")}</ul>`);
      } else if (OL_RE.test(line) && i + 1 < tokens.length && tokens[i + 1].k === "line" && OL_RE.test((tokens[i + 1] as { v: string }).v)) {
        // Numbered list needs 2+ consecutive items; a lone "1. Title" stays a paragraph.
        const items: string[] = [];
        while (i < tokens.length && tokens[i].k === "line" && OL_RE.test((tokens[i] as { v: string }).v)) {
          items.push(`<li>${inline((tokens[i] as { v: string }).v.match(OL_RE)![2])}</li>`);
          i++;
        }
        out.push(`<ol>${items.join("")}</ol>`);
      } else if (QUOTE_RE.test(line)) {
        const parts: string[] = [];
        while (i < tokens.length && tokens[i].k === "line" && QUOTE_RE.test((tokens[i] as { v: string }).v)) {
          parts.push((tokens[i] as { v: string }).v.match(QUOTE_RE)![1]);
          i++;
        }
        out.push(`<blockquote><p>${inline(parts.join(" ").trim())}</p></blockquote>`);
      } else if (joinPlainLines) {
        const parts: string[] = [];
        while (
          i < tokens.length &&
          tokens[i].k === "line" &&
          !isBlockMarkdownLine((tokens[i] as { v: string }).v) &&
          !QUOTE_RE.test((tokens[i] as { v: string }).v) &&
          !(OL_RE.test((tokens[i] as { v: string }).v) && i + 1 < tokens.length && tokens[i + 1].k === "line" && OL_RE.test((tokens[i + 1] as { v: string }).v))
        ) {
          parts.push((tokens[i] as { v: string }).v);
          i++;
        }
        out.push(`<p>${inline(parts.join(" "))}</p>`);
      } else {
        out.push(`<p>${inline(line)}</p>`);
        i++;
      }
    }
  }
  return out.join("");
}

/**
 * Returns HTML for a body that may contain Markdown. Clean HTML passes through
 * unchanged. Always sanitize the result before storing or rendering it.
 */
export function markdownishToHtml(content: string | null | undefined): string {
  if (!content) return content ?? "";
  if (!looksLikeMarkdown(content)) return content;
  if (!BLOCK_TAG_RE.test(content)) return render(tokenizeMarkdown(content), true);
  return render(tokenizeHtml(content), false);
}
