export const SECRET_KEY_PATTERN = /api[_-]?key|apikey|token|password|secret/i;

const SECRET_REPLACEMENTS: readonly [RegExp, string][] = [
  [
    /(["']?(?:api[_-]?key|apikey|token|password|secret)["']?\s*[:=]\s*["']?)[^"',}\s]{8,}/gi,
    "$1[REDACTED]",
  ],
  [/(\bAuthorization\s*:\s*Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, "$1[REDACTED]"],
  [/sk-[A-Za-z0-9]{8,}/g, "sk-[REDACTED]"],
  [/ghp_[A-Za-z0-9_]{8,}/g, "ghp_[REDACTED]"],
  [/github_pat_[A-Za-z0-9_]{20,}/g, "github_pat_[REDACTED]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "AKIA[REDACTED]"],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/g, "xox[REDACTED]"],
  [/npm_[A-Za-z0-9]{20,}/g, "npm_[REDACTED]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]"],
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    "[REDACTED_PRIVATE_KEY]",
  ],
];

export function redactSecrets(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return SECRET_REPLACEMENTS.reduce(
    (redacted, [pattern, replacement]) => redacted.replace(pattern, replacement),
    value,
  );
}

export function redactUnknown(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    if (SECRET_KEY_PATTERN.test(key ?? "")) {
      return "[REDACTED]";
    }

    return redactSecrets(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, key));
  }

  if (value && typeof value === "object") {
    return redactRecord(value as Record<string, unknown>);
  }

  return value;
}

export function redactRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactUnknown(item, key)]),
  );
}
