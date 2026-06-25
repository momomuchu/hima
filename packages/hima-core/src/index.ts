/**
 * @hima/core — public surface.
 *
 * Re-exports everything from the five core modules so consumers can import
 * directly from "@hima/core" without knowing the internal file layout.
 *
 * NOTE: Both capability-map-v3 and forcing-primitive independently export a
 * `RuntimeTarget` type with the same shape ("claude" | "codex" | "hermes").
 * We expose it once via capability-map-v3 and exclude the duplicate from
 * forcing-primitive to keep the public surface unambiguous.
 */

export * from "./keyword.js";
export * from "./capability-map-v3.js";

// forcing-primitive exports RuntimeTarget too — exclude it to avoid the
// TS2308 "already exported" ambiguity; the one from capability-map-v3 is canonical.
export {
  pickAttack,
} from "./forcing-primitive.js";

export * from "./skill-state.js";
export * from "./ward-store.js";
export { translateClaude } from "./adapter-claude.js";
export type { ClaudeResponse } from "./adapter-claude.js";
export { runGate } from "./run-gate.js";
export type { RunGateInput, RunGateResult } from "./run-gate.js";
