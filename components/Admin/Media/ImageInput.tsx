"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, CloudDownload, FolderOpen, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { importMediaFromUrl, uploadMediaAsset } from "@/app/(admin)/actions/media";
import { describeActionError } from "@/lib/admin/action-errors";
import { isDisplayableImageUrl, isImportableImageUrl } from "@/lib/image-hosts";
import MediaAssetPicker from "./MediaAssetPicker";

// The one image field used everywhere the admin sets an image. Every
// instance offers the same four ways in:
//   a) paste or type an image URL
//   b) pick a file from the device
//   c) drag & drop (or paste) an image file onto the field
//   d) choose an existing image from the Media Library
// Files are uploaded through the Media Library (uploadMediaAsset), so they
// get the same alt-text rule and show up in /admin/media like any upload.

// Server Action bodies are capped at 10 MB (next.config.ts); leave headroom for the form encoding.
const MAX_FILE_BYTES = 9 * 1024 * 1024;

export type ImageSelection = { url: string; altText: string };

type Pending = { key: string; file: File; previewUrl: string; altText: string };

type CommonProps = {
  label?: string;
  /** Media Library folder new uploads go into, e.g. "Blog", "Partners". */
  folder: string;
  /** Suggested alt text for new uploads/imports when the field has no alt text of its own. */
  defaultAltText?: string;
  helpText?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  /** Tailwind classes for the preview thumbnail box (default: 96px square, cropped). */
  previewClassName?: string;
  /**
   * Replaces the Media Library upload: the file is sent straight away (no
   * alt-text step) and the returned URL is used. For images that aren't
   * library content, like a profile avatar.
   */
  uploadFile?: (file: File) => Promise<string>;
};

type SingleProps = CommonProps & {
  value: string;
  onChange: (url: string) => void;
  /** When given, the field shows and edits the image's alt text too, and library/upload picks fill it in. */
  altText?: string;
  onAltTextChange?: (altText: string) => void;
  /** For fields that also accept non-URL text (testimonial avatar initials): no "not an image" warning. */
  allowText?: boolean;
  onAdd?: never;
};

type GalleryProps = CommonProps & {
  /** Gallery mode: every chosen image is appended through onAdd; the field itself stays empty. */
  onAdd: (images: ImageSelection[]) => void;
  value?: never;
  onChange?: never;
  altText?: never;
  onAltTextChange?: never;
  allowText?: never;
};

