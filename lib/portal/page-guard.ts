import { redirect } from "next/navigation";
import { requireClient, ClientAuthError, type ClientContext } from "@/lib/portal/auth";

/**
 * requireClient() for server-rendered portal pages and layouts: sends the
 * visitor to /portal/login instead of throwing. Server Actions call
 * requireClient() directly and return their normal error shape.
 */
export async function requireClientPage(): Promise<ClientContext> {
  try {
    return await requireClient();
  } catch (error) {
    // Not straight to /portal/login: the cookie may still carry a valid
    // signature (revoked session, disabled user). /portal/signout clears it,
    // which a Server Component can't do itself.
    if (error instanceof ClientAuthError) redirect("/portal/signout");
    throw error;
  }
}
