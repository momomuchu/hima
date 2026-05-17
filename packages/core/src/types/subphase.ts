export const SUB_PHASES = Object.freeze([
  "Observer",
  "Define",
  "Design",
  "Execute",
  "Verify",
  "Capitalize",
  "Transmit",
]) as readonly ["Observer", "Define", "Design", "Execute", "Verify", "Capitalize", "Transmit"];

export type SubPhase = (typeof SUB_PHASES)[number];
export const DEFAULT_SUB_PHASE = "Observer" satisfies SubPhase;

export function isSubPhaseValue(value: unknown): value is SubPhase {
  return typeof value === "string" && SUB_PHASES.includes(value as SubPhase);
}

export function parseSubPhase(value: unknown): SubPhase {
  if (!isSubPhaseValue(value)) {
    throw new TypeError(`Invalid SubPhase: ${String(value)}`);
  }

  return value;
}

export function assertSubPhase(value: unknown): asserts value is SubPhase {
  parseSubPhase(value);
}
