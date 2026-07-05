/**
 * Tests for forcing-primitive / pickAttack()
 *
 * Covers the 4 mandated scenarios plus edges:
 *  1. SkillGate + empty register + claude pre_tool cell → skill-force
 *  2. SkillGate + skill already in register → noop
 *  3. block + hermes stop cell (canBlock false, deferred) → deferred-block
 *  4. ContextInject + codex constrained cell with maxInjectionBytes → constrained-inject truncated
 *
 * Additional:
 *  5. no forceIntent + allow verdict → noop
 *  6. block + canBlock true → hard-block
 *  7. ContextInject + rich cell → rich-inject (full content)
 *  8. ContextInject + none injection cell → observe-only
 *  9. SkillGate + canBlock false + not deferred → constrained-inject (fallback inject)
 * 10. DeferredBlock intent → deferred-block with forceIntent reason
 */

import { describe, expect, it } from "vitest";
import type { GateCapabilityCell, GateVerdict, SkillRef } from "@norm/schemas";
import { pickAttack } from "../src/forcing-primitive.js";
import type { RuntimeTarget } from "../src/forcing-primitive.js";

// ---------------------------------------------------------------------------
// Shared cell fixtures
// ---------------------------------------------------------------------------

/** Claude pre_tool cell: canBlock true, rich inject, hard enforcement */
const claudePreToolCell: GateCapabilityCell = {
  gateType: "pre_tool",
  level: "supported",
  canBlock: true,
  injectionMode: "rich",
  enforcementStrength: "hard",
  skillForcing: true,
  compensatingMechanism: "none",
  universal: true,
  subagents: "native",
  profiles: "runtime-profiles",
};

/** Codex user_prompt cell: canBlock true, constrained inject, maxInjectionBytes 1800 */
const codexUserPromptCell: GateCapabilityCell = {
  gateType: "user_prompt",
  level: "supported",
  canBlock: true,
  injectionMode: "constrained",
  enforcementStrength: "hard",
  skillForcing: false,
  compensatingMechanism: "keyword_detection_user_prompt",
  maxInjectionBytes: 1800,
  universal: true,
  subagents: "poll-file",
  profiles: "injected-role-context",
};

/** Hermes stop cell: canBlock false, deferred enforcement */
const hermesStopCell: GateCapabilityCell = {
  gateType: "stop",
  level: "degraded",
  canBlock: false,
  injectionMode: "constrained",
  enforcementStrength: "deferred",
  skillForcing: false,
  compensatingMechanism: "deferred_stop_verdict",
  universal: false,
  subagents: "absent",
  profiles: "injected-role-context",
};

/** Claude user_prompt cell: canBlock true, rich inject */
const claudeUserPromptCell: GateCapabilityCell = {
  gateType: "user_prompt",
  level: "supported",
  canBlock: true,
  injectionMode: "rich",
  enforcementStrength: "hard",
  skillForcing: true,
  compensatingMechanism: "none",
  universal: true,
  subagents: "native",
  profiles: "runtime-profiles",
};

/** Cell with injectionMode "none": observe-only fallback */
const noneInjectionCell: GateCapabilityCell = {
  gateType: "post_tool",
  level: "absent",
  canBlock: false,
  injectionMode: "none",
  enforcementStrength: "observe_only",
  skillForcing: false,
  compensatingMechanism: "none",
  universal: false,
  subagents: "absent",
  profiles: "none",
};

/** Codex pre_tool cell without skillForcing: canBlock true but injectionMode constrained */
const codexPreToolCell: GateCapabilityCell = {
  gateType: "pre_tool",
  level: "supported",
  canBlock: true,
  injectionMode: "constrained",
  enforcementStrength: "hard",
  skillForcing: false,
  compensatingMechanism: "none",
  universal: true,
  subagents: "poll-file",
  profiles: "injected-role-context",
};

/** Cell: canBlock false, advisory (not deferred) — forces constrained inject fallback */
const advisoryCell: GateCapabilityCell = {
  gateType: "post_compact",
  level: "degraded",
  canBlock: false,
  injectionMode: "constrained",
  enforcementStrength: "advisory",
  skillForcing: false,
  compensatingMechanism: "none",
  universal: false,
  subagents: "absent",
  profiles: "none",
};

