// Hook response formatters for Claude and Hermes runtimes.
// Mirrors the format contracts observed in packages/cli/src/index.ts.

import type { GateType, Verdict } from "./types.js";

function withAdditionalContext(
  output: Record<string, unknown>,
  hookEventName: string,
  additionalContext: string | undefined,
): Record<string, unknown> {
  if (additionalContext === undefined) return output;
  return { ...output, hookSpecificOutput: { hookEventName, additionalContext } };
}

export function formatForClaude(
  gateType: GateType,
  verdict: Verdict,
): Record<string, unknown> {
  const blocked = verdict.decision === "block";
  const output: Record<string, unknown> = {};

  if (blocked && gateType !== "pre_tool") {
    output.decision = "block";
    output.reason = verdict.reason;
  } else if (verdict.decision === "warn") {
    output.systemMessage = verdict.reason;
  }

  if (gateType === "pre_tool") {
    output.hookSpecificOutput = {
      hookEventName: "PreToolUse",
      permissionDecision: blocked ? "deny" : "allow",
      permissionDecisionReason: verdict.reason,
    };
    return output;
  }

  if (gateType === "session_start") {
    return withAdditionalContext(output, "SessionStart", verdict.contextInjection);
  }

  if (gateType === "user_prompt") {
    return withAdditionalContext(output, "UserPromptSubmit", verdict.contextInjection);
  }

  if (gateType === "post_tool") {
    const ctx = verdict.contextInjection ?? (verdict.decision === "allow" ? undefined : verdict.reason);
    return withAdditionalContext(output, "PostToolUse", ctx);
  }

  if (gateType === "subagent_start") {
    return withAdditionalContext(output, "SubagentStart", verdict.contextInjection);
  }

  if (gateType === "stop") {
    return blocked ? output : withAdditionalContext(output, "Stop", verdict.reason);
  }

  if (gateType === "subagent_stop") {
    return withAdditionalContext(output, "SubagentStop", verdict.reason);
  }

  return output;
}

export function formatForHermes(
  gateType: GateType,
  verdict: Verdict,
): Record<string, unknown> {
  const blocked = verdict.decision === "block";

  if (gateType === "pre_tool") {
    return blocked
      ? {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: verdict.reason,
          },
        }
      : {};
  }

  if (gateType === "session_start") {
    return withAdditionalContext({}, "SessionStart", verdict.contextInjection);
  }

  if (gateType === "user_prompt") {
    return blocked
      ? { decision: "block", reason: verdict.reason }
      : withAdditionalContext({}, "UserPromptSubmit", verdict.contextInjection);
  }

  if (gateType === "post_tool") {
    const base = blocked
      ? { decision: "block", reason: verdict.reason }
      : verdict.decision === "warn"
        ? { systemMessage: verdict.reason }
        : {};
    const ctx = verdict.contextInjection ?? (verdict.decision === "allow" ? undefined : verdict.reason);
    return withAdditionalContext(base, "PostToolUse", ctx);
  }

  if (gateType === "stop") {
    return blocked ? { decision: "block", reason: verdict.reason } : {};
  }

  if (gateType === "subagent_start") {
    return blocked
      ? { decision: "block", reason: verdict.reason }
      : withAdditionalContext({}, "SubagentStart", verdict.contextInjection);
  }

  if (gateType === "subagent_stop") {
    return blocked ? { decision: "block", reason: verdict.reason } : {};
  }

  return verdict.decision === "warn" ? { systemMessage: verdict.reason } : {};
}

export function formatVerdict(
  gateType: GateType,
  verdict: Verdict,
  format: string,
): Record<string, unknown> {
  if (format === "claude") return formatForClaude(gateType, verdict);
  if (format === "hermes") return formatForHermes(gateType, verdict);
  return verdict as unknown as Record<string, unknown>;
}
