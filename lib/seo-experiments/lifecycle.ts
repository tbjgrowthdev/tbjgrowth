import prisma from "@/lib/prisma";
import { getContentRecord, setContentField } from "./content-access";
import { aggregateMetrics, computeDeltas } from "./metrics";
import { VARIABLE_FIELD, type ExperimentContentType, type ExperimentResults, type ExperimentVariable } from "./types";

const DAY_MS = 86_400_000;

/** Applies the experiment's afterValue to the real content record and starts the evaluation clock. Only valid from DRAFT. */
export async function launchExperiment(id: string): Promise<void> {
  const experiment = await prisma.seoExperiment.findUnique({ where: { id } });
  if (!experiment) throw new Error("Experiment not found");
  if (experiment.status !== "DRAFT") throw new Error("Only a draft experiment can be launched");

  const field = VARIABLE_FIELD[experiment.variable];
  await setContentField(experiment.contentType as ExperimentContentType, experiment.contentId, field, experiment.afterValue);
  await prisma.seoExperiment.update({ where: { id }, data: { status: "RUNNING", startedAt: new Date() } });
}

/** Writes the beforeValue back to the content record and stops tracking — a human deciding the test isn't worth running out. Only valid from RUNNING. */
export async function revertExperiment(id: string): Promise<void> {
  const experiment = await prisma.seoExperiment.findUnique({ where: { id } });
  if (!experiment) throw new Error("Experiment not found");
  if (experiment.status !== "RUNNING") throw new Error("Only a running experiment can be reverted");

  const field = VARIABLE_FIELD[experiment.variable];
  await setContentField(experiment.contentType as ExperimentContentType, experiment.contentId, field, experiment.beforeValue);
  await prisma.seoExperiment.update({ where: { id }, data: { status: "REVERTED", revertedAt: new Date() } });
}

/**
 * Computes (and persists) the before/after comparison from the
 * SearchConsoleMetric/AnalyticsLandingPageMetric rows already imported for
 * this content. Safe to call anytime after launch for a live preview —
 * only flips status to COMPLETED once the evaluation window has actually
 * fully elapsed, and never overwrites a REVERTED experiment's status.
 */
export async function evaluateExperiment(id: string): Promise<{ results: ExperimentResults; isWindowComplete: boolean; daysElapsed: number; daysRemaining: number }> {
  const experiment = await prisma.seoExperiment.findUnique({ where: { id } });
  if (!experiment) throw new Error("Experiment not found");
  if (!experiment.startedAt) throw new Error("Experiment hasn't been launched yet");

  const contentType = experiment.contentType as ExperimentContentType;
  const startedAt = experiment.startedAt;
  const baselineFrom = new Date(startedAt.getTime() - experiment.baselineWindowDays * DAY_MS);
  const evaluationEnd = new Date(startedAt.getTime() + experiment.evaluationWindowDays * DAY_MS);
  const now = new Date();
  const windowEnd = now < evaluationEnd ? now : evaluationEnd;

  const [before, after] = await Promise.all([
    aggregateMetrics(contentType, experiment.contentId, baselineFrom, startedAt),
    aggregateMetrics(contentType, experiment.contentId, startedAt, windowEnd),
  ]);
  const results: ExperimentResults = { before, after, deltas: computeDeltas(before, after) };

  const isWindowComplete = now >= evaluationEnd;
  await prisma.seoExperiment.update({
    where: { id },
    data: {
      results: JSON.stringify(results),
      ...(isWindowComplete && experiment.status === "RUNNING" ? { status: "COMPLETED", completedAt: now } : {}),
    },
  });

  const daysElapsed = Math.floor((windowEnd.getTime() - startedAt.getTime()) / DAY_MS);
  const daysRemaining = Math.max(0, experiment.evaluationWindowDays - daysElapsed);
  return { results, isWindowComplete, daysElapsed, daysRemaining };
}

export async function createExperiment(input: {
  name: string;
  contentType: ExperimentContentType;
  contentId: string;
  variable: ExperimentVariable;
  afterValue: string;
  baselineWindowDays: number;
  evaluationWindowDays: number;
}): Promise<{ id: string }> {
  const field = VARIABLE_FIELD[input.variable];
  const content = await getContentRecord(input.contentType, input.contentId);
  if (!content) throw new Error("Content not found");

  const experiment = await prisma.seoExperiment.create({
    data: {
      name: input.name,
      contentType: input.contentType,
      contentId: input.contentId,
      variable: input.variable,
      beforeValue: content[field] || "",
      afterValue: input.afterValue,
      baselineWindowDays: input.baselineWindowDays,
      evaluationWindowDays: input.evaluationWindowDays,
    },
  });
  return { id: experiment.id };
}
