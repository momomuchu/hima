/**
 * e2e-research-enforcement.test.ts — SPAWN proof for R-041 (forced research
 * sub-pass at floor H+).
 *
 * Before this wiring, runResearchSubpassContext()'s "forced at H+" was textual
 * only: research-subpass.test.ts itself asserted the SAME advisory string was
 * returned at every floor T..C, and no code path added
 * corpus-technical-analysis-discovery to a skill-force/register requirement.
 *
 * This suite proves that at floor H+ on a "run" entry-point ward, a pre_tool
 * write IS blocked specifically on the missing research skill — even when
 * every other stage-required skill has already been loaded — and becomes
 * allowed only once that skill is also loaded.
 *
 * Prompt "refactor the security architecture run" is engineered to:
 *   - end with the terminal sigil "run" → entryPoint="run" (sigil default floor M)
 *   - trip the risk-classifier's C-floor security signal ("security") AND
 *     H-floor architectural-verb signal ("refactor", "architecture")
 *   - R-019: final floor = max(sigil floor, classifier floor) = "C" (H+)
 *
 * Pre-condition: `pnpm --filter @norm/cli build` must have run before this suite.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { markLoaded, resumeWard } from "@norm/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

const RESEARCH_SKILL_ID = "corpus-technical-analysis-discovery";
const RUN_PROMPT = "refactor the security architecture run";

// ---------------------------------------------------------------------------
// Spawn helper
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
// Shared tmp root
// ---------------------------------------------------------------------------

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-e2e-research-enforcement-"));
  mkdirSync(path.join(root, ".hima", "state"), { recursive: true });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// (a) user-prompt-submit bootstraps a "run" ward raised to floor C (H+)
// ---------------------------------------------------------------------------

describe("(a) user-prompt-submit — run-entry ward raised to floor C", () => {
  // The research sub-pass canary + spawn-manifest advisory are only emitted on
  // the CREATE path (existing ward === null) — a second spawn against the same
  // root would resume the already-created ward and take the "resuming" canary
  // branch instead. Spawn exactly once here and assert on that single result.
  let created: { status: number | null; stdout: string; stderr: string };

  beforeAll(() => {
    created = spawnCli(
      ["hook", "user-prompt-submit", "--format", "claude"],
      { promptContent: RUN_PROMPT },
      root,
    );
  });

  it("exit 0", () => {
    expect(created.status).toBe(0);
  });

  it('additionalContext mentions the research sub-pass ("forced at H+")', () => {
    expect(created.stdout).toContain("research sub-pass");
  });

  it("ward is entryPoint=run at floor C, openStage=spec", async () => {
    const ward = await resumeWard(root);
    expect(ward).not.toBeNull();
    expect(ward?.entryPoint).toBe("run");
    expect(ward?.floor).toBe("C");
    expect(ward?.openStage).toBe("spec");
  });

  it("R-041: the ward's skillRegister now carries the forced research skill", async () => {
    const ward = await resumeWard(root);
    expect(ward?.skillRegister).toContainEqual({
      source: "corpus",
      id: RESEARCH_SKILL_ID,
    });
  });
});

// ---------------------------------------------------------------------------
// (b) all OTHER required skills loaded, research skill still missing → BLOCK
// ---------------------------------------------------------------------------

describe("(b) pre-tool-use Write — blocked while only the research skill is missing", () => {
  beforeAll(async () => {
    // Load every skill the "spec" stage requires at floor C EXCEPT the
    // R-041-forced research skill, isolating that skill as the sole blocker.
    const otherRequired = [
      "corpus-spec-driven-development",
      "corpus-schema-driven-development",
      "corpus-domain-modeling-ddd",
      "corpus-architecture-system-design",
      "corpus-security-privacy-compliance",
    ];
    for (const id of otherRequired) {
      await markLoaded(root, { source: "corpus", id });
    }
  });

  it("exit 2 (block)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: "docs/specs/x.spec.md" } },
      root,
    );
    expect(status).toBe(2);
  });

  it("block reason references the research skill id", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: "docs/specs/x.spec.md" } },
      root,
    );
    expect(stdout).toContain(RESEARCH_SKILL_ID);
  });
});

// ---------------------------------------------------------------------------
// (c) research skill loaded → previously-blocked write is now ALLOWED
// ---------------------------------------------------------------------------

describe("(c) pre-tool-use Write — allowed once the research skill is also loaded", () => {
  beforeAll(async () => {
    await markLoaded(root, { source: "corpus", id: RESEARCH_SKILL_ID });
  });

  it("exit 0 (allow)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: "docs/specs/x.spec.md" } },
      root,
    );
    expect(status).toBe(0);
  });

  it('stdout does NOT contain "block" decision', () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use", "--format", "claude"],
      { toolName: "Write", toolInput: { file_path: "docs/specs/x.spec.md" } },
      root,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});