export default function ImageInput(props: SingleProps | GalleryProps) {
  const { label, folder, defaultAltText = "", helpText, placeholder, disabled, previewClassName = "w-24 h-24", uploadFile } = props;
  const gallery = typeof props.onAdd === "function";
  const id = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [urlDraft, setUrlDraft] = useState(""); // gallery mode's URL box
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importAlt, setImportAlt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [previewFailed, setPreviewFailed] = useState<string | null>(null);

  const currentUrl = gallery ? urlDraft : props.value || "";
  const busy = uploading || importing;
  const altSuggestion = (!gallery && props.altText?.trim()) || defaultAltText.trim();

  // Object URLs for pending previews are released when they're dropped or the field unmounts.
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  const clearPending = () => {
    pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending([]);
  };

  const emit = (images: ImageSelection[]) => {
    if (images.length === 0) return;
    if (gallery) {
      props.onAdd(images);
      setUrlDraft("");
    } else {
      props.onChange(images[0].url);
      props.onAltTextChange?.(images[0].altText);
    }
  };

  const takeFiles = (files: FileList | File[] | null | undefined) => {
    if (!files || disabled || busy) return;
    const list = Array.from(files);
    const images = list.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      setError(list.length ? "That file isn't an image." : null);
      return;
    }
    const tooBig = images.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" is ${(tooBig.size / 1024 / 1024).toFixed(1)} MB — images must be under 9 MB.`);
      return;
    }
    setError(null);
    clearPending();
    const chosen = gallery ? images : images.slice(0, 1);
    if (uploadFile) {
      void uploadDirect(chosen);
      return;
    }
    setPending(chosen.map((file, i) => ({ key: `${Date.now()}-${i}`, file, previewUrl: URL.createObjectURL(file), altText: altSuggestion })));
  };

  const uploadDirect = async (files: File[]) => {
    if (!uploadFile) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await Promise.all(files.map((file) => uploadFile(file)));
      emit(urls.map((url) => ({ url, altText: altSuggestion })));
    } catch (err) {
      setError(describeActionError(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const uploadPending = async () => {
    if (pending.length === 0 || pending.some((p) => !p.altText.trim())) return;
    setUploading(true);
    setError(null);
    try {
      const results = await Promise.all(pending.map((p) => uploadMediaAsset(p.file, { altText: p.altText.trim(), folder })));
      const done: ImageSelection[] = [];
      let failure: string | undefined;
      results.forEach((r, i) => {
        if (r.success && r.url) done.push({ url: r.url, altText: pending[i].altText.trim() });
        else failure ??= r.error || "Upload failed";
      });
      emit(done);
      if (failure) {
        setError(done.length ? `${done.length} uploaded, but one failed: ${failure}` : failure);
        // Keep only the ones that didn't make it, so they can be retried.
        const failedKeys = new Set(pending.filter((_, i) => !(results[i].success && results[i].url)).map((p) => p.key));
        setPending((prev) => prev.filter((p) => failedKeys.has(p.key)));
      } else {
        clearPending();
      }
    } catch (err) {
      setError(describeActionError(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const importFromUrl = async () => {
    const alt = (importAlt || altSuggestion).trim();
    if (!alt) return;
    setImporting(true);
    setError(null);
    try {
      const result = await importMediaFromUrl(currentUrl.trim(), { altText: alt, folder });
      if (result.success) {
        emit([{ url: result.url, altText: alt }]);
        setImportAlt("");
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(describeActionError(err, "Import failed"));
    } finally {
      setImporting(false);
    }
  };

  const setUrl = (url: string) => {
    setError(null);
    if (gallery) setUrlDraft(url);
    else props.onChange(url);
  };

  const addGalleryUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    emit([{ url, altText: altSuggestion }]);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) {
      e.preventDefault();
      takeFiles(files);
    }
  };

  const trimmed = currentUrl.trim();
  const looksLikeUrl = isImportableImageUrl(trimmed) || trimmed.startsWith("/");
  const displayable = isDisplayableImageUrl(trimmed);
  const showPreview = !gallery && displayable && previewFailed !== trimmed;
  // A link the site can't display (CSP/next/image only allow a few hosts) — offer to copy it into the library.
  const needsImport = !!trimmed && isImportableImageUrl(trimmed) && !displayable;
  const notAnImage = !gallery && !!trimmed && !looksLikeUrl && !props.allowText;

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={`${id}-url`} className="block text-sm font-medium text-muted">
          {label}
        </label>
      )}

      {/* a) URL */}
      <div className="flex gap-2">
        <input
          id={`${id}-url`}
          type="text"
          inputMode="url"
          value={currentUrl}
          disabled={disabled}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (gallery && e.key === "Enter") {
              e.preventDefault();
              addGalleryUrl();
            }
          }}
          placeholder={placeholder ?? "Paste an image URL, or use the options below"}
          className="flex-1 min-w-0 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange disabled:opacity-50"
        />
        {gallery ? (
          <button
            type="button"
            onClick={addGalleryUrl}
            disabled={disabled || !trimmed}
            className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-tint disabled:opacity-50 whitespace-nowrap"
          >
            Add
          </button>
        ) : (
          trimmed && (
            <button
              type="button"
              onClick={() => {
                setUrl("");
                props.onAltTextChange?.("");
              }}
              disabled={disabled}
              aria-label="Remove image"
              title="Remove image"
              className="px-2.5 py-2 border border-border rounded-lg text-caption hover:text-red-600 dark:hover:text-red-400 hover:bg-tint disabled:opacity-50"
            >
              <X size={16} />
            </button>
          )
        )}
      </div>

      {/* b) device, c) drag & drop / paste, d) Media Library */}
      <div
        tabIndex={disabled ? -1 : 0}
        role="group"
        aria-label={`${label || "Image"}: drop or paste an image file here`}
        onPaste={onPaste}
        onDragOver={(e) => {
          if (disabled || busy || !Array.from(e.dataTransfer.types).includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={(e) => {
          if (disabled || busy) return;
          e.preventDefault();
          setDragOver(false);
          takeFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border-2 border-dashed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${
          dragOver ? "border-brand-orange bg-tint" : "border-border bg-background"
        } ${disabled ? "opacity-50" : ""}`}
      >
        {!gallery && (
          <div className={`${previewClassName} flex-shrink-0 rounded-md border border-border bg-card overflow-hidden flex items-center justify-center`}>
            {showPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trimmed}
                alt={props.altText || "Current image"}
                className="w-full h-full object-cover"
                onError={() => setPreviewFailed(trimmed)}
                onLoad={() => setPreviewFailed((v) => (v === trimmed ? null : v))}
              />
            ) : (
              <ImageIcon size={24} className="text-caption" aria-hidden="true" />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm text-caption">
            {uploading && uploadFile ? "Uploading…" : dragOver ? "Drop to add this image" : gallery ? "Drag & drop or paste images here, or" : "Drag & drop or paste an image here, or"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm bg-card hover:bg-tint disabled:opacity-50"
            >
              <Upload size={15} />
              Upload from device
            </button>
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm bg-card hover:bg-tint disabled:opacity-50"
            >
              <FolderOpen size={15} />
              Media Library
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple={gallery}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              takeFiles(e.target.files);
              e.target.value = ""; // allow picking the same file again
            }}
          />
        </div>
      </div>

      {pending.length > 0 && (
        <div className="space-y-3 p-3 border border-border rounded-lg bg-card">
          {pending.map((p, index) => (
            <div key={p.key} className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt="" className="w-16 h-16 object-cover rounded-md border border-border flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-caption truncate">{p.file.name}</p>
                <input
                  type="text"
                  value={p.altText}
                  onChange={(e) => setPending((prev) => prev.map((x, i) => (i === index ? { ...x, altText: e.target.value } : x)))}
                  placeholder="Alt text (required) — describe the image"
                  aria-label={`Alt text for ${p.file.name}`}
                  className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-brand-orange"
                />
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={() => {
                  URL.revokeObjectURL(p.previewUrl);
                  setPending((prev) => prev.filter((x) => x.key !== p.key));
                }}
                aria-label={`Remove ${p.file.name}`}
                className="p-1 text-caption hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={uploading || pending.some((p) => !p.altText.trim())}
              onClick={uploadPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm"
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {uploading ? "Uploading..." : pending.length > 1 ? `Upload ${pending.length} images` : "Upload image"}
            </button>
            <button type="button" disabled={uploading} onClick={clearPending} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-tint disabled:opacity-50">
              Cancel
            </button>
          </div>
          <p className="text-xs text-caption">Uploads are added to the Media Library ({folder}). Alt text is required for accessibility and image SEO.</p>
        </div>
      )}

      {needsImport && (
        <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 space-y-2">
          <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            The site can&apos;t display images from this website (blocked by the security policy). Import a copy into the Media Library to use it.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={importAlt || altSuggestion}
              onChange={(e) => setImportAlt(e.target.value)}
              placeholder="Alt text (required)"
              aria-label="Alt text for the imported image"
              className="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
            />
            <button
              type="button"
              disabled={importing || disabled || !(importAlt || altSuggestion).trim()}
              onClick={importFromUrl}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {importing ? <Loader2 size={15} className="animate-spin" /> : <CloudDownload size={15} />}
              {importing ? "Importing..." : "Import to Media Library"}
            </button>
          </div>
        </div>
      )}

      {notAnImage && <p className="text-xs text-amber-700 dark:text-amber-400">This doesn&apos;t look like an image URL.</p>}
      {!gallery && displayable && previewFailed === trimmed && (
        <p className="text-xs text-amber-700 dark:text-amber-400">Couldn&apos;t load a preview from this URL — check that it points to an image.</p>
      )}

      {!gallery && props.onAltTextChange && trimmed && (
        <div className="space-y-1">
          <label htmlFor={`${id}-alt`} className="block text-sm font-medium text-muted">
            Alt Text
          </label>
          <input
            id={`${id}-alt`}
            type="text"
            value={props.altText ?? ""}
            disabled={disabled}
            onChange={(e) => props.onAltTextChange?.(e.target.value)}
            placeholder="Describe the image for accessibility & image SEO"
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          />
        </div>
      )}

      {helpText && <p className="text-xs text-caption">{helpText}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {showPicker && (
        <MediaAssetPicker
          onClose={() => setShowPicker(false)}
          onSelect={({ url, altText }) => {
            setShowPicker(false);
            setError(null);
            emit([{ url, altText: altText || altSuggestion }]);
          }}
        />
      )}
    </div>
  );
}
