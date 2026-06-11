// Ported from packages/core/src/types/risk-class.ts — no changes

export const RISK_CLASSES = Object.freeze(["T", "L", "M", "H", "C"]) as readonly [
  "T",
  "L",
  "M",
  "H",
  "C",
];

export type RiskClass = (typeof RISK_CLASSES)[number];

export const RISK_CLASS_RANK: Record<RiskClass, number> = Object.freeze({
  T: 0,
  L: 1,
  M: 2,
  H: 3,
  C: 4,
});

export function isRiskClass(value: unknown): value is RiskClass {
  return typeof value === "string" && RISK_CLASSES.includes(value as RiskClass);
}

export function parseRiskClass(value: unknown): RiskClass {
  if (!isRiskClass(value)) {
    throw new TypeError(`Invalid RiskClass: ${String(value)}`);
  }
  return value;
}

export function compareRiskClass(a: RiskClass, b: RiskClass): number {
  return RISK_CLASS_RANK[a] - RISK_CLASS_RANK[b];
}

export function riskAtLeast(current: RiskClass, minimum: RiskClass): boolean {
  return compareRiskClass(current, minimum) >= 0;
}

export function maxRiskClass(classes: RiskClass[]): RiskClass {
  return classes.reduce<RiskClass>(
    (highest, candidate) => (riskAtLeast(candidate, highest) ? candidate : highest),
    "T",
  );
}
