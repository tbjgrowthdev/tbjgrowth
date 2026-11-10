import type { ReactNode } from "react";

/**
 * Admin page headline: Syne Bold with exactly one Instrument Serif Italic
 * accent word in brand orange (the last word of the static label).
 *
 *   <PageTitle>Dashboard Overview</PageTitle>        -> Dashboard *Overview*
 *   <PageTitle>Edit Page: {page.title}</PageTitle>   -> Edit *Page*: {page.title}
 *
 * Plain function component (no hooks) so it works in server and client trees.
 * Dynamic content (a post title, a client name) is never accented.
 */
export default function PageTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  const parts = Array.isArray(children) ? children : [children];
  const first = parts[0];
  let content: ReactNode = children;

  if (typeof first === "string") {
    const label = first.trimEnd();
    // Split off a trailing ":" so "Edit Page:" accents "Page".
    const colon = label.endsWith(":") ? ":" : "";
    const words = (colon ? label.slice(0, -1) : label).trim().split(/\s+/);
    const accent = words.pop() ?? "";
    const rest = words.join(" ");
    content = (
      <>
        {rest && `${rest} `}
        <span className="accent">{accent}</span>
        {colon}
        {parts.length > 1 || first.length > label.length ? " " : null}
        {parts.slice(1)}
      </>
    );
  }

  return <h1 className={`admin-title ${className}`.trim()}>{content}</h1>;
}
