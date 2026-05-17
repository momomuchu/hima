export type PromptInjectionFindingCategory = "threat_pattern" | "invisible_unicode";
export type PromptInjectionSeverity = "medium" | "high";
export type PromptInjectionScanStatus = "clean" | "blocked";

export interface PromptInjectionFinding {
  readonly id: string;
  readonly category: PromptInjectionFindingCategory;
  readonly severity: PromptInjectionSeverity;
  readonly message: string;
  readonly index: number;
  readonly line: number;
  readonly column: number;
  readonly excerpt: string;
}

export interface PromptInjectionScanResult {
  readonly status: PromptInjectionScanStatus;
  readonly findings: readonly PromptInjectionFinding[];
}

export interface PromptInjectionSource {
  readonly id: string;
  readonly path?: string;
  readonly content: string;
}

export interface PromptInjectionSourceFinding extends PromptInjectionFinding {
  readonly sourceId: string;
  readonly sourcePath?: string;
}

export interface PromptInjectionSourceScanResult {
  readonly status: PromptInjectionScanStatus;
  readonly findings: readonly PromptInjectionSourceFinding[];
}

interface ThreatPattern {
  readonly id: string;
  readonly severity: PromptInjectionSeverity;
  readonly message: string;
  readonly pattern: RegExp;
}

interface InvisibleUnicodePattern {
  readonly id: string;
  readonly severity: PromptInjectionSeverity;
  readonly message: string;
  readonly char: string;
}

const THREAT_PATTERNS: readonly ThreatPattern[] = [
  {
    id: "ignore_previous_instructions",
    severity: "high",
    message: "Prompt asks the model to ignore prior instructions.",
    pattern:
      /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|directives|messages)\b/gi,
  },
  {
    id: "override_system_prompt",
    severity: "high",
    message: "Prompt asks to override system or developer instructions.",
    pattern:
      /\b(?:override|replace|discard)\s+(?:your\s+)?(?:system|developer)\s+(?:instructions|message|prompt)\b/gi,
  },
  {
    id: "reveal_system_prompt",
    severity: "high",
    message: "Prompt asks to reveal privileged system or developer instructions.",
    pattern:
      /\b(?:reveal|print|show|dump)\s+(?:the\s+)?(?:system|developer)\s+(?:prompt|message|instructions)\b/gi,
  },
  {
    id: "disable_safety",
    severity: "high",
    message: "Prompt asks to disable safety, policy, or guardrails.",
    pattern: /\b(?:disable|bypass|turn\s+off)\s+(?:safety|guardrails|policy|filters)\b/gi,
  },
  {
    id: "exfiltrate_secrets",
    severity: "high",
    message: "Prompt asks to leak or steal secrets.",
    pattern: /\b(?:exfiltrate|leak|steal)\s+(?:secrets?|tokens?|keys?|credentials?)\b/gi,
  },
  {
    id: "developer_message_override",
    severity: "high",
    message: "Prompt tries to assume a privileged developer, system, or admin role.",
    pattern: /\b(?:pretend|act)\s+as\s+(?:developer|system|admin|root)\b/gi,
  },
  {
    id: "tool_result_forgery",
    severity: "medium",
    message: "Prompt tries to forge tool output or tool results.",
    pattern: /\btool\s+(?:result|output)\s+(?:is|was)\s+fake\b/gi,
  },
  {
    id: "hidden_instruction",
    severity: "medium",
    message: "Prompt tells the model to hide instructions from the user or developer.",
    pattern: /\bdo\s+not\s+(?:tell|mention|reveal)\s+(?:the\s+)?(?:user|developer)\b/gi,
  },
  {
    id: "roleplay_jailbreak",
    severity: "medium",
    message: "Prompt contains common jailbreak or roleplay bypass language.",
    pattern: /\b(?:jailbreak|DAN)\b/gi,
  },
  {
    id: "policy_bypass",
    severity: "high",
    message: "Prompt asks the model to obey only the injected instruction.",
    pattern: /\bobey\s+only\s+this\s+(?:message|instruction|prompt)\b/gi,
  },
];

