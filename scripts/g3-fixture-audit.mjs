/**
 * g3-fixture-audit.mjs — detects forbidden-evidence collision classes in g3 fixtures.
 *
 * Class A (prose collision): a forbiddenEvidenceRequirements token appears as a
 *   substring of the scenario's own turn text. The runner echoes user turns into
 *   the transcript verbatim, so checkEvidenceBurden (conversation-compliance-scan.mjs)
 *   regex-matches the forbidden token against the user's own words → false FAIL.
 *
 * Class B (phase-marker collision): a forbidden token, matched as /token/iu,
 *   also matches one of the scenario's own requiredPhases markers
 *   [HIMA_PHASE:<phase>] → the scenario forbids evidence it is required to emit.
 *
 * Read-only. Prints a JSON report.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(repoRoot, "fixtures", "conversation-compliance", "scenarios");

function rx(token) {
  return new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu");
}

const files = (await readdir(dir))
  .filter((f) => f.startsWith("g3-") && f.endsWith(".json"))
  .sort();

const prose = [];
const phase = [];

for (const f of files) {
  const s = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  const forb = s.expected?.forbiddenEvidenceRequirements ?? [];
  const phases = s.expected?.requiredPhases ?? [];
  const turnText = (s.turns ?? []).map((t) => t.text).join("  ");
  for (const r of forb) {
    if (rx(r).test(turnText)) {
      prose.push({ file: f, token: r });
    }
    const hitPhase = phases.find((p) => rx(r).test(`[HIMA_PHASE:${p}]`));
    if (hitPhase) {
      phase.push({ file: f, token: r, collidesWithPhase: hitPhase });
    }
  }
}

console.log(
  JSON.stringify(
    { totalFixtures: files.length, proseCollisions: prose, phaseCollisions: phase },
    null,
    2,
  ),
);
