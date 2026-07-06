import { describe, it, expect } from "vitest";
import { getCell, CLAUDE_MAP, CODEX_MAP, HERMES_MAP } from "../src/capability-map-v3.js";

// ---------------------------------------------------------------------------
// Helper: all gate types for exhaustiveness checks
// ---------------------------------------------------------------------------

const ALL_GATE_TYPES = [
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

const ALL_RUNTIMES = ["claude", "codex", "hermes"] as const;

// ---------------------------------------------------------------------------
// Core invariants (from KEY DATA spec)
// ---------------------------------------------------------------------------

describe("capability-map-v3 — universal invariants", () => {
  it("user_prompt is universal:true and canBlock:true on all runtimes", () => {
    for (const runtime of ALL_RUNTIMES) {
      const c = getCell(runtime, "user_prompt");
      expect(c.universal, `${runtime}/user_prompt universal`).toBe(true);
      expect(c.canBlock, `${runtime}/user_prompt canBlock`).toBe(true);
    }
  });

  it("pre_tool is universal:true and canBlock:true on all runtimes", () => {
    for (const runtime of ALL_RUNTIMES) {
      const c = getCell(runtime, "pre_tool");
      expect(c.universal, `${runtime}/pre_tool universal`).toBe(true);
      expect(c.canBlock, `${runtime}/pre_tool canBlock`).toBe(true);
    }
  });

  it("every cell has gateType matching the key it was looked up by", () => {
    for (const runtime of ALL_RUNTIMES) {
      for (const gt of ALL_GATE_TYPES) {
        const c = getCell(runtime, gt);
        expect(c.gateType, `${runtime}/${gt} gateType field`).toBe(gt);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Claude-specific
// ---------------------------------------------------------------------------

describe("capability-map-v3 — claude runtime", () => {
  it("pre_tool: canBlock=true, universal=true, injectionMode=rich, enforcementStrength=hard", () => {
    const c = getCell("claude", "pre_tool");
    expect(c.canBlock).toBe(true);
    expect(c.universal).toBe(true);
    expect(c.injectionMode).toBe("rich");
    expect(c.enforcementStrength).toBe("hard");
  });

  it("user_prompt: injectionMode=rich, subagents=native", () => {
    const c = getCell("claude", "user_prompt");
    expect(c.injectionMode).toBe("rich");
    expect(c.subagents).toBe("native");
  });

  it("subagent_start: subagents=native, level=supported", () => {
    const c = getCell("claude", "subagent_start");
    expect(c.subagents).toBe("native");
    expect(c.level).toBe("supported");
  });

  // SOT correction C2 (docs/research/runtime-capabilities.sot.json): Claude's
  // SubagentStart hook is INJECTION-ONLY — it cannot block. SubagentStop is the
  // blocking sibling. A prior canBlock:true here was a dark gate (never actually
  // enforceable). Worker-model enforcement moved to pre_tool — see
  // beh-worker-model.test.ts for the re-wired coverage.
  it("subagent_start: canBlock=false (injection-only, SOT C2)", () => {
    const c = getCell("claude", "subagent_start");
    expect(c.canBlock).toBe(false);
    expect(c.enforcementStrength).toBe("advisory");
  });

  it("stop: canBlock=true, enforcementStrength=hard", () => {
    const c = getCell("claude", "stop");
    expect(c.canBlock).toBe(true);
    expect(c.enforcementStrength).toBe("hard");
  });

  it("all claude cells have subagents=native", () => {
    for (const gt of ALL_GATE_TYPES) {
      expect(CLAUDE_MAP[gt].subagents, `claude/${gt}`).toBe("native");
    }
  });

  it("all claude cells have injectionMode=rich except none-level gates", () => {
    // All claude gates have rich injection (no absent gates on claude)
    for (const gt of ALL_GATE_TYPES) {
      expect(CLAUDE_MAP[gt].injectionMode, `claude/${gt}`).toBe("rich");
    }
  });
});

// ---------------------------------------------------------------------------
// Codex-specific
// ---------------------------------------------------------------------------

describe("capability-map-v3 — codex runtime", () => {
  it("user_prompt: injectionMode=constrained, universal=true, canBlock=true", () => {
    const c = getCell("codex", "user_prompt");
    expect(c.injectionMode).toBe("constrained");
    expect(c.universal).toBe(true);
    expect(c.canBlock).toBe(true);
  });

  // SOT correction C1 (docs/research/runtime-capabilities.sot.json): there is NO
  // documented injection-byte cap on Codex — "1800" was a misread of the
  // 1800-SECOND agents.job_max_runtime_seconds timeout, not a byte limit. Real
  // Codex doc-size caps (AGENTS.md 32 KiB, skill-listing 8000 chars) are
  // unrelated mechanisms, so maxInjectionBytes is left undefined.
  it("user_prompt: maxInjectionBytes is undefined (no documented cap, SOT C1)", () => {
    const c = getCell("codex", "user_prompt");
    expect(c.maxInjectionBytes).toBeUndefined();
  });

  it("pre_tool: canBlock=true, injectionMode=constrained, maxInjectionBytes undefined (SOT C1)", () => {
    const c = getCell("codex", "pre_tool");
    expect(c.canBlock).toBe(true);
    expect(c.injectionMode).toBe("constrained");
    expect(c.maxInjectionBytes).toBeUndefined();
  });

  it("stop: canBlock=true (primary enforcement gate)", () => {
    const c = getCell("codex", "stop");
    expect(c.canBlock).toBe(true);
    expect(c.enforcementStrength).toBe("hard");
  });

  it("pre_compact and post_compact are absent on codex", () => {
    expect(getCell("codex", "pre_compact").level).toBe("absent");
    expect(getCell("codex", "post_compact").level).toBe("absent");
  });

  it("subagents are poll-file on all codex gates", () => {
    for (const gt of ALL_GATE_TYPES) {
      expect(CODEX_MAP[gt].subagents, `codex/${gt}`).toBe("poll-file");
    }
  });

  it("constrained gates have maxInjectionBytes undefined (no documented cap, SOT C1)", () => {
    for (const gt of ALL_GATE_TYPES) {
      const c = CODEX_MAP[gt];
      if (c.injectionMode === "constrained") {
        expect(c.maxInjectionBytes, `codex/${gt} maxInjectionBytes`).toBeUndefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Hermes-specific
// ---------------------------------------------------------------------------

describe("capability-map-v3 — hermes runtime", () => {
  it("user_prompt: universal=true, canBlock=true, injectionMode=constrained", () => {
    const c = getCell("hermes", "user_prompt");
    expect(c.universal).toBe(true);
    expect(c.canBlock).toBe(true);
    expect(c.injectionMode).toBe("constrained");
  });

  it("pre_tool: universal=true, canBlock=true", () => {
    const c = getCell("hermes", "pre_tool");
    expect(c.universal).toBe(true);
    expect(c.canBlock).toBe(true);
  });

  it("stop: level=degraded, enforcementStrength=deferred", () => {
    const c = getCell("hermes", "stop");
    expect(c.level).toBe("degraded");
    expect(c.enforcementStrength).toBe("deferred");
  });

  it("stop: canBlock=false on hermes (deferred, not hard-blocking)", () => {
    expect(getCell("hermes", "stop").canBlock).toBe(false);
  });

  // SOT correction C3: Hermes subagent_start EXISTS (observational only) — it is
  // NOT absent as previously documented. The pre_tool intercept of delegate_task
  // remains the actual block point (compensatingMechanism unchanged).
  it("subagent_start: level=degraded (exists, SOT C3), compensatingMechanism=intercept_delegate_task_pre_tool", () => {
    const c = getCell("hermes", "subagent_start");
    expect(c.level).toBe("degraded");
    expect(c.canBlock).toBe(false);
    expect(c.compensatingMechanism).toBe("intercept_delegate_task_pre_tool");
  });

  it("constrained gates carry maxInjectionBytes=20000 (SOT C1, not the 1800 myth)", () => {
    for (const gt of ["session_start", "user_prompt", "pre_tool", "post_tool", "stop"] as const) {
      const c = HERMES_MAP[gt];
      expect(c.injectionMode, `hermes/${gt} injectionMode`).toBe("constrained");
      expect(c.maxInjectionBytes, `hermes/${gt} maxInjectionBytes`).toBe(20000);
    }
  });

  it("all hermes gates have subagents=absent", () => {
    for (const gt of ALL_GATE_TYPES) {
      expect(HERMES_MAP[gt].subagents, `hermes/${gt}`).toBe("absent");
    }
  });

  it("pre_compact and post_compact are absent on hermes", () => {
    expect(getCell("hermes", "pre_compact").level).toBe("absent");
    expect(getCell("hermes", "post_compact").level).toBe("absent");
  });

  it("stop: compensatingMechanism=deferred_stop_verdict", () => {
    expect(getCell("hermes", "stop").compensatingMechanism).toBe("deferred_stop_verdict");
  });
});

// ---------------------------------------------------------------------------
// Schema validation — module load validates all cells (smoke test)
// ---------------------------------------------------------------------------

describe("capability-map-v3 — schema validation at load time", () => {
  it("all 27 cells pass decodeGateCapabilityCell (validated at import via cell())", () => {
    // If any cell were invalid, the module would have thrown at import time.
    // This test just confirms all maps are accessible and populated.
    let count = 0;
    for (const runtime of ALL_RUNTIMES) {
      for (const gt of ALL_GATE_TYPES) {
        const c = getCell(runtime, gt);
        expect(c).toBeDefined();
        expect(c.gateType).toBe(gt);
        count++;
      }
    }
    expect(count).toBe(27); // 3 runtimes × 9 gate types
  });
});

// ---------------------------------------------------------------------------
// Non-universal gates (should NOT be universal on any runtime)
// ---------------------------------------------------------------------------

describe("capability-map-v3 — non-universal gate types", () => {
  const NON_UNIVERSAL: Array<typeof ALL_GATE_TYPES[number]> = [
    "session_start",
    "post_tool",
    "pre_compact",
    "post_compact",
    "stop",
    "subagent_start",
    "subagent_stop",
  ];

  it("non-universal gate types are universal:false on all runtimes", () => {
    for (const runtime of ALL_RUNTIMES) {
      for (const gt of NON_UNIVERSAL) {
        expect(
          getCell(runtime, gt).universal,
          `${runtime}/${gt} should NOT be universal`,
        ).toBe(false);
      }
    }
  });
});
