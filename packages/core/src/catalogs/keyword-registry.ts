import type { GateType, MacroCycle, OperatingMode, RiskClass } from "../types/canonical.js";
import { getSkillsCatalog } from "./operational-catalog.js";

export type KeywordRegistrySource = "operational-catalog" | "test" | "manual";

export interface KeywordRegistryEntry {
  readonly id: string;
  readonly skillId: string;
  readonly priority: number;
  readonly keywords: readonly string[];
  readonly patterns: readonly string[];
  readonly macroCycles?: readonly MacroCycle[];
  readonly gateTypes?: readonly GateType[];
  readonly riskClasses?: readonly RiskClass[];
  readonly operatingModes?: readonly OperatingMode[];
  readonly source: KeywordRegistrySource | string;
}

export interface KeywordRouteContext {
  readonly macroCycle?: MacroCycle;
  readonly gateType?: GateType;
  readonly riskClass?: RiskClass;
  readonly operatingMode?: OperatingMode;
}

export interface KeywordMatch {
  readonly entry: KeywordRegistryEntry;
  readonly skillId: string;
  readonly matchedText: string;
  readonly matchedBy: "keyword" | "pattern";
  readonly score: number;
}

const DEFAULT_PRIORITY = 100;

function normalizeText(value: string): string {
  return value.toLocaleLowerCase().normalize("NFKC");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applies<T extends string>(
  allowed: readonly T[] | undefined,
  current: T | undefined,
): boolean {
  return !allowed || (current !== undefined && allowed.includes(current));
}

export function getKeywordRegistry(): KeywordRegistryEntry[] {
  return getSkillsCatalog().flatMap((skill) => {
    if (skill.activation.keywords.length === 0) {
      return [];
    }

    return [
      {
        id: `${skill.id}-keywords`,
        skillId: skill.id,
        priority: skill.activation.auto ? DEFAULT_PRIORITY : DEFAULT_PRIORITY - 25,
        keywords: [...skill.activation.keywords],
        patterns: [],
        macroCycles: [...skill.activation.macroCycles],
        gateTypes: skill.activation.gateTypes ? [...skill.activation.gateTypes] : undefined,
        riskClasses: [...skill.activation.riskClasses],
        operatingModes: skill.activation.operatingModes
          ? [...skill.activation.operatingModes]
          : undefined,
        source: "operational-catalog",
      },
    ];
  });
}

export function keywordEntryApplies(
  entry: KeywordRegistryEntry,
  context: KeywordRouteContext = {},
): boolean {
  return (
    applies(entry.macroCycles, context.macroCycle) &&
    applies(entry.gateTypes, context.gateType) &&
    applies(entry.riskClasses, context.riskClass) &&
    applies(entry.operatingModes, context.operatingMode)
  );
}

export function matchKeywordRegistry(
  prompt: string,
  context: KeywordRouteContext = {},
  registry: readonly KeywordRegistryEntry[] = getKeywordRegistry(),
): KeywordMatch[] {
  const normalizedPrompt = normalizeText(prompt);
  const matches: KeywordMatch[] = [];

  for (const entry of registry) {
    if (!keywordEntryApplies(entry, context)) {
      continue;
    }

    for (const keyword of entry.keywords) {
      const normalizedKeyword = normalizeText(keyword);
      const pattern = new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`, "u");
      if (pattern.test(normalizedPrompt)) {
        matches.push({
          entry,
          skillId: entry.skillId,
          matchedText: keyword,
          matchedBy: "keyword",
          score: entry.priority,
        });
      }
    }

    for (const pattern of entry.patterns) {
      const match = normalizedPrompt.match(new RegExp(pattern, "iu"));
      if (match) {
        matches.push({
          entry,
          skillId: entry.skillId,
          matchedText: match[0],
          matchedBy: "pattern",
          score: entry.priority + 10,
        });
      }
    }
  }

  return rankKeywordMatches(matches);
}

export function rankKeywordMatches(matches: readonly KeywordMatch[]): KeywordMatch[] {
  return [...matches].sort((a, b) => {
    const scoreDelta = b.score - a.score;
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const lengthDelta = b.matchedText.length - a.matchedText.length;
    if (lengthDelta !== 0) {
      return lengthDelta;
    }

    return a.entry.id.localeCompare(b.entry.id);
  });
}
