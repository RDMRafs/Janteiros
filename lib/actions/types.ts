/**
 * Shared normalized action model for the Action Center.
 *
 * Different product areas can emit actions in this common format without
 * coupling the dashboard to feature-specific response shapes.
 */

export const ACTION_TYPES = [
  "academic",
  "registration",
  "exam",
  "opportunity",
  "cv-improvement",
  "handbook",
  "study-plan",
  "application",
  "navigation",
] as const;

export const ACTION_PRIORITIES = ["high", "medium", "low"] as const;

export const ACTION_STATUSES = [
  "open",
  "saved",
  "done",
  "dismissed",
] as const;

export const ACTION_SOURCES = [
  "semester-planner",
  "thesis-finder",
  "research-hiwi",
  "cv-intelligence",
  "academic-profile",
  "handbook",
  "static-knowledge",
  "system",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type ActionSource = (typeof ACTION_SOURCES)[number];

export interface Action {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  priority: ActionPriority;
  status: ActionStatus;
  source: ActionSource;
  relatedFeature?: string;
  url?: string;
  ctaLabel?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Factory-friendly input shape for feature adapters.
 *
 * Adapters can provide the important semantic fields and let utilities fill in
 * defaults such as status, priority, ids, and timestamps.
 */
export type ActionInput = Pick<
  Action,
  "type" | "title" | "description" | "source"
> &
  Partial<
    Omit<
      Action,
      "type" | "title" | "description" | "source"
    >
  >;
