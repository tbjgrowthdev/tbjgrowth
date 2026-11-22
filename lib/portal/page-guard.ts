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
    if (error instanceof ClientAuthError) redirect("/portal/login");
    throw error;
  }
}
