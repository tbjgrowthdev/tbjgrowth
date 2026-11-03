"use client";

import { useRef, useState } from "react";
import { Check, Link2, Linkedin, Share2 } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";

type Labels = { copyLink: string; linkCopied: string; shareLinkedIn: string; shareX: string; share: string };

const btn =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:border-brand-orange hover:text-brand-orange-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange dark:hover:text-brand-orange-light";

/**
 * Copy link, LinkedIn, X and native share. The site's toast system is
 * admin-only, so "Link copied" is shown inline (and announced to screen readers).
 */
export default function ShareButtons({ url, title, labels }: { url: string; title: string; labels: Labels }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashCopied = () => {
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      flashCopied();
    } catch {
      // clipboard blocked (e.g. insecure context): nothing more we can do
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // cancelled
      }
      return;
    }
    await copy();
  };

  const enc = encodeURIComponent;
  return (
    <div className="relative flex items-center gap-2">
      <button type="button" onClick={copy} className={btn} aria-label={labels.copyLink} title={labels.copyLink}>
        {copied ? <Check className="h-4 w-4 text-green-600" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
      </button>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={btn}
        aria-label={labels.shareLinkedIn}
        title={labels.shareLinkedIn}
      >
        <Linkedin className="h-4 w-4" aria-hidden="true" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={btn}
        aria-label={labels.shareX}
        title={labels.shareX}
      >
        <FaXTwitter className="h-4 w-4" aria-hidden="true" />
      </a>
      <button type="button" onClick={share} className={btn} aria-label={labels.share} title={labels.share}>
        <Share2 className="h-4 w-4" aria-hidden="true" />
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? labels.linkCopied : ""}
      </span>
      {copied && (
        <span
          aria-hidden="true"
          className="absolute -bottom-9 end-0 whitespace-nowrap rounded-full bg-charcoal px-3 py-1 text-xs font-medium text-white shadow-lg"
        >
          {labels.linkCopied}
        </span>
      )}
    </div>
  );
}
