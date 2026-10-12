import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// Called by middleware.ts (Edge runtime, no direct DB driver access) to
// resolve the redirect map. Not sensitive — the data is just the public
// source->destination mapping a visitor would discover anyway.
export async function GET() {
  const redirects = await prisma.redirect.findMany({
    select: { source: true, destination: true, statusCode: true },
  });
  return NextResponse.json(redirects);
}
