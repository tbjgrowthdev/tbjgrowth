"use server";

import { createScheduledJob, cancelScheduledJob, getScheduledJobs } from "@/lib/scheduled-jobs";
import { zonedTimeToUtc } from "@/lib/scheduling";
import type { ContentType, ScheduledJobType } from "@/lib/generated/prisma/client";
import { guardMutation, guardRead } from "@/lib/action-guard";

export async function scheduleContentJob(
  contentType: ContentType,
  contentId: string,
  jobType: ScheduledJobType,
  date: string,
  time: string,
  timezone: string,
  payload?: Record<string, unknown>
) {
  // Same rule as createScheduledJob: an UPDATE job only needs EDIT.
  return guardMutation(jobType === "UPDATE" ? "EDIT" : "SCHEDULE", async () => {
    const runAt = zonedTimeToUtc(date, time, timezone);
    if (runAt.getTime() <= Date.now()) {
      return { success: false, error: "Scheduled time must be in the future" };
    }
    return createScheduledJob(contentType, contentId, jobType, runAt, timezone, payload);
  });
}

export async function cancelContentScheduledJob(id: string) {
  return guardMutation("SCHEDULE", () => cancelScheduledJob(id));
}

export async function getContentScheduledJobs(contentType: ContentType, contentId: string) {
  return guardRead("SESSION", () => [], () => getScheduledJobs(contentType, contentId));
}
