"use server";

import { getExecutiveAnalytics } from "@/lib/executive-analytics/aggregate";
import { guardRead } from "@/lib/action-guard";

export async function getExecutiveAnalyticsAction(days: number) {
  return guardRead("SETTINGS_MANAGEMENT", () => null, () => getExecutiveAnalytics(days));
}
