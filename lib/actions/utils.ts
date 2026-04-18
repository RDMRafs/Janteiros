import {
  ACTION_PRIORITIES,
  ACTION_SOURCES,
  ACTION_STATUSES,
  ACTION_TYPES,
  type Action,
  type ActionInput,
  type ActionPriority,
  type ActionSource,
  type ActionStatus,
  type ActionType,
} from "./types";

const DEFAULT_ACTION_PRIORITY: ActionPriority = "medium";
const DEFAULT_ACTION_STATUS: ActionStatus = "open";

function normalizeText(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildActionId(input: ActionInput): string {
  const source = slugify(input.source);
  const type = slugify(input.type);
  const title = slugify(input.title);
  return [source, type, title].filter(Boolean).join("--");
}

export function isActionType(value: unknown): value is ActionType {
  return typeof value === "string" && ACTION_TYPES.includes(value as ActionType);
}

export function isActionPriority(value: unknown): value is ActionPriority {
  return (
    typeof value === "string" &&
    ACTION_PRIORITIES.includes(value as ActionPriority)
  );
}

export function isActionStatus(value: unknown): value is ActionStatus {
  return (
    typeof value === "string" &&
    ACTION_STATUSES.includes(value as ActionStatus)
  );
}

export function isActionSource(value: unknown): value is ActionSource {
  return (
    typeof value === "string" &&
    ACTION_SOURCES.includes(value as ActionSource)
  );
}

export function isAction(value: unknown): value is Action {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Action>;
  return (
    typeof candidate.id === "string" &&
    isActionType(candidate.type) &&
    typeof candidate.title === "string" &&
    typeof candidate.description === "string" &&
    isActionPriority(candidate.priority) &&
    isActionStatus(candidate.status) &&
    isActionSource(candidate.source) &&
    typeof candidate.createdAt === "string"
  );
}

/**
 * Create a normalized Action instance that feature adapters can emit into the
 * Action Center without hand-rolling ids, defaults, or timestamps each time.
 */
export function createAction(input: ActionInput): Action {
  const now = new Date().toISOString();

  return {
    id: normalizeText(input.id) ?? buildActionId(input),
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    priority: isActionPriority(input.priority)
      ? input.priority
      : DEFAULT_ACTION_PRIORITY,
    status: isActionStatus(input.status) ? input.status : DEFAULT_ACTION_STATUS,
    source: input.source,
    relatedFeature: normalizeText(input.relatedFeature),
    url: normalizeText(input.url),
    ctaLabel: normalizeText(input.ctaLabel),
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt,
  };
}

/**
 * Merge updates into an Action while keeping the original model shape intact
 * and stamping an updated timestamp automatically.
 */
export function updateAction(
  action: Action,
  patch: Partial<Omit<Action, "id" | "createdAt">>,
): Action {
  const next: Action = {
    ...action,
    ...patch,
    relatedFeature:
      patch.relatedFeature !== undefined
        ? normalizeText(patch.relatedFeature)
        : action.relatedFeature,
    url: patch.url !== undefined ? normalizeText(patch.url) : action.url,
    ctaLabel:
      patch.ctaLabel !== undefined
        ? normalizeText(patch.ctaLabel)
        : action.ctaLabel,
    metadata: patch.metadata ?? action.metadata ?? {},
    updatedAt: new Date().toISOString(),
  };

  return next;
}
