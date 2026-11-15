"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Megaphone } from "lucide-react";
import { sendNewsletterTest, setNewsletterAutoSend } from "@/app/(admin)/actions/newsletter";
import { confirmDialog } from "@/lib/admin/dialog";
import { toast, withToast } from "@/lib/admin/toast";

/** The "email new blog posts" switch and the test-send button on /admin/subscribers. */
export default function NewsletterAutoSendPanel({
  autoSend,
  activeCount,
  sendingNow,
}: {
  autoSend: boolean;
  activeCount: number;
  sendingNow: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"toggle" | "test" | null>(null);

  const toggle = async () => {
    const next = !autoSend;
    if (next) {
      const ok = await confirmDialog({
        title: "Email subscribers about new posts?",
        text: `From now on, each blog post's first publish emails all active subscribers (${activeCount.toLocaleString()} right now). Posts already published, or republished later, are never emailed.`,
        confirmText: "Turn on",
      });
      if (!ok) return;
    } else if (sendingNow > 0) {
      const ok = await confirmDialog({
        title: "Turn off and stop sending?",
        text: "A post is still being emailed. Turning this off stops it, and the subscribers who haven't got it yet won't. That post won't be emailed again later.",
        confirmText: "Turn off",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy("toggle");
    try {
      await withToast(setNewsletterAutoSend(next), {
        success: next ? "New posts will be emailed to subscribers" : "New-post emails turned off",
        error: "Couldn't change the setting",
      });
      router.refresh();
    } catch {
      // withToast already showed the error.
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const result = await sendNewsletterTest();
      if (result.success) toast.success(`Test sent to ${result.to}`, { description: `Using “${result.postTitle}”.` });
      else toast.error("Test not sent", { description: result.error });
    } catch {
      toast.error("Test not sent", { description: "The request failed" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-card p-5 rounded-lg border border-border flex flex-col sm:flex-row sm:items-center gap-4">
      <Megaphone className="hidden sm:block text-brand-orange-deep dark:text-brand-orange-light shrink-0" size={22} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span id="auto-send-label" className="font-semibold text-foreground">Email new blog posts to subscribers</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              autoSend ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-background text-caption border border-border"
            }`}
          >
            {autoSend ? "On" : "Off"}
          </span>
        </div>
        <p className="text-sm text-caption mt-1">
          When on, a post&apos;s first publish (manual or scheduled) emails every active subscriber, once. Every email has an unsubscribe link.
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={test}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
        >
          <FlaskConical size={15} />
          {busy === "test" ? "Sending..." : "Send me a test"}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={autoSend}
          aria-labelledby="auto-send-label"
          onClick={toggle}
          disabled={busy !== null}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange ${
            autoSend ? "bg-brand-orange-deep" : "bg-border"
          }`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${autoSend ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>
    </div>
  );
}
