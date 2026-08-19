"use server";

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function logNotFound(path: string) {
  try {
    const headersList = await headers();
    const referer = headersList.get("referer") || null;
    const userAgent = headersList.get("user-agent") || null;

    // Check if it already exists to increment count
    const existingLog = await prisma.notFoundLog.findFirst({
      where: { path },
    });

    if (existingLog) {
      await prisma.notFoundLog.update({
        where: { id: existingLog.id },
        data: { count: { increment: 1 }, updatedAt: new Date() },
      });
    } else {
      await prisma.notFoundLog.create({
        data: {
          path,
          referer,
          userAgent,
        },
      });
    }
  } catch (error) {
    console.error("Failed to log 404:", error);
  }
}