const INVISIBLE_UNICODE_PATTERNS: readonly InvisibleUnicodePattern[] = [
  {
    id: "zero_width_space",
    severity: "medium",
    message: "Text contains U+200B zero-width space.",
    char: "\u200B",
  },
  {
    id: "zero_width_non_joiner",
    severity: "medium",
    message: "Text contains U+200C zero-width non-joiner.",
    char: "\u200C",
  },
  {
    id: "zero_width_joiner",
    severity: "medium",
    message: "Text contains U+200D zero-width joiner.",
    char: "\u200D",
  },
  {
    id: "word_joiner",
    severity: "medium",
    message: "Text contains U+2060 word joiner.",
    char: "\u2060",
  },
  {
    id: "byte_order_mark",
    severity: "medium",
    message: "Text contains U+FEFF byte order mark.",
    char: "\uFEFF",
  },
  {
    id: "left_to_right_embedding",
    severity: "high",
    message: "Text contains U+202A left-to-right embedding.",
    char: "\u202A",
  },
  {
    id: "right_to_left_embedding",
    severity: "high",
    message: "Text contains U+202B right-to-left embedding.",
    char: "\u202B",
  },
  {
    id: "pop_directional_formatting",
    severity: "high",
    message: "Text contains U+202C pop directional formatting.",
    char: "\u202C",
  },
  {
    id: "left_to_right_override",
    severity: "high",
    message: "Text contains U+202D left-to-right override.",
    char: "\u202D",
  },
  {
    id: "right_to_left_override",
    severity: "high",
    message: "Text contains U+202E right-to-left override.",
    char: "\u202E",
  },
  {
    id: "left_to_right_isolate",
    severity: "high",
    message: "Text contains U+2066 left-to-right isolate.",
    char: "\u2066",
  },
  {
    id: "right_to_left_isolate",
    severity: "high",
    message: "Text contains U+2067 right-to-left isolate.",
    char: "\u2067",
  },
  {
    id: "first_strong_isolate",
    severity: "high",
    message: "Text contains U+2068 first-strong isolate.",
    char: "\u2068",
  },
  {
    id: "pop_directional_isolate",
    severity: "high",
    message: "Text contains U+2069 pop directional isolate.",
    char: "\u2069",
  },
];

export function scanPromptInjectionText(input: string): PromptInjectionScanResult {
  const findings = [...findThreatPatterns(input), ...findInvisibleUnicode(input)].sort(
    (left, right) => left.index - right.index || left.id.localeCompare(right.id),
  );

  return {
    status: findings.length === 0 ? "clean" : "blocked",
    findings,
  };
}

export function scanPromptInjectionSources(
  sources: readonly PromptInjectionSource[],
): PromptInjectionSourceScanResult {
  const findings = sources.flatMap((source) =>
    scanPromptInjectionText(source.content).findings.map((finding) => ({
      ...finding,
      sourceId: source.id,
      ...(source.path === undefined ? {} : { sourcePath: source.path }),
    })),
  );

  return {
    status: findings.length === 0 ? "clean" : "blocked",
    findings,
  };
}

function findThreatPatterns(input: string): PromptInjectionFinding[] {
  return THREAT_PATTERNS.flatMap((entry) => {
    const pattern = new RegExp(entry.pattern.source, entry.pattern.flags);
    const findings: PromptInjectionFinding[] = [];

    for (const match of input.matchAll(pattern)) {
      const matchText = match[0];
      const index = match.index ?? 0;
      findings.push({
        id: entry.id,
        category: "threat_pattern",
        severity: entry.severity,
        message: entry.message,
        index,
        ...locationAt(input, index),
        excerpt: excerptAt(input, index, matchText.length),
      });
    }

    return findings;
  });
}

function findInvisibleUnicode(input: string): PromptInjectionFinding[] {
  const findings: PromptInjectionFinding[] = [];

  for (const entry of INVISIBLE_UNICODE_PATTERNS) {
    let index = input.indexOf(entry.char);
    while (index !== -1) {
      findings.push({
        id: entry.id,
        category: "invisible_unicode",
        severity: entry.severity,
        message: entry.message,
        index,
        ...locationAt(input, index),
        excerpt: excerptAt(input, index, entry.char.length),
      });
      index = input.indexOf(entry.char, index + entry.char.length);
    }
  }

  return findings;
}

function locationAt(input: string, index: number): { line: number; column: number } {
  const prefix = input.slice(0, index);
  const lines = prefix.split(/\r?\n/);
  const lastLine = lines.at(-1) ?? "";

  return {
    line: lines.length,
    column: lastLine.length + 1,
  };
}

function excerptAt(input: string, index: number, length: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(input.length, index + Math.max(length, 1) + 30);
  const prefix = start === 0 ? "" : "...";
  const suffix = end === input.length ? "" : "...";

  return `${prefix}${escapeInvisibleUnicode(input.slice(start, end))}${suffix}`;
}

function escapeInvisibleUnicode(input: string): string {
  return Array.from(input)
    .map((char) => {
      const codePoint = char.codePointAt(0);
      if (codePoint === undefined || !isInvisibleUnicodeCodePoint(codePoint)) {
        return char;
      }

      return `\\u${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
    })
    .join("");
}

function isInvisibleUnicodeCodePoint(codePoint: number): boolean {
  return INVISIBLE_UNICODE_PATTERNS.some((entry) => entry.char.codePointAt(0) === codePoint);
}
