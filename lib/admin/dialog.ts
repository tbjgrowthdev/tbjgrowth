"use client";

/**
 * SweetAlert2 replacements for the native alert()/confirm() dialogs.
 * Loaded lazily so the library only ships when a dialog is actually opened.
 * Styling lives in app/globals.css (.tbj-swal-*), driven by the theme tokens.
 */

type ConfirmOptions = {
  title: string;
  /** Body text. "\n" line breaks are preserved. */
  text?: string;
  confirmText?: string;
  cancelText?: string;
  /** Destructive action: red confirm button. Defaults to false. */
  danger?: boolean;
};

const customClass = {
  popup: "tbj-swal-popup",
  title: "tbj-swal-title",
  htmlContainer: "tbj-swal-text",
  confirmButton: "tbj-swal-confirm",
  cancelButton: "tbj-swal-cancel",
};

export async function confirmDialog({
  title,
  text,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
}: ConfirmOptions): Promise<boolean> {
  const { default: Swal } = await import("sweetalert2");
  const result = await Swal.fire({
    title,
    text,
    icon: danger ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: danger,
    buttonsStyling: false,
    customClass: { ...customClass, confirmButton: danger ? "tbj-swal-confirm tbj-swal-danger" : "tbj-swal-confirm" },
  });
  return result.isConfirmed;
}

export async function alertDialog(text: string, title = "Something went wrong", icon: "error" | "info" | "warning" = "error"): Promise<void> {
  const { default: Swal } = await import("sweetalert2");
  await Swal.fire({ title, text, icon, confirmButtonText: "OK", buttonsStyling: false, customClass });
}
