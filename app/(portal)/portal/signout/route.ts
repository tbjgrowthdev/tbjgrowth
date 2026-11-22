import { NextResponse, type NextRequest } from "next/server";
import { getClientContextFromToken } from "@/lib/portal/auth";
import { CLIENT_SESSION_COOKIE } from "@/lib/portal/session-cookie";

// Where portal pages send a browser whose session is no longer valid
// (lib/portal/page-guard.ts). Clears the dead cookie, then shows the sign-in
// page. A still-valid session is left alone, so a planted link can't sign a
// client out; signing out on purpose is the signOutClient Server Action.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(CLIENT_SESSION_COOKIE)?.value;
  if (token && (await getClientContextFromToken(token))) {
    return NextResponse.redirect(new URL("/portal", req.url));
  }
  const res = NextResponse.redirect(new URL("/portal/login", req.url));
  if (token) res.cookies.delete(CLIENT_SESSION_COOKIE);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
