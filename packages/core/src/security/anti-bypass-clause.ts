import type { GateType } from "../types/canonical.js";

export const ANTI_BYPASS_CLAUSE_EVIDENCE_ANCHOR =
  "docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-9.md#harvest-target";

export const ANTI_BYPASS_FINDING_IDS = [
  "no_verify_flag",
  "skip_gate_validation",
  "skip_gate",
  "bypass_gate",
  "bypass_mode",
  "disable_hooks",
  "ignore_policy",
  "force_override",
  "hook_wiring_mutation",
] as const;

export type AntiBypassFindingId = (typeof ANTI_BYPASS_FINDING_IDS)[number];

export interface AntiBypassFinding {
  readonly id: AntiBypassFindingId;
  readonly message: string;
}

export interface AntiBypassClauseInput {
  readonly gateType?: GateType;
  readonly parts: readonly unknown[];
}

export interface AntiBypassClauseEvaluation {
  readonly attempted: boolean;
  readonly findings: readonly AntiBypassFinding[];
  readonly evidenceAnchors: readonly string[];
}

const ANTI_BYPASS_PATTERNS: readonly {
  readonly id: AntiBypassFindingId;
  readonly message: string;
  readonly pattern: RegExp;
}[] = [
  {
    id: "no_verify_flag",
    message: "Command requests a no-verify bypass flag.",
    pattern: /(^|[\s"'`])--no-verify(?=$|[\s"'`.,;:!?)}\]])/i,
  },
  {
    id: "skip_gate_validation",
    message: "Text requests skipping gate validation.",
    pattern: /\b(?:skip|skipping|skipped)[\s_-]+gate[\s_-]+validation\b/i,
  },
  {
    id: "skip_gate",
    message: "Text requests skipping gates.",
    pattern: /\b(?:skip|skipping|skipped)[\s_-]+gates?\b|\bskip[\s_-]*gate\b/i,
  },
  {
    id: "bypass_gate",
    message: "Text requests bypassing gates.",
    pattern: /\b(?:bypass|bypassing|bypassed)[\s_-]+gates?\b/i,
  },
  {
    id: "bypass_mode",
    message: "Text requests bypass mode.",
    pattern: /\bbypass[\s_-]*mode\b/i,
  },
  {
    id: "disable_hooks",
    message: "Text requests disabling hooks.",
    pattern: /\b(?:disable|disabling|disabled|turn\s+off)[\s_-]+hooks?\b/i,
  },
  {
    id: "ignore_policy",
    message: "Text requests ignoring policy.",
    pattern: /\b(?:ignore|ignoring|ignored)[\s_-]+policy\b/i,
  },
  {
    id: "force_override",
    message: "Text requests a forced override.",
    pattern: /\bforce[\s_-]+override\b/i,
  },
  {
    id: "hook_wiring_mutation",
    message: "Tool or delegation text attempts to mutate HIMA hook wiring or policy files.",
    pattern:
      /\b(?:rm|del|erase|unlink|remove-item|mv|move|move-item|ren|rename|rename-item|chmod|set-executionpolicy|git\s+(?:checkout|restore)|sed|perl|python|node|powershell|pwsh)\b[\s\S]{0,180}\b(?:\.hima|\.codex|hook[-_\s]?bindings?|hooks?|settings\.json)\b/i,
  },
];

export function evaluateAntiBypassClause(input: AntiBypassClauseInput): AntiBypassClauseEvaluation {
  const haystack = input.parts.map(stringifyUnknown).filter(Boolean).join("\n");
  const findings = uniqueFindings(
    ANTI_BYPASS_PATTERNS.filter((entry) => entry.pattern.test(haystack)).map((entry) => ({
      id: entry.id,
      message: entry.message,
    })),
  );

  return {
    attempted: findings.length > 0,
    findings,
    evidenceAnchors:
      findings.length > 0
        ? findings.map((finding) => `${ANTI_BYPASS_CLAUSE_EVIDENCE_ANCHOR}:${finding.id}`)
        : [ANTI_BYPASS_CLAUSE_EVIDENCE_ANCHOR],
  };
}

function uniqueFindings(findings: readonly AntiBypassFinding[]): AntiBypassFinding[] {
  const seen = new Set<AntiBypassFindingId>();
  const unique: AntiBypassFinding[] = [];

  for (const finding of findings) {
    if (!seen.has(finding.id)) {
      seen.add(finding.id);
      unique.push(finding);
    }
  }

  return unique;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
