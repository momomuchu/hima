/**
 * forcing-primitive — pickAttack()
 *
 * Translates a GateVerdict + GateCapabilityCell into the strongest ForceAction
 * available on the active runtime gate. Implements the 6-rung ladder:
 *
 *   1. noop / observe-only  (no forceIntent, no block)
 *   2. rich-inject          (ContextInject on rich-mode cell)
 *   3. constrained-inject   (ContextInject on constrained-mode cell, optionally truncated)
 *   4. skill-force          (SkillGate on canBlock cell, skill not yet in register)
 *   5. deferred-block       (SkillGate/block on deferred-enforcement cell)
 *   6. hard-block           (block or SkillGate on canBlock cell)
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §3.2, ARCHITECTURE-FLOW-v3.md §3.
 */

import type {
  ForceAction,
  GateCapabilityCell,
  GateType,
  GateVerdict,
  SkillRef,
} from "@norm/schemas";

/** Supported runtime targets. Kept as an inline literal union to avoid sibling imports. */
export type RuntimeTarget = "claude" | "codex" | "hermes" | "opencode";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSkillAlreadyRegistered(
  skillId: string,
  register: SkillRef[],
): boolean {
  return register.some((ref) => ref.id === skillId);
}

function truncateToBytes(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) return text;
  // Slice to maxBytes and decode safely (may trim partial multi-byte char)
  const decoder = new TextDecoder("utf-8", { fatal: false });
  return decoder.decode(bytes.slice(0, maxBytes));
}

// ---------------------------------------------------------------------------
// pickAttack — core 6-rung ladder
// ---------------------------------------------------------------------------

/**
 * Return the strongest ForceAction available for this gate event, given the
 * active runtime capability cell, the current gate verdict, and the skill register
 * (already-invoked skills in this session).
 *
 * The function is pure and synchronous. It never reads from or writes to the
 * filesystem. File-write side-effects (e.g. pending-stop-verdict.json) are the
 * caller's responsibility.
 */
export function pickAttack(
  _runtime: RuntimeTarget,
  _gateType: GateType,
  verdict: GateVerdict,
  skillRegister: SkillRef[],
  cell: GateCapabilityCell,
): ForceAction {
  const { decision, forceIntent } = verdict;

  // ------------------------------------------------------------------
  // Branch A — no force intent present
  // ------------------------------------------------------------------
  if (!forceIntent) {
    if (decision !== "block") {
      // Nothing to force, and no block signal → noop
      return { kind: "noop" };
    }
    // Block with no forceIntent: fall through to plain-block logic below
    return plainBlock(cell, "gate verdict: block with no forceIntent");
  }

  // ------------------------------------------------------------------
  // Branch B — ContextInject intent
  // ------------------------------------------------------------------
  if (forceIntent.kind === "ContextInject") {
    return resolveContextInject(forceIntent.content, cell);
  }

  // ------------------------------------------------------------------
  // Branch C — SkillGate intent
  // ------------------------------------------------------------------
  if (forceIntent.kind === "SkillGate") {
    const { skillId, blocksUntilInvoked } = forceIntent;

    // If skill is already in the register → noop (do not re-force)
    if (isSkillAlreadyRegistered(skillId, skillRegister)) {
      return { kind: "noop" };
    }

    // Skill not yet invoked:
    if (cell.canBlock) {
      return {
        kind: "skill-force",
        skillId,
        reason: blocksUntilInvoked
          ? `skill ${skillId} is required and not yet invoked`
          : `skill ${skillId} recommended — gate will block until invoked`,
      };
    }

    if (cell.enforcementStrength === "deferred") {
      return {
        kind: "deferred-block",
        verdictFile: ".hima/state/pending-stop-verdict.json",
        reason: `skill ${skillId} required but gate cannot block synchronously on this runtime`,
        resolveOn: ["pre_tool", "user_prompt"],
      };
    }

    // canBlock false AND not deferred → inject skill context instead
    const reason = `skill ${skillId} required; injected as context (gate cannot block)`;
    return resolveContextInject(reason, cell);
  }

  // ------------------------------------------------------------------
  // Branch D — DeferredBlock intent
  // ------------------------------------------------------------------
  if (forceIntent.kind === "DeferredBlock") {
    return {
      kind: "deferred-block",
      verdictFile: ".hima/state/pending-stop-verdict.json",
      reason: forceIntent.reason,
      resolveOn: [...forceIntent.resolveOn],
    };
  }

  // ------------------------------------------------------------------
  // Branch E — verdict is block but forceIntent was something unexpected
  //            (exhaustiveness safety net)
  // ------------------------------------------------------------------
  if (decision === "block") {
    return plainBlock(cell, "gate verdict: block");
  }

  return { kind: "noop" };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function plainBlock(
  cell: GateCapabilityCell,
  reason: string,
): ForceAction {
  if (cell.canBlock) {
    return { kind: "hard-block", reason };
  }
  if (cell.enforcementStrength === "deferred") {
    return {
      kind: "deferred-block",
      verdictFile: ".hima/state/pending-stop-verdict.json",
      reason,
      resolveOn: ["pre_tool", "user_prompt"],
    };
  }
  return { kind: "observe-only", log: `[observe] ${reason}` };
}

function resolveContextInject(
  content: string,
  cell: GateCapabilityCell,
): ForceAction {
  if (cell.injectionMode === "rich") {
    return { kind: "rich-inject", content };
  }
  if (cell.injectionMode === "constrained") {
    const systemMessage =
      cell.maxInjectionBytes !== undefined
        ? truncateToBytes(content, cell.maxInjectionBytes)
        : content;
    return { kind: "constrained-inject", systemMessage };
  }
  // injectionMode === "none"
  return {
    kind: "observe-only",
    log: `[observe] cannot inject on this runtime; content suppressed`,
  };
}
