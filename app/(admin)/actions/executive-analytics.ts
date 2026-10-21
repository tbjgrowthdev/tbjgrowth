"use server";

import { getExecutiveAnalytics } from "@/lib/executive-analytics/aggregate";

export async function getExecutiveAnalyticsAction(days: number) {
  return getExecutiveAnalytics(days);
}
