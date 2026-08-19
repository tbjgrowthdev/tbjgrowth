import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const VALID_METRICS = new Set(["LCP", "CLS", "INP", "FCP", "TTFB"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { path, metric, value, rating } = body;

    if (typeof path !== "string" || !VALID_METRICS.has(metric) || typeof value !== "number") {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    await prisma.webVitalSample.create({
      data: { path: path.slice(0, 500), metric, value, rating: rating || "unknown" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to store web vital sample:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