// ---------------------------------------------------------------------------
// Helper to build a GateVerdict
// ---------------------------------------------------------------------------

function blockVerdict(reason = "gate blocked"): GateVerdict {
  return { decision: "block", reason };
}

function allowVerdict(reason = "gate passed"): GateVerdict {
  return { decision: "allow", reason };
}

function skillGateVerdict(
  skillId: string,
  blocksUntilInvoked = true,
): GateVerdict {
  return {
    decision: "block",
    reason: `skill ${skillId} required`,
    forceIntent: { kind: "SkillGate", skillId, blocksUntilInvoked },
  };
}

function contextInjectVerdict(content: string): GateVerdict {
  return {
    decision: "warn",
    reason: "inject context",
    forceIntent: { kind: "ContextInject", content },
  };
}

function deferredBlockVerdict(
  reason: string,
  resolveOn: string[] = ["pre_tool", "user_prompt"],
): GateVerdict {
  return {
    decision: "block",
    reason,
    forceIntent: { kind: "DeferredBlock", reason, resolveOn },
  };
}

// ---------------------------------------------------------------------------
// Empty skill register helper
// ---------------------------------------------------------------------------

const emptyRegister: SkillRef[] = [];

function registerWith(id: string): SkillRef[] {
  return [{ source: "corpus", id }];
}

// ---------------------------------------------------------------------------
// Scenario 1 — SkillGate + empty register + claude pre_tool cell → skill-force
// ---------------------------------------------------------------------------

