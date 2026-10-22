export const WINDOW_OPTIONS = [24, 168, 720] as const; // hours: 24h, 7d, 30d
export type WindowHours = (typeof WINDOW_OPTIONS)[number];

export interface ErrorLogRow {
  id: string;
  message: string;
  path: string | null;
  source: string;
  createdAt: string;
}

export interface SlowQueryRow {
  id: string;
  model: string | null;
  action: string;
  durationMs: number;
  createdAt: string;
}

export interface EmailFailureRow {
  id: string;
  type: string;
  to: string;
  error: string | null;
  createdAt: string;
}

export interface FailedPublishRow {
  id: string;
  contentType: string;
  contentId: string;
  jobType: string;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
}

export interface FailedAiJobRow {
  id: string;
  stage: string;
  provider: string;
  model: string;
  error: string | null;
  completedAt: string | null;
}

export interface FailedIntegrationRow {
  label: string;
  category: string;
  lastError: string | null;
  lastCheckedAt: string | null;
}

export interface FailedWebhookRow {
  id: string;
  ruleId: string;
  error: string | null;
  createdAt: string;
}

export interface ObservabilityData {
  windowHours: number;
  windowStart: string;
  windowEnd: string;

  application: {
    // "Errors" and "Exceptions" from the spec are the same signal in this
    // codebase — instrumentation.ts's onRequestError and the client crash
    // boundary both write to ErrorLog; there's no separate exception
    // tracker to report a second, independently-meaningful number from.
    errorCount: number;
    serverErrorCount: number;
    clientErrorCount: number;
    apiFailureCount: number; // server-side ErrorLog rows whose path starts with /api
    recentErrors: ErrorLogRow[];
    slowRequestCount: number; // poor-rated TTFB web-vital samples in window
    slowQueryCount: number;
    recentSlowQueries: SlowQueryRow[];
  };

  infrastructure: {
    databaseReachable: boolean;
    databaseLatencyMs: number | null;
    apiLatencyTrend: { checkedAt: string; latencyMs: number | null; up: boolean }[];
    avgApiLatencyMs: number | null;
  };

  business: {
    failedPublishing: FailedPublishRow[];
    failedPublishingCount: number;
    failedAiJobs: FailedAiJobRow[];
    failedAiJobCount: number;
    failedIntegrations: FailedIntegrationRow[];
    failedWebhooks: FailedWebhookRow[];
    failedWebhookCount: number;
    failedEmails: EmailFailureRow[];
    failedEmailCount: number;
  };
}
