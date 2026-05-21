/**
 * BEH-000 — Behavior Registry Initialization
 *
 * Imports all 12 behavior descriptors and registers them explicitly in the
 * dispatch registry (behavior-registry.ts) before the gate evaluator runs.
 *
 * M1 fix: all 12 behaviors now use a single explicit-registration pattern.
 * BEH-020/021/022/023 previously self-registered via import side-effects, creating
 * a mixed pattern where removing an import line silently de-registered a behavior
 * with no compile error. All registration is now auditable here in one place.
 *
 * This module must be imported by the gate entrypoint (evaluate-gate.ts imports
 * this file so behaviors are registered before the first evaluateGate() call).
 */

import { registerBehavior } from "../gates/behavior-registry.js";

// ── W1: Epistemic behaviors ───────────────────────────────────────────────────
import { readBeforeWrite } from "./beh-010-read-before-write.js";
import { suppressionGuard } from "./beh-011-suppression-guard.js";
import { chestertonFence } from "./beh-012-chesterton-fence.js";
import { claimSource } from "./beh-013-claim-source.js";
import { antiSycophancy } from "./beh-014-anti-sycophancy.js";

registerBehavior(readBeforeWrite);
registerBehavior(suppressionGuard);
registerBehavior(chestertonFence);
registerBehavior(claimSource);
registerBehavior(antiSycophancy);

// ── W2: Enforcement-teeth behaviors (explicit registration — M1 fix) ──────────
import { beh020CriticGate } from "./beh-020-critic-gate.js";
import { beh021DimensionRetry } from "./beh-021-dimension-retry.js";
import { beh022LoopDetector } from "./beh-022-loop-detector.js";
import { beh023CompletionStatus } from "./beh-023-completion-status.js";

registerBehavior(beh020CriticGate);
registerBehavior(beh021DimensionRetry);
registerBehavior(beh022LoopDetector);
registerBehavior(beh023CompletionStatus);

// ── W3: Delegation / watcher behaviors ───────────────────────────────────────
import { subagentContractCompleteness } from "./beh-030-subagent-contract.js";
import { watcherSubagentRole } from "./beh-031-watcher.js";
import { killSwitch } from "./beh-032-kill-switch.js";

registerBehavior(subagentContractCompleteness);
registerBehavior(watcherSubagentRole);
registerBehavior(killSwitch);

// Re-export all descriptors for introspection / testing
export { readBeforeWrite } from "./beh-010-read-before-write.js";
export { suppressionGuard } from "./beh-011-suppression-guard.js";
export { chestertonFence } from "./beh-012-chesterton-fence.js";
export { claimSource } from "./beh-013-claim-source.js";
export { antiSycophancy } from "./beh-014-anti-sycophancy.js";
export {
  beh020CriticGate,
  hasReviewerEvidence,
  REVIEWER_ACCEPTED_VERDICTS,
  REVIEWER_EVIDENCE_PATH,
} from "./beh-020-critic-gate.js";
export {
  beh021DimensionRetry,
  countPriorViolationAttempts,
  DIMENSION_RETRY_POLICY,
} from "./beh-021-dimension-retry.js";
export {
  appendLoopDetectorEntry,
  beh022LoopDetector,
  buildLoopDetectorEntry,
  countConsecutiveTrailingMatches,
  entriesMatch,
  LOOP_BLOCK_THRESHOLD,
  LOOP_DETECTOR_MAX_ENTRIES,
  LOOP_WARN_THRESHOLD,
  verdictFromMatchCount,
} from "./beh-022-loop-detector.js";
export {
  beh023CompletionStatus,
  findIncompleteEvidenceRecords,
  INCOMPLETE_STATUSES,
} from "./beh-023-completion-status.js";
export {
  BEH_030_DEGRADED_MODE,
  subagentContractCompleteness,
  VIOLATION_SUBAGENT_CONTRACT_INCOMPLETE,
} from "./beh-030-subagent-contract.js";
export {
  BEH_031_DEGRADED_MODE,
  VIOLATION_WATCHER_NOT_REGISTERED,
  watcherSubagentRole,
} from "./beh-031-watcher.js";
export {
  BEH_032_DEGRADED_MODE,
  buildAbortReport,
  buildProgrammaticAbortMetadata,
  killSwitch,
  VIOLATION_CYCLE_ABORT,
} from "./beh-032-kill-switch.js";
