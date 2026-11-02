import { toast } from "./toast-store";
import { describeActionError } from "./action-errors";

export { toast };

type Messages = {
  /** Shown when the action succeeds, e.g. "Post updated". Pass null for no success toast. */
  success: string | null;
  /** Title of the error toast; the action's own error text becomes its description. */
  error: string;
};

function failureOf(result: unknown): { failed: boolean; message?: string } {
  if (result && typeof result === "object" && "success" in result && (result as { success: unknown }).success === false) {
    const message = (result as { error?: unknown }).error;
    return { failed: true, message: typeof message === "string" && message ? message : undefined };
  }
  return { failed: false };
}

/**
 * Wraps a server-action call with a toast, without changing what the caller
 * gets back: the result is returned as-is and a thrown error is re-thrown,
 * so each screen's existing inline feedback keeps working unchanged.
 *
 *   const result = await withToast(updatePost(id, data), { success: "Post updated", error: "Couldn't update post" });
 *
 * `{ success: false, error }` results become an error toast with that error
 * as the description; anything else counts as success.
 */
export async function withToast<T>(action: Promise<T>, messages: Messages): Promise<T> {
  let result: T;
  try {
    result = await action;
  } catch (error) {
    toast.error(messages.error, { description: describeActionError(error, "The request failed") });
    throw error;
  }
  const { failed, message } = failureOf(result);
  if (failed) toast.error(messages.error, message && message !== messages.error ? { description: message } : undefined);
  else if (messages.success) toast.success(messages.success);
  return result;
}
