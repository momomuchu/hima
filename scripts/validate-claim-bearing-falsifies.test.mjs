import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const script = "scripts/validate-claim-bearing-falsifies.mjs";
const fixtureRoot = path.resolve(`.tmp-claim-bearing-falsifies-${process.pid}`);

const currentResult = spawnSync(process.execPath, [script, "--json"], {
  cwd: process.cwd(),
  encoding: "utf8",
});

assert.equal(currentResult.status, 0, currentResult.stderr);
const currentReport = JSON.parse(currentResult.stdout);
assert.equal(currentReport.status, "pass");
assert.equal(currentReport.claimBearingFiles, 47);
assert.equal(currentReport.issues.length, 0);

try {
  await mkdir(path.join(fixtureRoot, "docs/business-model"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "docs/decisions"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "docs/goals"), { recursive: true });

  await writeFile(
    path.join(fixtureRoot, "docs/business-model/missing.md"),
    "# Missing Falsifier\n\nThis claim-bearing business-model artifact has no falsifier.\n",
    "utf8",
  );
  await writeFile(
    path.join(fixtureRoot, "docs/decisions/ok.md"),
    [
      "# Decision",
      "",
      "Falsifies-If:",
      "  kill-condition: The decision is used after the repository state changes.",
      "  checkpoint-date: 2026-06-01",
      "  evidence-anchor: docs/decisions/ok.md",
      "  on-fail: Reopen the decision.",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(fixtureRoot, "docs/goals/bad-anchor.md"),
    [
      "---",
      "claim-bearing: true",
      "---",
      "",
      "# Bad Anchor",
      "",
      "Falsifies-If:",
      "  kill-condition: The anchor cannot be resolved.",
      "  checkpoint-date: 2026-06-01",
      "  evidence-anchor: docs/goals/missing-anchor.md:1",
      "  on-fail: Reopen the claim.",
      "",
    ].join("\n"),
    "utf8",
  );

  const fixtureResult = spawnSync(process.execPath, [script, "--root", fixtureRoot, "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(fixtureResult.status, 1);
  assert.match(fixtureResult.stderr, /missing\.md: claim-bearing markdown must include/);
  assert.match(
    fixtureResult.stderr,
    /bad-anchor\.md: Falsifies-If block evidence-anchor must resolve/,
  );

  const fixtureReport = JSON.parse(fixtureResult.stdout);
  assert.equal(fixtureReport.status, "fail");
  assert.equal(fixtureReport.claimBearingFiles, 3);
  assert.equal(fixtureReport.issues.length, 2);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
