/**
 * e2e-classification.test.ts — SPAWN proof for I13 classification + cycle-depth.
 *
 * Tests the risk-classifier (R-018), floor-raise (R-019), and floor-scaled
 * skills (R-017) wired into the CLI router.
 *
 * All scenarios spawn the BUILT dist/index.js in a fresh tmp .hima root.
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this suite.
 *
 * Scenario A — no-sigil H+ prompt: advisory canary emitted, no ward created.
 *   Prompt "refais l architecture du paiement" has "architecture" (H signal).
 *   Expected: exit 0 + stdout additionalContext contains "expected entry: full".
 *
 * Scenario B — sigil with security words: floor raised to C.
 *   Prompt "add payment processing ulw" has "payment" (C signal) + "ulw" sigil (floor H).
 *   Expected: exit 0 + stdout contains "floor raised" canary + ward.floor === "C".
 *
 * Scenario C — H-floor ward at discovery: pre-tool-use Write lists > 1 forced skill.
 *   Ward at floor H discovery → R-017 floor-scaling adds corpus-specification-requirements
 *   and corpus-architecture-system-design on top of the base corpus-technical-analysis-discovery.
 *   Expected: exit 2 (block) + stdout reason mentions multiple skill ids.
 *
 * Scenario D — pure info question: silent allow, no cycle, no ward.
 *   Prompt "what is X?" → classifyRisk returns floor T → emitAllow().
 *   Expected: exit 0 + no [HIMA] canary in stdout.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createWard, resumeWard } from "@hima/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

const DISCOVERY_SKILL_ID = "corpus-technical-analysis-discovery";
const H_EXTRA_SKILL_1 = "corpus-specification-requirements";
const H_EXTRA_SKILL_2 = "corpus-architecture-system-design";

// ---------------------------------------------------------------------------
// Helper: spawn CLI synchronously with a JSON stdin payload
// ---------------------------------------------------------------------------

function spawnCli(
  args: string[],
  stdinPayload: Record<string, unknown>,
  cliRoot: string,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("node", [DIST_INDEX, ...args, "--root", cliRoot], {
    input: JSON.stringify(stdinPayload),
    encoding: "utf8",
    timeout: 15_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// ---------------------------------------------------------------------------
// Scenario A — no-sigil H+ prompt → advisory canary "expected entry: full"
// ---------------------------------------------------------------------------

describe("Scenario A — no-sigil H+ prompt emits advisory canary", () => {
  let aRoot: string;

  beforeAll(() => {
    aRoot = mkdtempSync(path.join(tmpdir(), "hima-class-e2e-a-"));
    mkdirSync(path.join(aRoot, ".hima", "state"), { recursive: true });
  });

  afterAll(() => {
    rmSync(aRoot, { recursive: true, force: true });
  });

  it("exitStatus === 0 (no sigil → no block, advisory only)", () => {
    const { status } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "refais l architecture du paiement" },
      aRoot,
    );
    expect(status).toBe(0);
  });

  it('stdout additionalContext contains "expected entry: full"', () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "refais l architecture du paiement" },
      aRoot,
    );
    // The classifier sees "architecture" (H signal) → emits advisory for H+.
    expect(stdout).toContain("expected entry: full");
  });

  it("stdout contains [HIMA] advisory canary", () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "refais l architecture du paiement" },
      aRoot,
    );
    expect(stdout).toContain("[HIMA] no sigil");
  });

  it("no ward.json created (no sigil = no ward)", async () => {
    // Scenario A does NOT create a ward — advisory only.
    const ward = await resumeWard(aRoot);
    expect(ward).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scenario B — sigil + security words → floor raised to C
// ---------------------------------------------------------------------------

describe("Scenario B — sigil with security words raises floor to C", () => {
  let bRoot: string;

  beforeAll(() => {
    bRoot = mkdtempSync(path.join(tmpdir(), "hima-class-e2e-b-"));
    mkdirSync(path.join(bRoot, ".hima", "state"), { recursive: true });
  });

  afterAll(() => {
    rmSync(bRoot, { recursive: true, force: true });
  });

  it("exitStatus === 0 (sigil detected, ward created)", () => {
    const { status } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      // "ulw" sigil default floor = H; "payment" is a C-level security signal.
      // Classifier raises floor H → C.
      { promptContent: "add payment processing ulw" },
      bRoot,
    );
    expect(status).toBe(0);
  });

  it('stdout contains "floor raised" canary (R-019)', () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "add payment processing ulw" },
      bRoot,
    );
    expect(stdout).toContain("floor raised");
  });

  it("floor raised from H to C in the canary", () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "add payment processing ulw" },
      bRoot,
    );
    // Canary format: "[HIMA] floor raised H->C by risk-classifier (...)"
    expect(stdout).toContain("H->C");
  });

  it("ward.floor === C (raised by classifier)", async () => {
    // Spawn once to ensure ward is created.
    spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "add payment processing ulw" },
      bRoot,
    );
    const ward = await resumeWard(bRoot);
    expect(ward).not.toBeNull();
    expect(ward?.floor).toBe("C");
  });
});

// ---------------------------------------------------------------------------
// Scenario C — H-floor ward at discovery: pre-tool-use Write lists > 1 forced skill
// ---------------------------------------------------------------------------

describe("Scenario C — H-floor ward at discovery lists floor-scaled skills in block", () => {
  let cRoot: string;

  beforeAll(async () => {
    cRoot = mkdtempSync(path.join(tmpdir(), "hima-class-e2e-c-"));
    // Create a ward explicitly at floor H (discovery stage, no skills loaded).
    // R-017 floor-scaling at H adds corpus-specification-requirements and
    // corpus-architecture-system-design on top of the base DEV_CYCLE skill.
    await createWard(cRoot, {
      id: "class-e2e-c",
      entryPoint: "full",
      floor: "H",
    });
  });

  afterAll(() => {
    rmSync(cRoot, { recursive: true, force: true });
  });

  it("exitStatus === 2 (block — skills not loaded)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: "src/foo.ts", content: "x" } },
      cRoot,
    );
    expect(status).toBe(2);
  });

  it('stdout contains "block" decision', () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: "src/foo.ts", content: "x" } },
      cRoot,
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  it("block reason references the base discovery skill", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: "src/foo.ts", content: "x" } },
      cRoot,
    );
    expect(stdout).toContain(DISCOVERY_SKILL_ID);
  });

  it("block reason lists H-extra skill corpus-specification-requirements (floor-scaled)", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: "src/foo.ts", content: "x" } },
      cRoot,
    );
    // R-017: at floor H, resolveStageForceSkillsForFloor adds this skill.
    expect(stdout).toContain(H_EXTRA_SKILL_1);
  });

  it("block reason lists H-extra skill corpus-architecture-system-design (floor-scaled)", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: "src/foo.ts", content: "x" } },
      cRoot,
    );
    expect(stdout).toContain(H_EXTRA_SKILL_2);
  });

  it("block reason lists MORE than 1 forced skill (floor-scaled beyond base)", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: "src/foo.ts", content: "x" } },
      cRoot,
    );
    // The reason should mention multiple skill ids separated by commas.
    // With H floor-scaling: base(1) + H-extras(2) = 3 skills listed.
    const countDiscovery = (stdout.match(/corpus-technical-analysis-discovery/g) ?? []).length;
    const countSpec = (stdout.match(/corpus-specification-requirements/g) ?? []).length;
    const countArch = (stdout.match(/corpus-architecture-system-design/g) ?? []).length;
    // All three skills appear in stdout (base + 2 H-extras).
    expect(countDiscovery + countSpec + countArch).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Scenario D — pure info question: silent allow, no cycle, no ward
// ---------------------------------------------------------------------------

describe("Scenario D — pure info question: silent allow, no cycle", () => {
  let dRoot: string;

  beforeAll(() => {
    dRoot = mkdtempSync(path.join(tmpdir(), "hima-class-e2e-d-"));
    mkdirSync(path.join(dRoot, ".hima", "state"), { recursive: true });
  });

  afterAll(() => {
    rmSync(dRoot, { recursive: true, force: true });
  });

  it("exitStatus === 0 (no sigil, floor T → silent allow)", () => {
    const { status } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "what is X?" },
      dRoot,
    );
    expect(status).toBe(0);
  });

  it('stdout does NOT contain "block"', () => {
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "what is X?" },
      dRoot,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });

  it("stdout is empty (silent allow, no advisory)", () => {
    // "what is X?" has no architectural/security signals → floor T → emitAllow() → no stdout.
    const { stdout } = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "what is X?" },
      dRoot,
    );
    expect(stdout.trim()).toBe("");
  });

  it("no ward.json created (no sigil → no cycle)", async () => {
    spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: "what is X?" },
      dRoot,
    );
    const ward = await resumeWard(dRoot);
    expect(ward).toBeNull();
  });
});
