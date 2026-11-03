"use client";
import { confirmDialog } from "@/lib/admin/dialog";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Save, UploadCloud, Undo2, Trash2 } from "lucide-react";
import {
  saveTranslationDraft,
  publishTranslation,
  unpublishTranslation,
  deleteTranslation,
} from "@/app/(admin)/actions/translations";
import type { TranslatableKind } from "@/lib/translation";
import { describeActionError } from "@/lib/admin/action-errors";
import { withToast } from "@/lib/admin/toast";

const LONG_TEXT_FIELDS = new Set(["content", "excerpt", "detailIntro", "ogDescription", "twitterDescription"]);

const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  slug: "URL slug",
  subtitle: "Subtitle",
  excerpt: "Excerpt / description",
  content: "Content",
  detailTitle: "Detail page title",
  detailIntro: "Detail page intro",
  metaTitle: "Meta title",
  metaDescription: "Meta description",
  focusKeyword: "Focus keyword",
  ogTitle: "Open Graph title",
  ogDescription: "Open Graph description",
  twitterTitle: "Twitter title",
  twitterDescription: "Twitter description",
};

type Translation = {
  id: string;
  status: "DRAFT" | "PUBLISHED";
  updatedAt: string | Date;
  [key: string]: unknown;
};

export default function TranslationEditor({
  contentType,
  contentId,
  locale,
  fieldMap,
  base,
  existing,
}: {
  contentType: TranslatableKind;
  contentId: string;
  locale: string;
  fieldMap: Record<string, string>;
  base: Record<string, unknown>;
  existing: Translation | null;
}) {
  const router = useRouter();
  const fields = Object.keys(fieldMap);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      initial[field] = (existing?.[field] as string) ?? "";
    }
    return initial;
  });
  const [status, setStatus] = useState(existing?.status ?? "DRAFT");
  const [updatedAt, setUpdatedAt] = useState(existing?.updatedAt ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const update = (field: string, value: string) => setValues((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      setError(null);
      setMessage(null);
      const result = await withToast(saveTranslationDraft(contentType, contentId, locale, { ...values, expectedUpdatedAt: updatedAt }), { success: "Translation draft saved", error: "Couldn't save translation draft" });
      if (result.success && result.translation) {
        setUpdatedAt(result.translation.updatedAt);
        setStatus(result.translation.status);
        setMessage("Draft saved.");
        router.refresh();
      } else {
        setError(result.error || "Failed to save draft");
      }
    } catch (err) {
      setError(describeActionError(err, "Failed to save draft"));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      setError(null);
      setMessage(null);
      const result = await withToast(publishTranslation(contentType, contentId, locale), { success: "Translation published", error: "Couldn't publish translation" });
      if (result.success && result.translation) {
        setStatus(result.translation.status);
        setUpdatedAt(result.translation.updatedAt);
        setMessage("Published — live on the site now.");
        router.refresh();
      } else {
        setError(result.error || "Failed to publish");
      }
    } catch (err) {
      setError(describeActionError(err, "Failed to publish"));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setIsPublishing(true);
    try {
      setError(null);
      setMessage(null);
      const result = await withToast(unpublishTranslation(contentType, contentId, locale), { success: "Translation unpublished", error: "Couldn't unpublish translation" });
      if (result.success && result.translation) {
        setStatus(result.translation.status);
        setUpdatedAt(result.translation.updatedAt);
        setMessage("Unpublished — reverted to draft, no longer live.");
        router.refresh();
      } else {
        setError(result.error || "Failed to unpublish");
      }
    } catch (err) {
      setError(describeActionError(err, "Failed to unpublish"));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!(await confirmDialog({ title: "Delete translation?", text: "This will delete the translation entirely and can't be undone.", confirmText: "Delete", danger: true }))) return;
    setIsDeleting(true);
    setError(null);
    try {
      const result = await withToast(deleteTranslation(contentType, contentId, locale), { success: "Translation deleted", error: "Couldn't delete translation" });
      if (result.success) {
        // Leaves isDeleting on while navigating away, so the button can't be clicked twice.
        router.push("/admin/translations");
        router.refresh();
      } else {
        setError(result.error || "Failed to delete");
        setIsDeleting(false);
      }
    } catch (err) {
      setError(describeActionError(err, "Failed to delete"));
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            status === "PUBLISHED"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          }`}
        >
          {status === "PUBLISHED" ? "Published" : "Draft"}
        </span>
        {status === "PUBLISHED" && (
          <span className="text-xs text-caption">Live on the site — editing here updates it immediately after Save.</span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg flex items-start gap-2 text-sm">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      <div className="space-y-5">
        {fields.map((field) => {
          const baseField = fieldMap[field];
          const baseValue = base[baseField];
          const isLong = LONG_TEXT_FIELDS.has(field);
          return (
            <div key={field} className="grid md:grid-cols-2 gap-3 items-start">
              <div className="bg-background border border-border rounded-lg p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-caption mb-1">
                  {FIELD_LABEL[field] || field} (current, English)
                </p>
                <p className="text-sm text-muted whitespace-pre-wrap break-words max-h-40 overflow-auto">
                  {typeof baseValue === "string" && baseValue ? baseValue : <em className="italic">(empty)</em>}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-caption mb-1">
                  {FIELD_LABEL[field] || field} — translation
                </label>
                {isLong ? (
                  <textarea
                    rows={field === "content" ? 10 : 3}
                    value={values[field]}
                    onChange={(e) => update(field, e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:ring-2 focus:ring-brand-orange"
                  />
                ) : (
                  <input
                    type="text"
                    value={values[field]}
                    onChange={(e) => update(field, e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:ring-2 focus:ring-brand-orange"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {isSaving ? "Saving..." : "Save Draft"}
        </button>

        {status === "PUBLISHED" ? (
          <button
            type="button"
            onClick={handleUnpublish}
            disabled={isPublishing}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-tint transition-colors disabled:opacity-50"
          >
            <Undo2 size={16} />
            {isPublishing ? "Working..." : "Unpublish"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing || !existing}
            title={!existing ? "Save a draft before publishing" : undefined}
            className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
          >
            <UploadCloud size={16} />
            {isPublishing ? "Publishing..." : "Publish"}
          </button>
        )}

        {existing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 ml-auto"
          >
            <Trash2 size={16} />
            {isDeleting ? "Deleting..." : "Delete translation"}
          </button>
        )}
      </div>
    </div>
  );
}
