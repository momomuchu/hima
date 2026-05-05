import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const guardPath = path.resolve("scripts/guard-runtime-artifact-vocab.mjs");
const scopedPath = path.resolve(
  `docs/propositions/pipeline-fractal-v4-final-proposal/__guard-artifact-fixture__-${process.pid}.md`,
);
const ignoredTmpDirectory = path.resolve(`.tmp-guard-artifact-vocab-${process.pid}`);
const ignoredTmpPath = path.join(ignoredTmpDirectory, "ignored-stale-artifact.md");

await writeFile(
  scopedPath,
  [
    "# Guard fixture",
    "",
    "Runtime artifact axis: skills/subagents/books.",
    "",
    "```yaml",
    'artifact_kind: "book"',
    'kind: "book"',
    "```",
    "",
  ].join("\n"),
  "utf8",
);
await mkdir(ignoredTmpDirectory, { recursive: true });
await writeFile(
  ignoredTmpPath,
  [
    "# Ignored temporary fixture",
    "",
    "Runtime artifact axis: skills/subagents/books.",
    "",
    "```yaml",
    'kind: "book"',
    "```",
    "",
  ].join("\n"),
  "utf8",
);

try {
  const result = spawnSync(process.execPath, [guardPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /stale runtime artifact axis/);
  assert.match(result.stderr, /book artifact kind/);
  assert.match(result.stderr, /book manifest kind/);
  assert.doesNotMatch(result.stderr, /\.tmp-guard-artifact-vocab/);
} finally {
  await rm(scopedPath, { force: true });
  await rm(ignoredTmpDirectory, { recursive: true, force: true });
}
