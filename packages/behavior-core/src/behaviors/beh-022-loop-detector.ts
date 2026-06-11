// Ported from packages/core/src/behaviors/beh-022-loop-detector.ts — no logic changes

import { hashContent } from "../action-signal.js";
import type { BehaviorDescriptor, BehaviorVerdict, GateEvaluationContext } from "../behavior-registry.js";
import type { GateEvent } from "../gate-event.js";
import type { LoopDetector, LoopDetectorEntry } from "../run-set-types.js";

export const LOOP_DETECTOR_MAX_ENTRIES = 10;
export const LOOP_WARN_THRESHOLD = 2;
export const LOOP_BLOCK_THRESHOLD = 3;
export const EMPTY_CONTENT_SENTINEL = "empty";

export function buildLoopDetectorEntry(event: GateEvent): LoopDetectorEntry {
  const rawArgs = hashContent(event.toolInput);
  const rawResult = hashContent(event.toolOutput);
  return {
    toolName: event.toolName?.length ? event.toolName : "unknown",
    argsHash: rawArgs.length > 0 ? rawArgs : EMPTY_CONTENT_SENTINEL,
    resultHash: rawResult.length > 0 ? rawResult : EMPTY_CONTENT_SENTINEL,
    ts: new Date().toISOString(),
  };
}

export function entriesMatch(a: LoopDetectorEntry, b: LoopDetectorEntry): boolean {
  return a.toolName === b.toolName && a.argsHash === b.argsHash && a.resultHash === b.resultHash;
}

export function countConsecutiveTrailingMatches(entries: readonly LoopDetectorEntry[], candidate: LoopDetectorEntry): number {
  let count = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry !== undefined && entriesMatch(entry, candidate)) {
      count++;
    } else {
      break;
    }
  }
  return count + 1;
}

export function appendLoopDetectorEntry(current: LoopDetector | undefined, entry: LoopDetectorEntry): LoopDetector {
  const maxEntries = current?.maxEntries ?? LOOP_DETECTOR_MAX_ENTRIES;
  const existing = current?.entries ?? [];
  const consecutiveMatches = countConsecutiveTrailingMatches(existing, entry);
  const updated = [...existing, entry];
  const trimmed = updated.length > maxEntries ? updated.slice(updated.length - maxEntries) : updated;
  return { entries: trimmed, maxEntries, consecutiveMatchCount: consecutiveMatches };
}

export function verdictFromMatchCount(count: number): BehaviorVerdict {
  if (count >= LOOP_BLOCK_THRESHOLD) {
    return {
      decision: "block",
      reason:
        `BEH-022: LOOP_DETECTED — ${count} consecutive identical ` +
        "(toolName, argsHash, resultHash) triples observed. " +
        "The agent is repeating the same tool call with identical arguments " +
        "and receiving identical results. Terminating with LOOP_DETECTED.",
      finalState: "LOOP_DETECTED",
    };
  }
  if (count >= LOOP_WARN_THRESHOLD) {
    return {
      decision: "warn",
      reason:
        `BEH-022: LOOP_WARNING — ${count} consecutive identical triples observed. ` +
        `A third identical triple will trigger LOOP_DETECTED (block).`,
    };
  }
  return null;
}

export const beh022LoopDetector: BehaviorDescriptor = {
  id: "BEH-022",
  name: "Loop Detection — Sliding Window with LOOP_DETECTED Emission",
  gates: ["post_tool"],

  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    const candidate = buildLoopDetectorEntry(event);
    const loopDetector = context.runSet.loopDetector;
    const existingEntries = loopDetector?.entries ?? [];
    const consecutiveMatches = countConsecutiveTrailingMatches(existingEntries, candidate);
    return verdictFromMatchCount(consecutiveMatches);
  },
};
