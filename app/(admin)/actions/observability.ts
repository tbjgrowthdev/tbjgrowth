"use server";

import { getObservabilityData } from "@/lib/observability/aggregate";

export async function getObservabilityDataAction(hours: number) {
  return getObservabilityData(hours);
}
