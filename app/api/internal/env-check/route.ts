import { NextResponse } from "next/server";

// Temporary diagnostic route — reports presence only, never values. Delete
// once the Cloudflare Worker env var mismatch is confirmed/resolved.
export async function GET() {
  const keys = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "GOOGLE_CLIENT_ID",
    "CRON_SECRET",
  ];
  const presence = Object.fromEntries(keys.map((k) => [k, Boolean(process.env[k])]));
  return NextResponse.json(presence);
}
