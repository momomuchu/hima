import type { GateType, MacroCycle, OperatingMode, RiskClass } from "../types/canonical.js";
import {
  type KeywordRegistryEntry,
  type KeywordRouteContext,
  matchKeywordRegistry,
} from "./keyword-registry.js";
import { getSkillsCatalog } from "./operational-catalog.js";

export interface RegexRoute {
  readonly id: string;
  readonly skillId: string;
  readonly pattern: string;
  readonly priority: number;
}

export interface StateRoute {
  readonly id: string;
  readonly skillId: string;
  readonly reason: string;
  readonly priority: number;
  readonly macroCycles?: readonly MacroCycle[];
  readonly gateTypes?: readonly GateType[];
  readonly riskClasses?: readonly RiskClass[];
  readonly operatingModes?: readonly OperatingMode[];
}

export interface RouterCascadeInput {
  readonly prompt: string;
  readonly context?: KeywordRouteContext;
  readonly regexRoutes?: readonly RegexRoute[];
  readonly stateRoutes?: readonly StateRoute[];
  readonly keywordRegistry?: readonly KeywordRegistryEntry[];
}

export type RouterTier = "regex" | "state" | "keyword" | "llm_fallback";

export interface RouterEventPayload {
  readonly tier: RouterTier;
  readonly selectedSkillId: string | null;
  readonly routeId: string | null;
  readonly tokenSpendingRequired: boolean;
  readonly promptLength: number;
}

export interface RouterCascadeResult {
  readonly tier: RouterTier;
  readonly skillId: string | null;
  readonly routeId: string | null;
  readonly reason: string;
  readonly eventPayload: RouterEventPayload;
  readonly llmFallback?: {
    readonly required: true;
    readonly tokenSpendingRequired: true;
    readonly candidateSkillIds: readonly string[];
    readonly prompt: string;
  };
}

function applies<T extends string>(
  allowed: readonly T[] | undefined,
  current: T | undefined,
): boolean {
  return !allowed || (current !== undefined && allowed.includes(current));
}

function routeEventPayload(
  tier: RouterTier,
  skillId: string | null,
  routeId: string | null,
  prompt: string,
): RouterEventPayload {
  return {
    tier,
    selectedSkillId: skillId,
    routeId,
    tokenSpendingRequired: tier === "llm_fallback",
    promptLength: prompt.length,
  };
}

export function routeWithCascade(input: RouterCascadeInput): RouterCascadeResult {
  const context = input.context ?? {};
  const validSkillIds = new Set(getSkillsCatalog().map((skill) => skill.id));
  const regexRoute = [...(input.regexRoutes ?? [])]
    .filter(
      (route) =>
        validSkillIds.has(route.skillId) && new RegExp(route.pattern, "iu").test(input.prompt),
    )
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0];

  if (regexRoute) {
    return {
      tier: "regex",
      skillId: regexRoute.skillId,
      routeId: regexRoute.id,
      reason: `regex route ${regexRoute.id} matched before state and keyword tiers`,
      eventPayload: routeEventPayload("regex", regexRoute.skillId, regexRoute.id, input.prompt),
    };
  }

  const stateRoute = [...(input.stateRoutes ?? [])]
    .filter(
      (route) =>
        validSkillIds.has(route.skillId) &&
        applies(route.macroCycles, context.macroCycle) &&
        applies(route.gateTypes, context.gateType) &&
        applies(route.riskClasses, context.riskClass) &&
        applies(route.operatingModes, context.operatingMode),
    )
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0];

  if (stateRoute) {
    return {
      tier: "state",
      skillId: stateRoute.skillId,
      routeId: stateRoute.id,
      reason: stateRoute.reason,
      eventPayload: routeEventPayload("state", stateRoute.skillId, stateRoute.id, input.prompt),
    };
  }

  const keywordMatch = matchKeywordRegistry(input.prompt, context, input.keywordRegistry).find(
    (match) => validSkillIds.has(match.skillId),
  );
  if (keywordMatch) {
    return {
      tier: "keyword",
      skillId: keywordMatch.skillId,
      routeId: keywordMatch.entry.id,
      reason: `keyword ${keywordMatch.matchedText} matched ${keywordMatch.skillId}`,
      eventPayload: routeEventPayload(
        "keyword",
        keywordMatch.skillId,
        keywordMatch.entry.id,
        input.prompt,
      ),
    };
  }

  const candidateSkillIds = getSkillsCatalog().map((skill) => skill.id);
  return {
    tier: "llm_fallback",
    skillId: null,
    routeId: null,
    reason: "no deterministic route matched; LLM classification required",
    eventPayload: routeEventPayload("llm_fallback", null, null, input.prompt),
    llmFallback: {
      required: true,
      tokenSpendingRequired: true,
      candidateSkillIds,
      prompt: input.prompt,
    },
  };
}
