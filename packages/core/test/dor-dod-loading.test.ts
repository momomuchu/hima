import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HarnessError, loadDod, loadDor, MACRO_CYCLES } from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-governance-"));
  await mkdir(path.join(root, "docs", "01-governance"), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("DoR/DoD governance loading", () => {
  it("loads locked-schema DoR and DoD files", async () => {
    await writeGovernance("dor", "01-discovery", "discovery");
    await writeGovernance("dod", "01-discovery", "discovery");

    await expect(loadDor(root, "discovery")).resolves.toMatchObject({
      kind: "dor",
      cycle: "discovery",
      criteria: [{ id: "DOR-1" }, { id: "DOR-2" }, { id: "DOR-3" }],
    });
    await expect(loadDod(root, "discovery")).resolves.toMatchObject({
      kind: "dod",
      cycle: "discovery",
      criteria: [{ id: "DOD-1" }, { id: "DOD-2" }, { id: "DOD-3" }],
    });
  });

  it("rejects governance files without three criteria or a Falsifies-If block", async () => {
    await writeFile(
      path.join(root, "docs", "01-governance", "dor-01-discovery.md"),
      `---
kind: dor
cycle: discovery
title: Bad discovery DoR
version: 1
criteria:
  - id: DOR-1
    text: One criterion is not enough.
---
# Bad
`,
      "utf8",
    );

    await expect(loadDor(root, "discovery")).rejects.toThrow(HarnessError);
  });

  it("loads every real repository DoR and DoD governance file", async () => {
    const projectRoot = findRepositoryRoot(process.cwd());

    for (const cycle of MACRO_CYCLES) {
      await expect(loadDor(projectRoot, cycle)).resolves.toMatchObject({ kind: "dor", cycle });
      await expect(loadDod(projectRoot, cycle)).resolves.toMatchObject({ kind: "dod", cycle });
    }
  });
});

function findRepositoryRoot(start: string): string {
  let current = path.resolve(start);
  while (!existsSync(path.join(current, "docs", "goals", "SHORT-TERM-GOAL.md"))) {
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not find repository root from ${start}`);
    }
    current = parent;
  }

  return current;
}

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
