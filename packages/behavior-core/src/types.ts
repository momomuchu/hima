// Minimal shared types for behavior-core — derived from packages/core/src/types/canonical.ts

export const GATE_TYPES = [
  "session_start",
  "user_prompt",
  "pre_tool",
  "post_tool",
  "pre_compact",
  "post_compact",
  "stop",
  "subagent_start",
  "subagent_stop",
] as const;

export type GateType = (typeof GATE_TYPES)[number];

export const GATE_DECISIONS = ["allow", "warn", "block"] as const;
export type GateDecision = (typeof GATE_DECISIONS)[number];

export const FINAL_STATES = [
  "DONE_VERIFIED",
  "DONE_WITH_GAPS",
  "BLOCKED_NEEDS_USER",
  "BLOCKED_RUNTIME_MISSING",
  "BLOCKED_POLICY",
  "MAX_ATTEMPTS_REACHED",
  "LOOP_DETECTED",
  "CANCELLED",
] as const;

export type FinalState = (typeof FINAL_STATES)[number];

export const QUALITY_DIMENSIONS = [
  "security",
  "tests",
  "review",
  "evidence",
  "suppression",
] as const;

export type QualityDimension = (typeof QUALITY_DIMENSIONS)[number];

export const COMPLETION_STATUSES = [
  "DONE_VERIFIED",
  "DONE_UNTESTED",
  "ATTEMPTED_UNCONFIRMED",
] as const;

export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];