describe("Scenario 1: SkillGate + empty register + claude pre_tool cell", () => {
  it("returns skill-force when skill not yet in register and canBlock is true", () => {
    const verdict = skillGateVerdict("corpus-spec-driven-development");
    const result = pickAttack(
      "claude",
      "pre_tool",
      verdict,
      emptyRegister,
      claudePreToolCell,
    );
    expect(result.kind).toBe("skill-force");
    if (result.kind === "skill-force") {
      expect(result.skillId).toBe("corpus-spec-driven-development");
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("reason mentions the skill id", () => {
    const verdict = skillGateVerdict("corpus-architecture-system-design");
    const result = pickAttack(
      "claude",
      "pre_tool",
      verdict,
      emptyRegister,
      claudePreToolCell,
    );
    expect(result.kind).toBe("skill-force");
    if (result.kind === "skill-force") {
      expect(result.reason).toContain("corpus-architecture-system-design");
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — SkillGate + skill already in register → noop
// ---------------------------------------------------------------------------

describe("Scenario 2: SkillGate + skill already in register", () => {
  it("returns noop when skill is already registered", () => {
    const skillId = "corpus-spec-driven-development";
    const verdict = skillGateVerdict(skillId);
    const result = pickAttack(
      "claude",
      "pre_tool",
      verdict,
      registerWith(skillId),
      claudePreToolCell,
    );
    expect(result.kind).toBe("noop");
  });

  it("noop when skill in register even if cell canBlock is true", () => {
    const verdict = skillGateVerdict("corpus-code-quality-maintainability");
    const result = pickAttack(
      "claude",
      "user_prompt",
      verdict,
      registerWith("corpus-code-quality-maintainability"),
      claudeUserPromptCell,
    );
    expect(result.kind).toBe("noop");
  });

  it("does not noop when a different skill is already in register", () => {
    const verdict = skillGateVerdict("corpus-ui-knowledge");
    const result = pickAttack(
      "claude",
      "pre_tool",
      verdict,
      registerWith("corpus-spec-driven-development"), // different skill
      claudePreToolCell,
    );
    expect(result.kind).toBe("skill-force");
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — block + hermes stop cell (canBlock false, deferred) → deferred-block
// ---------------------------------------------------------------------------

describe("Scenario 3: block + hermes stop cell (canBlock false, deferred enforcement)", () => {
  it("returns deferred-block when canBlock is false and enforcementStrength is deferred", () => {
    const verdict = blockVerdict("stop gate triggered on hermes");
    const result = pickAttack(
      "hermes",
      "stop",
      verdict,
      emptyRegister,
      hermesStopCell,
    );
    expect(result.kind).toBe("deferred-block");
    if (result.kind === "deferred-block") {
      expect(result.verdictFile).toBe(".hima/state/pending-stop-verdict.json");
      expect(Array.isArray(result.resolveOn)).toBe(true);
      expect(result.resolveOn).toContain("pre_tool");
      expect(result.resolveOn).toContain("user_prompt");
    }
  });

  it("deferred-block when SkillGate on hermes stop cell (canBlock false, deferred)", () => {
    const verdict = skillGateVerdict("corpus-observability");
    const result = pickAttack(
      "hermes",
      "stop",
      verdict,
      emptyRegister,
      hermesStopCell,
    );
    expect(result.kind).toBe("deferred-block");
    if (result.kind === "deferred-block") {
      expect(result.verdictFile).toBe(".hima/state/pending-stop-verdict.json");
      expect(result.resolveOn).toContain("pre_tool");
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 4 — ContextInject + codex constrained cell with maxInjectionBytes → truncated constrained-inject
// ---------------------------------------------------------------------------

describe("Scenario 4: ContextInject + codex constrained cell with maxInjectionBytes", () => {
  it("returns constrained-inject for short content within limit", () => {
    const content = "You must apply corpus-spec-driven-development before writing code.";
    const verdict = contextInjectVerdict(content);
    const result = pickAttack(
      "codex",
      "user_prompt",
      verdict,
      emptyRegister,
      codexUserPromptCell,
    );
    expect(result.kind).toBe("constrained-inject");
    if (result.kind === "constrained-inject") {
      expect(result.systemMessage).toBe(content); // short content: unchanged
    }
  });

  it("truncates systemMessage when content exceeds maxInjectionBytes", () => {
    // Generate content well over 1800 bytes
    const longContent = "A".repeat(3000);
    const verdict = contextInjectVerdict(longContent);
    const result = pickAttack(
      "codex",
      "user_prompt",
      verdict,
      emptyRegister,
      codexUserPromptCell,
    );
    expect(result.kind).toBe("constrained-inject");
    if (result.kind === "constrained-inject") {
      // systemMessage must be no longer than maxInjectionBytes bytes when encoded
      const encoder = new TextEncoder();
      const byteLen = encoder.encode(result.systemMessage).length;
      expect(byteLen).toBeLessThanOrEqual(1800);
    }
  });

  it("does not truncate when content is exactly at the byte limit", () => {
    const content = "B".repeat(1800); // exactly 1800 ASCII bytes
    const verdict = contextInjectVerdict(content);
    const result = pickAttack(
      "codex",
      "user_prompt",
      verdict,
      emptyRegister,
      codexUserPromptCell,
    );
    expect(result.kind).toBe("constrained-inject");
    if (result.kind === "constrained-inject") {
      expect(result.systemMessage).toBe(content);
    }
  });

  it("truncates multi-byte unicode content to byte limit", () => {
    // Each '€' is 3 UTF-8 bytes; 700 × '€' = 2100 bytes > 1800
    const content = "€".repeat(700);
    const verdict = contextInjectVerdict(content);
    const result = pickAttack(
      "codex",
      "user_prompt",
      verdict,
      emptyRegister,
      codexUserPromptCell,
    );
    expect(result.kind).toBe("constrained-inject");
    if (result.kind === "constrained-inject") {
      const encoder = new TextEncoder();
      expect(encoder.encode(result.systemMessage).length).toBeLessThanOrEqual(1800);
    }
  });
});

// ---------------------------------------------------------------------------
// Additional scenario 5 — no forceIntent + allow verdict → noop
// ---------------------------------------------------------------------------

describe("Scenario 5: no forceIntent + allow verdict", () => {
  it("returns noop when verdict is allow and no forceIntent", () => {
    const verdict = allowVerdict("no constraints triggered");
    const result = pickAttack(
      "claude",
      "user_prompt",
      verdict,
      emptyRegister,
      claudeUserPromptCell,
    );
    expect(result.kind).toBe("noop");
  });

  it("returns noop when verdict is warn and no forceIntent", () => {
    const verdict: GateVerdict = { decision: "warn", reason: "advisory only" };
    const result = pickAttack(
      "codex",
      "pre_tool",
      verdict,
      emptyRegister,
      codexPreToolCell,
    );
    expect(result.kind).toBe("noop");
  });
});

// ---------------------------------------------------------------------------
// Additional scenario 6 — block + canBlock true → hard-block
// ---------------------------------------------------------------------------

describe("Scenario 6: plain block + canBlock true → hard-block", () => {
  it("returns hard-block when verdict is block and cell canBlock is true, no forceIntent", () => {
    const verdict = blockVerdict("pre_tool blocked by rule");
    const result = pickAttack(
      "claude",
      "pre_tool",
      verdict,
      emptyRegister,
      claudePreToolCell,
    );
    expect(result.kind).toBe("hard-block");
    if (result.kind === "hard-block") {
      expect(typeof result.reason).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// Additional scenario 7 — ContextInject + rich cell → rich-inject (full content)
// ---------------------------------------------------------------------------

describe("Scenario 7: ContextInject + rich inject cell", () => {
  it("returns rich-inject with unchanged content on a rich cell", () => {
    const content = "You are operating under PFV4 governance rules.";
    const verdict = contextInjectVerdict(content);
    const result = pickAttack(
      "claude",
      "user_prompt",
      verdict,
      emptyRegister,
      claudeUserPromptCell,
    );
    expect(result.kind).toBe("rich-inject");
    if (result.kind === "rich-inject") {
      expect(result.content).toBe(content);
    }
  });
});

// ---------------------------------------------------------------------------
// Additional scenario 8 — ContextInject + none injection cell → observe-only
// ---------------------------------------------------------------------------

describe("Scenario 8: ContextInject + injectionMode=none → observe-only", () => {
  it("returns observe-only when injection mode is none", () => {
    const verdict = contextInjectVerdict("inject this context");
    const result = pickAttack(
      "codex",
      "post_tool",
      verdict,
      emptyRegister,
      noneInjectionCell,
    );
    expect(result.kind).toBe("observe-only");
  });
});

// ---------------------------------------------------------------------------
// Additional scenario 9 — SkillGate + canBlock false + advisory → inject fallback
// ---------------------------------------------------------------------------

describe("Scenario 9: SkillGate + canBlock false + advisory enforcement", () => {
  it("falls back to inject when canBlock=false and enforcementStrength=advisory", () => {
    const verdict = skillGateVerdict("corpus-performance-engineering");
    const result = pickAttack(
      "hermes",
      "post_compact",
      verdict,
      emptyRegister,
      advisoryCell, // canBlock: false, enforcementStrength: advisory, injectionMode: constrained
    );
    // Not skill-force (canBlock false), not deferred (not deferred), falls to inject
    expect(result.kind).toBe("constrained-inject");
  });
});

// ---------------------------------------------------------------------------
// Additional scenario 10 — DeferredBlock intent → deferred-block with intent reason
// ---------------------------------------------------------------------------

describe("Scenario 10: DeferredBlock intent → deferred-block", () => {
  it("returns deferred-block with the forceIntent reason and resolveOn list", () => {
    const reason = "stop gate degraded on this runtime";
    const verdict = deferredBlockVerdict(reason, ["pre_tool", "user_prompt"]);
    const result = pickAttack(
      "hermes",
      "stop",
      verdict,
      emptyRegister,
      hermesStopCell,
    );
    expect(result.kind).toBe("deferred-block");
    if (result.kind === "deferred-block") {
      expect(result.reason).toBe(reason);
      expect(result.resolveOn).toEqual(["pre_tool", "user_prompt"]);
      expect(result.verdictFile).toBe(".hima/state/pending-stop-verdict.json");
    }
  });
});
