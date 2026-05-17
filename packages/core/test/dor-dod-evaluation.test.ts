import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultPlanningProject, evaluateTransitionGovernance } from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-governance-eval-"));
  await mkdir(path.join(root, "docs", "01-governance"), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("DoR/DoD governance evaluation", () => {
  it("evaluates current DoD and target DoR for macro-cycle transitions", async () => {
    await writeGovernance("dod", "01-discovery", "discovery");
    await writeGovernance("dor", "02-cadrage", "cadrage");
    const project = createDefaultPlanningProject("run_test");

    const evaluation = await evaluateTransitionGovernance(root, project.state, {
      targetPhase: "cadrage",
      targetSubPhase: "Observer",
    });

    expect(evaluation.allowed).toBe(true);
    expect(evaluation.checked.map((item) => `${item.kind}:${item.cycle}`)).toEqual([
      "dod:discovery",
      "dor:cadrage",
    ]);
  });

  it("skips DoR/DoD files for subphase-only transitions", async () => {
    const project = createDefaultPlanningProject("run_test");

    const evaluation = await evaluateTransitionGovernance(root, project.state, {
      targetSubPhase: "Define",
    });

    expect(evaluation).toEqual({
      allowed: true,
      checked: [],
      blockers: [],
    });
  });

  it("blocks macro-cycle transitions when a governance file is missing", async () => {
    await writeGovernance("dod", "01-discovery", "discovery");
    const project = createDefaultPlanningProject("run_test");

    await expect(
      evaluateTransitionGovernance(root, project.state, {
        targetPhase: "cadrage",
        targetSubPhase: "Observer",
      }),
    ).rejects.toThrow("Missing DOR governance file");
  });
});

async function writeGovernance(kind: "dor" | "dod", slug: string, cycle: string): Promise<void> {
  await writeFile(
    path.join(root, "docs", "01-governance", `${kind}-${slug}.md`),
    `---
kind: ${kind}
cycle: ${cycle}
title: ${cycle} ${kind}
version: 1
criteria:
  - id: ${kind.toUpperCase()}-1
    text: First criterion.
  - id: ${kind.toUpperCase()}-2
    text: Second criterion.
  - id: ${kind.toUpperCase()}-3
    text: Third criterion.
Falsifies-If:
  kill-condition: Missing criterion invalidates the gate.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/${kind}-${slug}.md
  on-fail: Block transition until fixed.
---
# ${cycle} ${kind}
`,
    "utf8",
  );
}
