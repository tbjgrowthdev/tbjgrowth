import type { ContentType } from "@/lib/generated/prisma/client";

export type RefreshSignalType = "OLD_CONTENT" | "OUTDATED_MENTION" | "RANKING_DECLINE" | "TRAFFIC_DECLINE" | "CTR_DECLINE";

export interface DetectedSignal {
  type: RefreshSignalType;
  detail: string;
}

export interface RefreshCandidate {
  contentType: Extract<ContentType, "POST" | "CASE_STUDY">;
  contentId: string;
  title: string;
  slug: string;
  publishedAt: string | null;
  signals: DetectedSignal[];
}

export const SIGNAL_LABEL: Record<RefreshSignalType, string> = {
  OLD_CONTENT: "Old content",
  OUTDATED_MENTION: "Outdated content",
  RANKING_DECLINE: "Ranking decline",
  TRAFFIC_DECLINE: "Traffic decline",
  CTR_DECLINE: "CTR decline",
};
