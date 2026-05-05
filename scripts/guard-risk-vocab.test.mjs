import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

const guardPath = path.resolve("scripts/guard-risk-vocab.mjs");
const scopedPath = path.resolve(
  `docs/propositions/pipeline-fractal-v4-final-proposal/__guard-risk-fixture__-${process.pid}.md`,
);

await writeFile(
  scopedPath,
  ["# Guard fixture", "", "```yaml", "accepted_gaps:", "  - risk_allowed: true", "```", ""].join(
    "\n",
  ),
);

try {
  const result = spawnSync(process.execPath, [guardPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /old boolean risk_allowed field/);
  assert.match(result.stderr, /risk_allowed: true/);
} finally {
  await rm(scopedPath, { force: true });
}
