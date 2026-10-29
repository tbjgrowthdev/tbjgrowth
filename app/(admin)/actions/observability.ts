"use server";

import { getObservabilityData } from "@/lib/observability/aggregate";
import { guardRead } from "@/lib/action-guard";

export async function getObservabilityDataAction(hours: number) {
  return guardRead("SETTINGS_MANAGEMENT", () => null, () => getObservabilityData(hours));
}
