// S-slice: additive enum extension — no behaviour change in this commit.
// "bypass" and "auto" and "pairing" are preserved for full backward-compat.
// "full-bypass" = M0 explicit alias; "checkpoint" = M2; "explicit" = M3.
// "bypass" (legacy) maps to M0 semantics at the gate layer (B-slice).
export const OPERATING_MODES = Object.freeze([
  "bypass",       // legacy alias → M0 (full-bypass) semantics
  "auto",         // M1 — full-auto (DEFAULT)
  "pairing",      // legacy co-pilot / M2 partial (kept for compat)
  "full-bypass",  // M0 — explicit full-bypass
  "checkpoint",   // M2 — checkpoint-gated (pauses at architecture/build boundary)
  "explicit",     // M3 — explicit-pipeline (no auto-extension beyond named window)
]) as readonly ["bypass", "auto", "pairing", "full-bypass", "checkpoint", "explicit"];

export type OperatingMode = (typeof OPERATING_MODES)[number];

export function isOperatingMode(value: unknown): value is OperatingMode {
  return typeof value === "string" && OPERATING_MODES.includes(value as OperatingMode);
}

export function parseOperatingMode(value: unknown): OperatingMode {
  if (!isOperatingMode(value)) {
    throw new TypeError(`Invalid OperatingMode: ${String(value)}`);
  }

  return value;
}

export function assertOperatingMode(value: unknown): asserts value is OperatingMode {
  parseOperatingMode(value);
}
