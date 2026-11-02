import type { Permission } from "@/lib/permissions";
import {
  runDraftStage,
  runImageStage,
  runInternalLinksStage,
  runOutlineStage,
  runQaStage,
  runResearchStage,
  runSchemaStage,
  runSearchIntentStage,
  runSeoStage,
} from "./stages";

type StageRunner = (runId: string) => Promise<{ success: boolean; error?: string }>;

/**
 * The AI-calling stages, keyed by the stage each one produces, with the
 * permission its stage function checks. Shared by the streaming stage
 * endpoint (app/api/admin/ai-pipeline/[id]/stage) and the Job Queue's
 * retry action, so both always run the same function under the same check.
 */
export const AI_STAGE_RUNNERS: Record<string, { run: StageRunner; permission: Permission }> = {
  SEARCH_INTENT: { run: runSearchIntentStage, permission: "EDIT" },
  RESEARCH: { run: runResearchStage, permission: "EDIT" },
  OUTLINE: { run: runOutlineStage, permission: "EDIT" },
  DRAFT: { run: runDraftStage, permission: "CREATE" },
  IMAGE: { run: runImageStage, permission: "EDIT" },
  SEO: { run: runSeoStage, permission: "EDIT" },
  INTERNAL_LINKS: { run: runInternalLinksStage, permission: "EDIT" },
  SCHEMA: { run: runSchemaStage, permission: "EDIT" },
  QA: { run: runQaStage, permission: "EDIT" },
};
