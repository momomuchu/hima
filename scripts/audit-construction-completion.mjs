import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const root = path.resolve(readArg("--root") ?? defaultRoot);
const json = args.includes("--json");
const requireComplete = args.includes("--require-complete");
const issues = [];

const completePath = "docs/goals/COMPLETE-CONSTRUCTION-GOAL.md";
const shortTermPath = "docs/goals/SHORT-TERM-GOAL.md";
const coverageAuditPath = "docs/goals/external-authorization-packet-coverage-audit.md";
const archivePath = "docs/goals/archive/cycle-96-BLOCKED-2026-05-15.md";
const rescopePacketPath = "docs/goals/master-goal-rescope-decision-packet.md";
const packageJsonPath = "package.json";
const runTestsPath = "scripts/run-tests.mjs";
const blockedStateGuardPath = "scripts/guard-construction-blocked-state.mjs";
const gateEvaluatorPath = "packages/core/src/gates/evaluate-gate.ts";
const gateEvaluatorTestPath = "packages/core/test/gates.test.ts";
const handleHookTestPath = "packages/core/test/handle-hook.test.ts";
const guardedAuthorizationSurfacePaths = [
  "docs/goals/h3-macos-authorization-packet.md",
  "docs/goals/beta-release-authorization-packet.md",
  "docs/goals/stress-siem-authorization-packet.md",
  "docs/goals/runtime-evidence-authorization-prep.md",
  "docs/goals/adapter-e2e-authorization-blocker-review.md",
  "docs/goals/real-user-home-install-authorization-prep.md",
  rescopePacketPath,
];
const falsifiesFieldSurfacePaths = [
  completePath,
  shortTermPath,
  coverageAuditPath,
  archivePath,
  ...guardedAuthorizationSurfacePaths,
];

const complete = await readRequiredText(completePath);
const shortTerm = await readRequiredText(shortTermPath);
const coverageAudit = await readRequiredText(coverageAuditPath);
const archive = await readRequiredText(archivePath);
const packageJson = parsePackageJson(await readRequiredText(packageJsonPath), packageJsonPath);
const runTests = await readRequiredText(runTestsPath);
const blockedStateGuard = await readRequiredText(blockedStateGuardPath);
const gateEvaluator = await readRequiredText(gateEvaluatorPath);
const gateEvaluatorTest = await readRequiredText(gateEvaluatorTestPath);
const handleHookTest = await readRequiredText(handleHookTestPath);

const ledger = parseLedger(coverageAudit);
const openRows = Array.from(complete.matchAll(/^- \[ \] (?<row>.+)$/gmu));
const openRowTexts = openRows.map((match) => match.groups?.row ?? "");
const coverageMap = extractCoverageMap(coverageAudit);
const coverageRowSum = Array.from(coverageMap.values()).reduce((sum, entry) => sum + entry.rows, 0);

const expectedOpenRows = [
  "`packages/adapter-claude/test/e2e.test.ts` end-to-end against Claude Code real session",
  "`packages/adapter-codex/test/e2e.test.ts`",
  "`packages/adapter-hermes/test/e2e.test.ts`",
  "`packages/cli/src/commands/self-test.ts` invokes the 5-scenario suite per runtime (F1)",
  "SWE-bench Verified subset wired as a benchmark target (F2)",
  "Cross-runtime parity test harness (F3)",
  "Stress test: 100 concurrent transitions test (F4)",
  "Compliance pack generation + SIEM ingest test (F5)",
  "Saturation critic over the test results (F6)",
  "`00-idea-pmf` skills installed under `~/.hima/skills/00-idea-pmf/`",
  "`01-strategy-positioning` skills installed",
  "`02-analysis-discovery` skills installed",
  "`03-specification` skills installed",
  "`04-design-ux-ui` skills installed (lower priority for harness use case)",
  "`05-architecture` skills installed",
  "`07-build` skills installed",
  "`09-quality-release-run` skills installed",
  "HARV-01 ai-slop-cleaner (OMC)",
  "HARV-02 agnix-style linting",
  "HARV-04 OMX mode state-machine",
  "HARV-07 auto-harness 3-step evidence gate",
  "HARV-08 typed human-handoff",
  "HARV-09 prompt-injection scanner",
  "HARV-11 opencode default-deny subagent tools",
  "HARV-13 PreCompact/PostCompact hooks",
  "HARV-17 claw-code prompt-cache boundary",
  "HARV-18 opencode anti-bypass clause",
  "HARV-16 nexus-agents PreferenceRouter (evaluate-then-decide)",
  "H3 install tested on Linux + macOS + Windows",
  "H8 closed beta with 10 users + saturation survey",
  "I1 GitHub repo visibility public",
  "I2 v1.0.0 tag + release notes",
  "I3 `@hima/cli` published to npm",
  "I4 founding-cohort sale page live",
  "I5 Show HN + dev.to + r/devops + Claude Code Discord posts",
  "I6 `docs/goals/archive/v1.0-LAUNCH-2026-08-01.md` opening snapshot",
];

const expectedOpenRowSet = new Set(expectedOpenRows);
const actualOpenRowSet = new Set(openRowTexts);
const missingExpectedOpenRows = expectedOpenRows.filter((row) => !actualOpenRowSet.has(row));
const unexpectedOpenRows = openRowTexts.filter((row) => !expectedOpenRowSet.has(row));
const openRowChecklist = openRowTexts.map((row) => {
  const coverageFamily = classifyOpenRowFamily(row);
  const externalBlocker = classifyOpenRowExternalBlocker(coverageFamily);
  const coverage = coverageMap.get(coverageFamily);

  return {
    requirement: row,
    coverageFamily,
    externalBlocker,
    evidence: coverage?.surfaceCell ?? "missing coverage family",
    result: coverageFamily === "Unmapped" || !coverage ? "fail" : "blocked",
  };
});
const coverageFamilyCounts = buildCoverageFamilyCounts(openRowChecklist, coverageMap);
const coverageAuditSurfaceChecks = buildCoverageAuditSurfaceChecks();
const coverageVerdictBoundaryChecks = buildCoverageVerdictBoundaryChecks(coverageMap);
const nonRowExternalMentionChecks = await buildNonRowExternalMentionChecks();
const gateWiringChecks = buildGateWiringChecks(packageJson, runTests);
const blockedStateGuardChecks = buildBlockedStateGuardChecks(blockedStateGuard);
const artifactSurfaceChecks = await buildArtifactSurfaceChecks();
const coverageSurfacePathChecks = await buildCoverageSurfacePathChecks(coverageMap);
const artifactTermChecks = await buildArtifactTermChecks();
const partialH3EvidenceChecks = await buildPartialH3EvidenceChecks();
const staleClaimChecks = buildStaleClaimChecks();
const nextAllowedBranchChecks = buildNextAllowedBranchChecks();
const archiveDeliveredArtifactChecks = buildArchiveDeliveredArtifactChecks();
const archiveNonGoalChecks = buildArchiveNonGoalChecks();
const archiveBlockerChecks = buildArchiveBlockerChecks();
const archiveVerificationEvidenceChecks = buildArchiveVerificationEvidenceChecks();
const shortTermDoneCriteriaChecks = buildShortTermDoneCriteriaChecks();
const shortTermBlockerSummaryChecks = buildShortTermBlockerSummaryChecks();
const falsifiesFieldChecks = await buildFalsifiesFieldChecks();
const runtimeFalsifiesGateChecks = buildRuntimeFalsifiesGateChecks();

const missingEvidencePaths = [
  "docs/goals/evidence/h3-install-macos.md",
  "docs/goals/archive/v1.0-LAUNCH-2026-08-01.md",
  "packages/adapter-claude/test/e2e.test.ts",
  "packages/adapter-codex/test/e2e.test.ts",
  "packages/adapter-hermes/test/e2e.test.ts",
];

const blockedForbiddenEvidencePaths = [
  "docs/goals/evidence/h3-install-macos.md",
  "docs/goals/archive/v1.0-LAUNCH-2026-08-01.md",
  "packages/adapter-claude/test/e2e.test.ts",
  "packages/adapter-codex/test/e2e.test.ts",
  "packages/adapter-hermes/test/e2e.test.ts",
];

const pathStatus = [];
for (const missingPath of missingEvidencePaths) {
  pathStatus.push({ path: missingPath, exists: await exists(missingPath) });
}

const externalBlockers = [
  "real macOS or authorized CI H3 transcript",
  "real Claude/Codex/Hermes runtime-model sessions",
  "real user-home ~/.hima install and restore evidence",
  "benchmark, stress, and external SIEM execution evidence",
  "closed-beta user evidence and saturation survey",
  "public GitHub/npm/release/payment/launch artifacts",
];
const externalBlockerListChecks = buildExternalBlockerListChecks();
const openRowExternalBlockerChecks = buildOpenRowExternalBlockerChecks(openRowChecklist);

const cycle96Blocked =
  /^cycle-id:\s*cycle-96-external-authorization-required\s*$/m.test(shortTerm) &&
  /^status:\s*BLOCKED\s*$/m.test(shortTerm);
const completionArtifactAbsenceChecks = buildCompletionArtifactAbsenceChecks(pathStatus);

if (ledger.total !== 155) {
  issues.push(`${coverageAuditPath}: expected ledger total 155, found ${ledger.total}`);
}

if (ledger.done !== 119) {
  issues.push(`${coverageAuditPath}: expected ledger done 119, found ${ledger.done}`);
}

if (openRows.length !== 36) {
  issues.push(`${completePath}: expected 36 unchecked rows, found ${openRows.length}`);
}

for (const row of missingExpectedOpenRows) {
  issues.push(`${completePath}: expected unchecked row is missing: ${row}`);
}

for (const row of unexpectedOpenRows) {
  issues.push(`${completePath}: unexpected unchecked row: ${row}`);
}

if (coverageRowSum !== openRows.length) {
  issues.push(
    `${coverageAuditPath}: coverage map rows (${coverageRowSum}) do not match open rows (${openRows.length})`,
  );
}

for (const entry of openRowChecklist) {
  if (entry.result === "fail") {
    issues.push(`${completePath}: open row has no packet/prep coverage: ${entry.requirement}`);
  }
}

for (const entry of coverageFamilyCounts) {
  if (entry.result === "fail") {
    issues.push(
      `${coverageAuditPath}: coverage family ${entry.family} declares ${entry.declaredRows} rows but actual open rows classify as ${entry.actualRows}`,
    );
  }
}

for (const entry of coverageAuditSurfaceChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of coverageVerdictBoundaryChecks) {
  if (entry.result === "fail") {
    issues.push(`${coverageAuditPath}: ${entry.requirement}: ${entry.family}`);
  }
}

for (const entry of nonRowExternalMentionChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of gateWiringChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of blockedStateGuardChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of artifactSurfaceChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of coverageSurfacePathChecks) {
  if (entry.result === "fail") {
    issues.push(`${coverageAuditPath}: ${entry.requirement}: ${entry.path}`);
  }
}

for (const entry of artifactTermChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of partialH3EvidenceChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of staleClaimChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of nextAllowedBranchChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of archiveDeliveredArtifactChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of archiveNonGoalChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of archiveBlockerChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of archiveVerificationEvidenceChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of shortTermDoneCriteriaChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of shortTermBlockerSummaryChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of falsifiesFieldChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of runtimeFalsifiesGateChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of externalBlockerListChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

for (const entry of openRowExternalBlockerChecks) {
  if (entry.result === "fail") {
    issues.push(`${completePath}: ${entry.requirement}: ${entry.row}`);
  }
}

for (const entry of completionArtifactAbsenceChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

if (!cycle96Blocked) {
  issues.push(`${shortTermPath}: expected active Cycle 96 BLOCKED state`);
}

if (cycle96Blocked) {
  for (const entry of pathStatus) {
    if (blockedForbiddenEvidencePaths.includes(entry.path) && entry.exists) {
      issues.push(`${entry.path}: must be absent while Cycle 96 is BLOCKED`);
    }
  }
}

if (!/^ledger:\s*119\/155\s*$/m.test(coverageAudit)) {
  issues.push(`${coverageAuditPath}: expected ledger: 119/155`);
}

const completionEvidencePresent =
  openRows.length === 0 &&
  pathStatus.every((entry) => entry.exists) &&
  /^status:\s*DONE\s*$/m.test(shortTerm);
const baseIssueCount = issues.length;
const statusBlockerChecks = buildStatusBlockerChecks(completionEvidencePresent, baseIssueCount);

for (const entry of statusBlockerChecks) {
  if (entry.result === "fail") {
    issues.push(`${entry.path}: ${entry.requirement}`);
  }
}

const completionAuditPassed = completionEvidencePresent && issues.length === 0;

const audit = {
  objective: "follow docs/goals/COMPLETE-CONSTRUCTION-GOAL.md",
  status: completionAuditPassed ? "complete" : "not_complete",
  ledger: {
    done: ledger.done,
    total: ledger.total,
    open: openRows.length,
    percent: ledger.total === 0 ? 0 : Number(((ledger.done / ledger.total) * 100).toFixed(1)),
  },
  cycle: {
    id: extractFrontmatterValue(shortTerm, "cycle-id"),
    status: extractFrontmatterValue(shortTerm, "status"),
    cycle96Blocked,
  },
  promptToArtifactChecklist: [
    {
      requirement: "Master checklist rows in COMPLETE-CONSTRUCTION-GOAL.md",
      evidence: `${ledger.done}/${ledger.total} ledger; ${openRows.length} unchecked`,
      result: openRows.length === 0 ? "pass" : "blocked",
    },
    {
      requirement: "Exact remaining open-row identity",
      evidence: `${missingExpectedOpenRows.length} missing expected rows; ${unexpectedOpenRows.length} unexpected rows`,
      result:
        missingExpectedOpenRows.length === 0 && unexpectedOpenRows.length === 0 ? "pass" : "fail",
    },
    {
      requirement: "Coverage audit maps open rows to packet/prep surfaces",
      evidence: `${coverageRowSum} rows mapped in ${coverageAuditPath}`,
      result: coverageRowSum === openRows.length ? "pass" : "fail",
    },
    {
      requirement: "Per-row blocker checklist",
      evidence: `${openRowChecklist.filter((entry) => entry.result !== "fail").length}/${openRows.length} open rows have packet/prep coverage`,
      result: openRowChecklist.every((entry) => entry.result !== "fail") ? "pass" : "fail",
    },
    {
      requirement: "Coverage family row counts match actual open rows",
      evidence: `${coverageFamilyCounts.filter((entry) => entry.result === "pass").length}/${coverageFamilyCounts.length} families match`,
      result: coverageFamilyCounts.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Coverage audit claim boundary",
      evidence: `${coverageAuditSurfaceChecks.filter((entry) => entry.result === "pass").length}/${coverageAuditSurfaceChecks.length} coverage-audit checks pass`,
      result: coverageAuditSurfaceChecks.every((entry) => entry.result === "pass")
        ? "pass"
        : "fail",
    },
    {
      requirement: "Coverage audit verdicts preserve non-execution boundaries",
      evidence: `${coverageVerdictBoundaryChecks.filter((entry) => entry.result === "pass").length}/${coverageVerdictBoundaryChecks.length} verdict-boundary checks pass`,
      result: coverageVerdictBoundaryChecks.every((entry) => entry.result === "pass")
        ? "pass"
        : "fail",
    },
    {
      requirement: "Non-row legal/market/compliance mentions stay outside completion evidence",
      evidence: `${nonRowExternalMentionChecks.filter((entry) => entry.result === "pass").length}/${nonRowExternalMentionChecks.length} non-row checks pass`,
      result: nonRowExternalMentionChecks.every((entry) => entry.result === "pass")
        ? "pass"
        : "fail",
    },
    {
      requirement: "Executable audit/guard gate wiring",
      evidence: `${gateWiringChecks.filter((entry) => entry.result === "pass").length}/${gateWiringChecks.length} wiring checks pass`,
      result: gateWiringChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Blocked-state guard protects rescope packet and archive audit terms",
      evidence: `${blockedStateGuardChecks.filter((entry) => entry.result === "pass").length}/${blockedStateGuardChecks.length} blocked-state guard checks pass`,
      result: blockedStateGuardChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Authorization packet/prep/rescope surface integrity",
      evidence: `${artifactSurfaceChecks.filter((entry) => entry.result === "pass").length}/${artifactSurfaceChecks.length} surface checks pass`,
      result: artifactSurfaceChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Coverage audit references existing guarded packet/prep surfaces",
      evidence: `${coverageSurfacePathChecks.filter((entry) => entry.result === "pass").length}/${coverageSurfacePathChecks.length} referenced surfaces pass`,
      result: coverageSurfacePathChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Authorization packet/prep/rescope required terms",
      evidence: `${artifactTermChecks.filter((entry) => entry.result === "pass").length}/${artifactTermChecks.length} required-term checks pass`,
      result: artifactTermChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Partial H3 Linux/Windows evidence boundaries",
      evidence: `${partialH3EvidenceChecks.filter((entry) => entry.result === "pass").length}/${partialH3EvidenceChecks.length} transcript checks pass`,
      result: partialH3EvidenceChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement:
        "No stale completion, ledger-advance, progress-percentage, open-row-count, open-row-closure, completion-artifact, macOS-install-completion, adapter-e2e-completion, adapter-production-readiness, adapter-hook/behavior-proof, unsupported/degraded-hook-upgrade, five-client-compatibility, manual-ci-h3-workflow-success, partial-h3-promotion, release-tag-notes, global-install-success, registry-lookup/test-transaction, visibility-flip/launch-snapshot-capture, beta-participation/survey-result, founding-cohort-sales, launch-post-link, book-skill-real-install, harvested-skill-real-install/invocation, runtime-suite/parity/critic, runtime-preflight-allowed, self-test-external-runtime-launch, benchmark-dry-run-unblocked, siem-external-transmission, user-home-dry-run-write, user-home-backup-restore-complete, release/payment/beta, runtime/user-home/benchmark/SIEM, fresh-machine-init, legal/market/revenue, authorization-granted, authorization-packet-execution-ready, blocker-resolved, cycle-unblocked, external-evidence-present, closure-ready, require-complete-success, goal-achieved, test-green-proxy-completion, audit-issues-empty-proxy-completion, row-mapping-proxy-completion, coverage-completeness-proxy-completion, blocker-list-proxy-completion, falsifies-if-proxy-completion, artifact-absence-proxy-completion, status-blocker-proxy-completion, done-criteria-proxy-completion, proxy-evidence, rescope-status, or audit-count claims",
      evidence: `${staleClaimChecks.filter((entry) => entry.result === "pass").length}/${staleClaimChecks.length} stale-claim checks pass`,
      result: staleClaimChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Next allowed authorization branches remain explicit",
      evidence: `${nextAllowedBranchChecks.filter((entry) => entry.result === "pass").length}/${nextAllowedBranchChecks.length} branch checks pass`,
      result: nextAllowedBranchChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Archived delivered-artifact table preserves current guard surfaces",
      evidence: `${archiveDeliveredArtifactChecks.filter((entry) => entry.result === "pass").length}/${archiveDeliveredArtifactChecks.length} delivered-artifact checks pass`,
      result: archiveDeliveredArtifactChecks.every((entry) => entry.result === "pass")
        ? "pass"
        : "fail",
    },
    {
      requirement: "Archived non-goals preserve no-external-execution boundary",
      evidence: `${archiveNonGoalChecks.filter((entry) => entry.result === "pass").length}/${archiveNonGoalChecks.length} non-goal checks pass`,
      result: archiveNonGoalChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Archived blocker table preserves external blocker reasons",
      evidence: `${archiveBlockerChecks.filter((entry) => entry.result === "pass").length}/${archiveBlockerChecks.length} blocker checks pass`,
      result: archiveBlockerChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Archived verification evidence preserves current proof commands",
      evidence: `${archiveVerificationEvidenceChecks.filter((entry) => entry.result === "pass").length}/${archiveVerificationEvidenceChecks.length} verification-evidence checks pass`,
      result: archiveVerificationEvidenceChecks.every((entry) => entry.result === "pass")
        ? "pass"
        : "fail",
    },
    {
      requirement: "Active DONE criteria require real evidence or claim-bearing rescope",
      evidence: `${shortTermDoneCriteriaChecks.filter((entry) => entry.result === "pass").length}/${shortTermDoneCriteriaChecks.length} DONE-criteria checks pass`,
      result: shortTermDoneCriteriaChecks.every((entry) => entry.result === "pass")
        ? "pass"
        : "fail",
    },
    {
      requirement: "Active blocked rationale preserves external evidence classes",
      evidence: `${shortTermBlockerSummaryChecks.filter((entry) => entry.result === "pass").length}/${shortTermBlockerSummaryChecks.length} blocked-rationale checks pass`,
      result: shortTermBlockerSummaryChecks.every((entry) => entry.result === "pass")
        ? "pass"
        : "fail",
    },
    {
      requirement: "Claim-bearing Cycle 96 surfaces preserve complete Falsifies-If fields",
      evidence: `${falsifiesFieldChecks.filter((entry) => entry.result === "pass").length}/${falsifiesFieldChecks.length} falsifies-field checks pass`,
      result: falsifiesFieldChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Runtime post_tool Falsifies-If gate matches repo claim validator",
      evidence: `${runtimeFalsifiesGateChecks.filter((entry) => entry.result === "pass").length}/${runtimeFalsifiesGateChecks.length} runtime gate checks pass`,
      result: runtimeFalsifiesGateChecks.every((entry) => entry.result === "pass")
        ? "pass"
        : "fail",
    },
    {
      requirement: "Machine-readable external blocker list remains exact",
      evidence: `${externalBlockerListChecks.filter((entry) => entry.result === "pass").length}/${externalBlockerListChecks.length} external-blocker checks pass`,
      result: externalBlockerListChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Open rows map to machine-readable external blocker classes",
      evidence: `${openRowExternalBlockerChecks.filter((entry) => entry.result === "pass").length}/${openRowExternalBlockerChecks.length} open rows have external blocker classes`,
      result: openRowExternalBlockerChecks.every((entry) => entry.result === "pass")
        ? "pass"
        : "fail",
    },
    {
      requirement: "Required completion artifacts remain absent while externally blocked",
      evidence: `${completionArtifactAbsenceChecks.filter((entry) => entry.result === "pass").length}/${completionArtifactAbsenceChecks.length} absence checks pass`,
      result: completionArtifactAbsenceChecks.every((entry) => entry.result === "pass")
        ? "pass"
        : "fail",
    },
    {
      requirement: "Completion status remains blocked until all completion predicates are true",
      evidence: `${statusBlockerChecks.filter((entry) => entry.result === "pass").length}/${statusBlockerChecks.length} status-blocker checks pass`,
      result: statusBlockerChecks.every((entry) => entry.result === "pass") ? "pass" : "fail",
    },
    {
      requirement: "Aggregate audit issue list remains empty",
      evidence: `${issues.length} audit issues`,
      result: issues.length === 0 ? "pass" : "fail",
    },
    {
      requirement: "Current cycle cannot close from proxy local artifacts",
      evidence: `${shortTermPath} ${cycle96Blocked ? "is Cycle 96 BLOCKED" : "is not Cycle 96 BLOCKED"}`,
      result: cycle96Blocked ? "blocked" : "fail",
    },
    ...pathStatus.map((entry) => ({
      requirement: `Required completion artifact: ${entry.path}`,
      evidence: entry.exists ? "present" : "absent",
      result: entry.exists ? "present" : "missing",
    })),
  ],
  openRows: openRowTexts,
  openRowChecklist,
  coverageFamilyCounts,
  coverageAuditSurfaceChecks,
  coverageVerdictBoundaryChecks,
  nonRowExternalMentionChecks,
  gateWiringChecks,
  blockedStateGuardChecks,
  artifactSurfaceChecks,
  coverageSurfacePathChecks,
  artifactTermChecks,
  partialH3EvidenceChecks,
  staleClaimChecks,
  nextAllowedBranchChecks,
  archiveDeliveredArtifactChecks,
  archiveNonGoalChecks,
  archiveBlockerChecks,
  archiveVerificationEvidenceChecks,
  shortTermDoneCriteriaChecks,
  shortTermBlockerSummaryChecks,
  falsifiesFieldChecks,
  runtimeFalsifiesGateChecks,
  externalBlockerListChecks,
  openRowExternalBlockerChecks,
  completionArtifactAbsenceChecks,
  statusBlockerChecks,
  openRowIdentity: {
    expected: expectedOpenRows.length,
    actual: openRowTexts.length,
    missingExpected: missingExpectedOpenRows,
    unexpected: unexpectedOpenRows,
  },
  externalBlockers,
  issues,
};

if (json) {
  console.log(JSON.stringify(audit, null, 2));
} else {
  console.log(`Construction completion audit: ${audit.status}`);
  console.log(
    `Ledger: ${audit.ledger.done}/${audit.ledger.total} (${audit.ledger.percent}%), open ${audit.ledger.open}`,
  );
  console.log(`Cycle: ${audit.cycle.id} / ${audit.cycle.status}`);
  console.log(`Coverage map rows: ${coverageRowSum}`);
  if (externalBlockers.length > 0) {
    console.log("Blockers:");
    for (const blocker of externalBlockers) {
      console.log(`- ${blocker}`);
    }
  }
}

if (issues.length > 0) {
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else if (requireComplete && audit.status !== "complete") {
  console.error("Construction goal is not complete; external evidence blockers remain.");
  process.exitCode = 1;
}

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

async function readRequiredText(relativePath) {
  try {
    return await readFile(path.join(root, relativePath), "utf8");
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      issues.push(`${relativePath}: required file is missing`);
      return "";
    }

    throw error;
  }
}

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function extractFrontmatterValue(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*(?<value>.+?)\\s*$`, "mu"));
  return match?.groups?.value ?? "";
}

function parseLedger(content) {
  const match = content.match(/^ledger:\s*(?<done>\d+)\/(?<total>\d+)\s*$/mu);
  if (!match?.groups) {
    issues.push(`${coverageAuditPath}: missing ledger frontmatter`);
    return { done: 0, total: 0 };
  }

  return {
    done: Number.parseInt(match.groups.done, 10),
    total: Number.parseInt(match.groups.total, 10),
  };
}

function extractCoverageMap(content) {
  const map = new Map();
  const section = content.match(
    /## Open-Row Packet Map\s+(?<table>[\s\S]*?)\n## Non-Row External Mentions/u,
  );

  if (!section?.groups?.table) {
    issues.push(`${coverageAuditPath}: missing Open-Row Packet Map section`);
    return map;
  }

  for (const line of section.groups.table.split(/\r?\n/u)) {
    const cells = line
      .trim()
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length !== 4 || cells[0] === "Open row family" || cells[0].startsWith("---")) {
      continue;
    }

    map.set(cells[0], {
      rows: Number.parseInt(cells[1], 10),
      surfaceCell: cells[2],
      verdictCell: cells[3],
    });
  }

  return map;
}

function classifyOpenRowFamily(row) {
  if (row.includes("packages/adapter-")) {
    return "Adapter real E2E";
  }

  if (row.includes("5-scenario suite") || row.includes("Cross-runtime parity")) {
    return "Runtime suite and parity";
  }

  if (row.includes("SWE-bench")) {
    return "SWE-bench benchmark";
  }

  if (row.includes("Stress test: 100 concurrent transitions")) {
    return "Stress/concurrency";
  }

  if (row.includes("Compliance pack generation + SIEM ingest test")) {
    return "Compliance/SIEM";
  }

  if (row.includes("Saturation critic over the test results")) {
    return "Final Stream F critic";
  }

  if (/^`0[0-9]-/u.test(row)) {
    return "Book-skill real installs";
  }

  if (row.startsWith("HARV-")) {
    return "Harvested-skill original rows";
  }

  if (row.includes("H3 install tested")) {
    return "H3 OS install matrix";
  }

  if (row.includes("H8 closed beta")) {
    return "Closed beta";
  }

  if (row.startsWith("I1 ") || row.startsWith("I2 ") || row.startsWith("I3 ")) {
    return "Public release";
  }

  if (row.startsWith("I4 ") || row.startsWith("I5 ")) {
    return "Sale page, payment, launch posts";
  }

  if (row.startsWith("I6 ")) {
    return "Launch snapshot";
  }

  return "Unmapped";
}

function classifyOpenRowExternalBlocker(coverageFamily) {
  switch (coverageFamily) {
    case "Adapter real E2E":
    case "Runtime suite and parity":
      return "real Claude/Codex/Hermes runtime-model sessions";
    case "SWE-bench benchmark":
    case "Stress/concurrency":
    case "Compliance/SIEM":
    case "Final Stream F critic":
      return "benchmark, stress, and external SIEM execution evidence";
    case "Book-skill real installs":
    case "Harvested-skill original rows":
      return "real user-home ~/.hima install and restore evidence";
    case "H3 OS install matrix":
      return "real macOS or authorized CI H3 transcript";
    case "Closed beta":
      return "closed-beta user evidence and saturation survey";
    case "Public release":
    case "Sale page, payment, launch posts":
    case "Launch snapshot":
      return "public GitHub/npm/release/payment/launch artifacts";
    default:
      return "unmapped external blocker";
  }
}

function buildCoverageFamilyCounts(checklist, map) {
  const actualCounts = new Map();
  for (const entry of checklist) {
    actualCounts.set(entry.coverageFamily, (actualCounts.get(entry.coverageFamily) ?? 0) + 1);
  }

  const families = new Set([...map.keys(), ...actualCounts.keys()]);

  return [...families].sort().map((family) => {
    const declaredRows = map.get(family)?.rows ?? 0;
    const actualRows = actualCounts.get(family) ?? 0;

    return {
      family,
      declaredRows,
      actualRows,
      result: declaredRows === actualRows ? "pass" : "fail",
    };
  });
}

function buildOpenRowExternalBlockerChecks(checklist) {
  return checklist.map((entry) => ({
    row: entry.requirement,
    coverageFamily: entry.coverageFamily,
    externalBlocker: entry.externalBlocker,
    requirement: "open row must map to a known external blocker class",
    evidence: entry.externalBlocker,
    result: externalBlockers.includes(entry.externalBlocker) ? "pass" : "fail",
  }));
}

function buildCoverageAuditSurfaceChecks() {
  const checks = [
    {
      requirement: "status must be COMPLETE",
      pass: /^status:\s*COMPLETE\s*$/mu.test(coverageAudit),
    },
    {
      requirement: "must assert 36 unchecked rows",
      pass: /\b36 unchecked rows\b/u.test(coverageAudit),
    },
    {
      requirement: "must include Falsifies-If block",
      pass: /\bFalsifies-If:\s*\n/u.test(coverageAudit),
    },
    {
      requirement: "must preserve non-authorization boundary",
      pass: /does not authorize execution/iu.test(coverageAudit),
    },
    {
      requirement: "must preserve non-evidence/non-row-closure boundary",
      pass: /does not create external evidence[\s\S]*does not close any row/iu.test(coverageAudit),
    },
  ];

  return checks.map((check) => ({
    path: coverageAuditPath,
    requirement: check.requirement,
    result: check.pass ? "pass" : "fail",
  }));
}

function buildCoverageVerdictBoundaryChecks(map) {
  const specs = [
    ["Adapter real E2E", /not executed/iu],
    ["Runtime suite and parity", /not executed/iu],
    ["SWE-bench benchmark", /not executed/iu],
    ["Stress/concurrency", /not executed/iu],
    ["Compliance/SIEM", /not transmitted/iu],
    ["Final Stream F critic", /not run/iu],
    ["Book-skill real installs", /not installed/iu],
    ["Harvested-skill original rows", /partial proof only/iu],
    ["H3 OS install matrix", /macOS transcript missing/iu],
    ["Closed beta", /no users contacted/iu],
    ["Public release", /not published/iu],
    ["Sale page, payment, launch posts", /not posted or transacted/iu],
    ["Launch snapshot", /snapshot file missing by design/iu],
  ];

  return specs.map(([family, boundaryPattern]) => {
    const verdict = map.get(family)?.verdictCell ?? "";

    return {
      family,
      requirement: "coverage verdict must preserve non-execution/non-evidence boundary",
      evidence: verdict,
      result: boundaryPattern.test(verdict) ? "pass" : "fail",
    };
  });
}

async function buildNonRowExternalMentionChecks() {
  const section = coverageAudit.match(
    /## Non-Row External Mentions\s+(?<body>[\s\S]*?)\n## Prompt-to-Artifact Checklist/u,
  );
  const body = section?.groups?.body ?? "";
  const referencedPaths = [
    "docs/business-model/claims-register.csv",
    "docs/business-model/message-hierarchy.md",
    "docs/goals/beta-release-authorization-packet.md",
    "docs/goals/stress-siem-authorization-packet.md",
  ];
  const checks = [
    {
      path: coverageAuditPath,
      requirement: "must include Non-Row External Mentions section",
      result: body ? "pass" : "fail",
    },
    {
      path: coverageAuditPath,
      requirement: "non-row mentions must remain outside independent open checklist rows",
      result: /not\s+independent\s+open\s+checklist\s+rows/iu.test(body) ? "pass" : "fail",
    },
    {
      path: coverageAuditPath,
      requirement: "non-row mentions must forbid creating legal market revenue compliance evidence",
      result: /Do not create legal, market, revenue, or compliance-certification evidence/iu.test(
        body,
      )
        ? "pass"
        : "fail",
    },
    {
      path: coverageAuditPath,
      requirement: "non-row mentions must require future claim-bearing master-goal change",
      result: /future\s+claim-bearing\s+master-goal\s+change/iu.test(body) ? "pass" : "fail",
    },
  ];

  for (const mentionedPath of referencedPaths) {
    checks.push({
      path: coverageAuditPath,
      requirement: `non-row mention must list ${mentionedPath}`,
      result: body.includes(`\`${mentionedPath}\``) ? "pass" : "fail",
    });
    checks.push({
      path: mentionedPath,
      requirement: "non-row mentioned artifact must exist",
      result: (await exists(mentionedPath)) ? "pass" : "fail",
    });
  }

  return checks;
}

function buildGateWiringChecks(packageJson, runTestsContent) {
  const scripts = packageJson?.scripts ?? {};
  const checks = [
    {
      path: packageJsonPath,
      requirement:
        "audit:construction-completion script must run audit-construction-completion.mjs",
      pass:
        scripts["audit:construction-completion"] ===
        "node scripts/audit-construction-completion.mjs",
    },
    {
      path: packageJsonPath,
      requirement:
        "audit:construction-completion:test script must run audit-construction-completion.test.mjs",
      pass:
        scripts["audit:construction-completion:test"] ===
        "node scripts/audit-construction-completion.test.mjs",
    },
    {
      path: packageJsonPath,
      requirement:
        "guard:construction-blocked-state script must run guard-construction-blocked-state.mjs",
      pass:
        scripts["guard:construction-blocked-state"] ===
        "node scripts/guard-construction-blocked-state.mjs",
    },
    {
      path: packageJsonPath,
      requirement:
        "guard:construction-blocked-state:test script must run guard-construction-blocked-state.test.mjs",
      pass:
        scripts["guard:construction-blocked-state:test"] ===
        "node scripts/guard-construction-blocked-state.test.mjs",
    },
    {
      path: packageJsonPath,
      requirement: "guard:claim-falsifies script must run validate-claim-bearing-falsifies.mjs",
      pass:
        scripts["guard:claim-falsifies"] === "node scripts/validate-claim-bearing-falsifies.mjs",
    },
    {
      path: packageJsonPath,
      requirement:
        "guard:claim-falsifies:test script must run validate-claim-bearing-falsifies.test.mjs",
      pass:
        scripts["guard:claim-falsifies:test"] ===
        "node scripts/validate-claim-bearing-falsifies.test.mjs",
    },
    {
      path: packageJsonPath,
      requirement: "lint script must run guard-construction-blocked-state.mjs",
      pass: String(scripts.lint ?? "").includes(
        "node scripts/guard-construction-blocked-state.mjs",
      ),
    },
    {
      path: packageJsonPath,
      requirement: "lint script must run validate-claim-bearing-falsifies.mjs",
      pass: String(scripts.lint ?? "").includes(
        "node scripts/validate-claim-bearing-falsifies.mjs",
      ),
    },
    {
      path: packageJsonPath,
      requirement: "lint script must run audit-construction-completion.mjs",
      pass: String(scripts.lint ?? "").includes("node scripts/audit-construction-completion.mjs"),
    },
    {
      path: runTestsPath,
      requirement: "test runner must execute audit-construction-completion.test.mjs",
      pass: runTestsContent.includes("scripts/audit-construction-completion.test.mjs"),
    },
    {
      path: runTestsPath,
      requirement: "test runner must execute guard-construction-blocked-state.test.mjs",
      pass: runTestsContent.includes("scripts/guard-construction-blocked-state.test.mjs"),
    },
    {
      path: runTestsPath,
      requirement: "test runner must execute validate-claim-bearing-falsifies.test.mjs",
      pass: runTestsContent.includes("scripts/validate-claim-bearing-falsifies.test.mjs"),
    },
  ];

  return checks.map((check) => ({
    path: check.path,
    requirement: check.requirement,
    result: check.pass ? "pass" : "fail",
  }));
}

function buildBlockedStateGuardChecks(guardContent) {
  const checks = [
    {
      requirement: "blocked-state guard must read the master-goal rescope packet",
      pass: guardContent.includes(rescopePacketPath),
    },
    {
      requirement: "blocked-state guard must require BLOCKED_RESCOPE_PACKET status",
      pass: guardContent.includes("BLOCKED_RESCOPE_PACKET"),
    },
    {
      requirement: "blocked-state guard must reject rescope packet boundary drift",
      pass: guardContent.includes("non-rescope/non-evidence/no-ledger-change boundary"),
    },
    {
      requirement: "blocked-state guard must reject missing rescope required terms",
      pass: guardContent.includes("missing required rescope-packet term"),
    },
    {
      requirement: "blocked-state guard must stale-claim-check the rescope packet",
      pass: /staleClaimDocs[\s\S]*rescopePacketPath/u.test(guardContent),
    },
    {
      requirement: "blocked-state guard must reject stale archived root-test counts",
      pass: guardContent.includes("stale root-test count"),
    },
    {
      requirement: "blocked-state guard must preserve archived blocked-state guard terms",
      pass: guardContent.includes("missing required archived blocked-state term"),
    },
    {
      requirement: "blocked-state guard must preserve archived delivered-artifact audit field",
      pass: guardContent.includes("archiveDeliveredArtifactChecks"),
    },
    {
      requirement: "blocked-state guard must preserve archived audit-issues and stale-count terms",
      pass:
        guardContent.includes("aggregate audit issue-list checks") &&
        guardContent.includes("completion-status blocker checks that include audit issues") &&
        guardContent.includes("synthetic completion-with-issues drift") &&
        guardContent.includes("stale 9/9 blocked-state guard count drift") &&
        guardContent.includes("stale 10/10 blocked-state guard count drift"),
    },
    {
      requirement: "blocked-state guard must preserve archived authorization-packet drift term",
      pass: guardContent.includes("authorization-packet execution-ready drift"),
    },
    {
      requirement: "blocked-state guard must preserve archived claim-bearing scan count",
      pass: guardContent.includes("215 claim-bearing files / 1,405 checks"),
    },
  ];

  return checks.map((check) => ({
    path: blockedStateGuardPath,
    requirement: check.requirement,
    result: check.pass ? "pass" : "fail",
  }));
}

async function buildArtifactSurfaceChecks() {
  const specs = [
    {
      path: "docs/goals/h3-macos-authorization-packet.md",
      expectedStatus: "BLOCKED_AUTHORIZATION_PACKET",
      boundaryPattern: /It is not authorization, not macOS evidence/iu,
    },
    {
      path: "docs/goals/beta-release-authorization-packet.md",
      expectedStatus: "BLOCKED_AUTHORIZATION_PACKET",
      boundaryPattern:
        /not authorization|does not contact users|does not publish|does not transact/iu,
    },
    {
      path: "docs/goals/stress-siem-authorization-packet.md",
      expectedStatus: "BLOCKED_AUTHORIZATION_PACKET",
      boundaryPattern:
        /not authorization|does not run stress|does not transmit SIEM|not evidence/iu,
    },
    {
      path: "docs/goals/runtime-evidence-authorization-prep.md",
      expectedStatus: "COMPLETE",
      boundaryPattern: /does not authorize|does not execute|Do not launch the runtime binary/iu,
    },
    {
      path: "docs/goals/adapter-e2e-authorization-blocker-review.md",
      expectedStatus: "COMPLETE",
      boundaryPattern:
        /Explicit runtime\/model authorization is absent|not runtime proof|No runtime session/iu,
    },
    {
      path: "docs/goals/real-user-home-install-authorization-prep.md",
      expectedStatus: "COMPLETE",
      boundaryPattern: /No real user-home write was performed|no write on dry-run|not enough/iu,
    },
    {
      path: rescopePacketPath,
      expectedStatus: "BLOCKED_RESCOPE_PACKET",
      boundaryPattern:
        /not a rescope\s+decision[\s\S]*not external evidence[\s\S]*no row, ledger count, or completion status changes/iu,
    },
  ];

  const checks = [];
  for (const spec of specs) {
    const content = await readRequiredText(spec.path);
    checks.push({
      path: spec.path,
      requirement: `status must be ${spec.expectedStatus}`,
      result: new RegExp(`^status:\\s*${escapeRegExp(spec.expectedStatus)}\\s*$`, "mu").test(
        content,
      )
        ? "pass"
        : "fail",
    });
    checks.push({
      path: spec.path,
      requirement: "must include Falsifies-If block",
      result: /\bFalsifies-If:\s*\n/u.test(content) ? "pass" : "fail",
    });
    checks.push({
      path: spec.path,
      requirement: "must preserve non-authorization/non-evidence boundary",
      result: spec.boundaryPattern.test(content) ? "pass" : "fail",
    });
  }

  return checks;
}

async function buildCoverageSurfacePathChecks(map) {
  const referencedPaths = new Set();

  for (const entry of map.values()) {
    for (const match of entry.surfaceCell.matchAll(/`(?<path>docs\/goals\/[^`]+\.md)`/gu)) {
      if (match.groups?.path) {
        referencedPaths.add(match.groups.path);
      }
    }
  }

  const checks = [];
  for (const surfacePath of [...referencedPaths].sort()) {
    checks.push({
      path: surfacePath,
      requirement: "coverage audit referenced surface must exist",
      result: (await exists(surfacePath)) ? "pass" : "fail",
    });
    checks.push({
      path: surfacePath,
      requirement: "coverage audit referenced surface must be guarded by the completion audit",
      result: guardedAuthorizationSurfacePaths.includes(surfacePath) ? "pass" : "fail",
    });
  }

  return checks;
}

async function buildArtifactTermChecks() {
  const specs = [
    {
      path: "docs/goals/h3-macos-authorization-packet.md",
      terms: [
        "Authorized Route A: Real macOS Host",
        "Authorized Route B: Manual GitHub Actions CI",
        "workflow_dispatch",
        "macos-latest",
        "docs/goals/evidence/h3-install-macos.md",
        "Failure count | 0",
        "No proxy evidence",
      ],
    },
    {
      path: "docs/goals/beta-release-authorization-packet.md",
      terms: [
        "Authorization Route A: Closed Beta H8",
        "Authorization Route B: Public Release I1-I3",
        "Authorization Route C: Sale Page, Payment, and Launch Posts I4-I5",
        "Authorization Route D: Opening Snapshot I6",
        "10 external users",
        "Stripe test transaction",
        "docs/goals/archive/v1.0-LAUNCH-2026-08-01.md",
      ],
    },
    {
      path: "docs/goals/stress-siem-authorization-packet.md",
      terms: [
        "Authorization Route A: F4 Concurrent Stress",
        "Authorization Route B: F5 External SIEM Ingest",
        "Authorization Route C: F6 Post-Execution Critic",
        "100 intended transition attempts",
        "External SIEM ingest command or API transcript",
        "real H-class run",
        "F6 is requested before real F1-F5 evidence exists",
      ],
    },
    {
      path: "docs/goals/runtime-evidence-authorization-prep.md",
      terms: [
        "RuntimeParityAuthorizationSchema",
        "BenchmarkAuthorizationSchema",
        "executionAllowed: false",
        "externalSessionsLaunched: false",
        "transcriptRetentionPath",
        "Do not launch the runtime binary until the authorization packet exists",
        "Cost/accounting record",
      ],
    },
    {
      path: "docs/goals/adapter-e2e-authorization-blocker-review.md",
      terms: [
        "packages/adapter-claude/test/e2e.test.ts",
        "packages/adapter-codex/test/e2e.test.ts",
        "packages/adapter-hermes/test/e2e.test.ts",
        "Explicit runtime/model authorization is absent",
        "transcript; before/after tests; HIMA events/ledger excerpts",
        "unsupported/degraded hooks being upgraded in claims",
      ],
    },
    {
      path: "docs/goals/real-user-home-install-authorization-prep.md",
      terms: [
        "No real user-home write was performed",
        "Real `~/.hima/skills/00-idea-pmf",
        "Target home",
        "Backup path",
        "Restore plan",
        "no write on dry-run",
        "A platform\n`install-artifacts` run alone is not enough",
      ],
    },
    {
      path: rescopePacketPath,
      terms: [
        "Required Rescope Decision Fields",
        "Decision owner",
        "Removed rows",
        "Replacement claims",
        "Evidence downgrade",
        "Falsifiers",
        "Ledger update",
        "This packet does not",
      ],
    },
  ];

  const checks = [];
  for (const spec of specs) {
    const content = await readRequiredText(spec.path);
    for (const term of spec.terms) {
      checks.push({
        path: spec.path,
        requirement: `must include required term: ${term.replace(/\s+/gu, " ")}`,
        result: content.includes(term) ? "pass" : "fail",
      });
    }
  }

  return checks;
}

async function buildPartialH3EvidenceChecks() {
  const specs = [
    {
      label: "linux",
      path: "docs/goals/evidence/h3-install-linux.md",
    },
    {
      label: "windows",
      path: "docs/goals/evidence/h3-install-windows.md",
    },
  ];

  const checks = [];
  for (const spec of specs) {
    const content = await readRequiredText(spec.path);
    checks.push({
      path: spec.path,
      requirement: `must be the ${spec.label} H3 install transcript`,
      result: new RegExp(
        `^# H3 Install Matrix Transcript - ${escapeRegExp(spec.label)}\\s*$`,
        "mu",
      ).test(content)
        ? "pass"
        : "fail",
    });
    checks.push({
      path: spec.path,
      requirement: "must preserve partial-evidence boundary",
      result: /partial H3 evidence only/iu.test(content) ? "pass" : "fail",
    });
    checks.push({
      path: spec.path,
      requirement: "missing zero-failure H3 transcript summary",
      result: /^\|\s*Failure count\s*\|\s*0\s*\|\s*$/mu.test(content) ? "pass" : "fail",
    });
  }

  return checks;
}

function buildStaleClaimChecks() {
  const docs = [
    { path: shortTermPath, content: shortTerm },
    { path: completePath, content: complete },
    { path: coverageAuditPath, content: coverageAudit },
    { path: archivePath, content: archive },
  ];

  const patterns = [
    {
      label: "must not claim ledger progress above 119/155",
      pattern: /\b(?:12[0-9]|1[3-9]\d|[2-9]\d{2,})\/155\b/u,
    },
    {
      label: "must not claim construction progress above 76.8%",
      pattern:
        /\b(?:construction\s+(?:ledger|goal|progress)|ledger|completion\s+audit|progress)\b[^\n]{0,80}\b(?:7[7-9]|[89]\d|100)(?:\.\d+)?%/iu,
    },
    {
      label: "must not claim current open-row count below 36",
      pattern:
        /\b(?:current|Cycle[-\s]*96|completion\s+audit|audit\s+reports)\b[^\n]{0,100}\b(?:[0-9]|[12]\d|3[0-5])\s+(?:open|unchecked)(?:\s+(?:master|checklist))?\s+rows\b/iu,
    },
    {
      label: "must not claim open rows were closed",
      pattern:
        /\b(?:open|unchecked|remaining)\s+(?:master\s+|checklist\s+)?rows\b[^.\n]{0,80}\b(?:are|now|have been|were|are now)\s+(?:closed|resolved|cleared|completed|done|satisfied)\b/iu,
    },
    {
      label: "must not claim the macOS transcript artifact exists",
      pattern:
        /docs\/goals\/evidence\/h3-install-macos\.md[^\n]*(?:exists|created|present|PASS|passes|passed)/iu,
    },
    {
      label: "must not claim macOS install proof is complete",
      pattern:
        /\b(?:H3\s+)?macOS\s+(?:install(?:\s+(?:test|matrix))?|transcript|proof)\b[^.\n]{0,80}\b(?:is|now|has been|was|were)\s+(?:complete|completed|done|passed|captured|verified|accepted|present|available)\b/iu,
    },
    {
      label: "must not claim manual CI H3 workflow success",
      pattern:
        /\b(?:manual\s+CI\s+(?:workflow|run|execution)|h3-install-matrix\s+(?:workflow|run)|H3\s+(?:CI|manual-CI)\s+(?:workflow|run|execution))\b[^.\n]{0,100}\b(?:is|now|has\s+been|have\s+been|was|were)\s+(?:run|executed|completed|passed|successful|verified|accepted|green)\b/iu,
    },
    {
      label: "must not claim partial Linux/Windows H3 evidence satisfies H3",
      pattern:
        /(?:\b(?:Linux\s*(?:\+|and|\/)\s*Windows|Windows\s*(?:\+|and|\/)\s*Linux)\b[^.\n]{0,120}\b(?:transcripts?|evidence|proof)\b[^.\n]{0,80}\b(?:satisf(?:y|ies|ied)|complete(?:s|d)?|close(?:s|d)?|prove(?:s|d)?|accepted|sufficient)\b[^.\n]{0,80}\bH3\b|\bH3\b[^.\n]{0,100}\b(?:satisf(?:ied|ies)|complete(?:d|s)?|closed|proved|accepted)\b[^.\n]{0,120}\b(?:Linux\s*(?:\+|and|\/)\s*Windows|Windows\s*(?:\+|and|\/)\s*Linux)\b)/iu,
    },
    {
      label: "must not claim adapter E2E artifacts exist or pass",
      pattern:
        /packages\/adapter-(?:claude|codex|hermes)\/test\/e2e\.test\.ts[^\n]*(?:exists|created|present|PASS|passes|passed)/iu,
    },
    {
      label: "must not claim adapter E2E completion",
      pattern:
        /\b(?:(?:Claude|Codex|Hermes)\s+adapter\s+E2E|adapter\s+(?:real\s+)?E2E|adapter-E2E)\b[^.\n]{0,80}\b(?:is|now|has(?:\s+been)?|was|were)\s+(?:complete|completed|done|passed|verified|accepted|green)\b/iu,
    },
    {
      label: "must not claim adapter production readiness",
      pattern:
        /\b(?:3\s+adapters|three\s+adapters|Claude\/Codex\/Hermes\s+adapters?|Claude\s+Code,\s+Codex,\s+and\s+Hermes\s+adapters?|adapter\s+production\s+readiness|adapters?\s+production[-\s]ready)\b[^.\n]{0,100}\b(?:are|is|now|has\s+been|have\s+been|was|were)\s+(?:production[-\s]ready|ready\s+for\s+production|verified|accepted|complete|completed|done|shipped)\b/iu,
    },
    {
      label: "must not claim adapter hook firing or behavior proof",
      pattern:
        /\b(?:adapter\s+hook\s+(?:firing|wiring)\s+proof|adapter\s+behavior|runtime\s+permission\s+enforcement|live\s+bypass-attempt\s+proof)\b[^.\n]{0,100}\b(?:is|are|now|has\s+been|have\s+been|was|were)\s+(?:captured|verified|validated|complete|completed|done|passed|proven)\b/iu,
    },
    {
      label: "must not claim unsupported or degraded adapter hooks are blocking controls",
      pattern:
        /\b(?:unsupported|degraded|non[-\s]?blocking)\s+(?:adapter\s+)?hooks?\b[^.\n]{0,100}\b(?:are|is|now|have\s+been|has\s+been|were|was)\s+(?:blocking|production[-\s]?blocking|enforced|upgraded|promoted|treated\s+as\s+blocking|made\s+blocking)\b/iu,
    },
    {
      label: "must not claim five-client compatibility is complete",
      pattern:
        /\b(?:five|5)[-\s]?client\s+compatibility\b[^.\n]{0,100}\b(?:is|now|has\s+been|was|were)\s+(?:complete|completed|done|passed|verified|accepted|green|ready)\b/iu,
    },
    {
      label: "must not claim the GitHub repository is public or released",
      pattern:
        /\b(?:GitHub\s+repo(?:sitory)?|repository|github\.com\/\[user\]\/hima)\b[^\n]{0,80}\b(?:is|now|has been|was)\s+(?:public|released)\b/iu,
    },
    {
      label: "must not claim GitHub repository visibility was flipped public",
      pattern:
        /\b(?:GitHub\s+repo(?:sitory)?|repository)\s+visibility\b[^.\n]{0,80}\b(?:has\s+been|was|is\s+now|now)\s+(?:flipped|changed|set|made)\s+to\s+public\b/iu,
    },
    {
      label: "must not claim v1 release tag or notes are published",
      pattern:
        /\b(?:v1\.0\.0\s+(?:tag|release)|release\s+(?:tag|notes)|tag\s+\+\s+release\s+notes)\b[^.\n]{0,80}\b(?:is|are|now|has been|have been|was|were)\s+(?:created|tagged|published|released|complete|completed|done|live|available)\b/iu,
    },
    {
      label: "must not claim npm publication is complete",
      pattern:
        /(?:@hima\/cli\b|\bnpm\s+(?:package|publication|publish)\b)[^\n]{0,80}\b(?:is|now|has been|was)\s+(?:published|complete|completed|done|live)\b/iu,
    },
    {
      label: "must not claim npm registry lookup returns the package",
      pattern:
        /\b(?:v1\.0\.0\s+)?npm\s+registry\s+lookup\b[^.\n]{0,80}\b(?:now\s+returns|has\s+returned|returned|was\s+verified\s+returning|is\s+returning)\b[^.\n]{0,80}\b(?:@hima\/cli|package)\b/iu,
    },
    {
      label: "must not claim global npm install works",
      pattern:
        /\b(?:npm\s+install\s+-g\s+@hima\/cli|global\s+@hima\/cli\s+install|@hima\/cli\s+global\s+install)\b[^.\n]{0,80}\b(?:now\s+works|has\s+been\s+verified|was\s+verified|is\s+working|is\s+complete|completed\s+successfully|passes?)\b/iu,
    },
    {
      label: "must not claim sale page or Stripe payment is live",
      pattern:
        /\b(?:founding-cohort\s+sale\s+page|sale\s+page|Stripe(?:\s+Connect)?|payment\s+flow)\b[^\n]{0,80}\b(?:is|now|has been|was)\s+(?:live|wired|complete|completed|done|processing|launched)\b/iu,
    },
    {
      label: "must not claim sale page accepted a real test transaction",
      pattern:
        /\b(?:founding(?:-cohort)?\s+sale\s+page|sale\s+page|Stripe(?:\s+Connect)?|payment\s+flow)\b[^.\n]{0,80}\b(?:now\s+accepts|has\s+accepted|accepted|was\s+verified\s+accepting)\b[^.\n]{0,80}\b(?:real\s+)?(?:Stripe\s+)?test\s+transaction\b/iu,
    },
    {
      label: "must not claim founding-cohort sales or cap reached",
      pattern:
        /\b(?:founding[-\s]cohort|1000[-\s]license|1000\s+(?:perpetual\s+)?(?:v1\.x\s+)?licenses?)\b[^.\n]{0,100}\b(?:has\s+been|have\s+been|has|have|is|was|were|now)\s+(?:sold|closed|capped|filled|reached|completed)\b/iu,
    },
    {
      label: "must not claim closed beta or saturation survey is complete",
      pattern:
        /\b(?:closed\s+beta|beta\s+users?|10\s+users|saturation\s+survey)\b[^\n]{0,80}\b(?:is|now|has been|was)\s+(?:complete|completed|done|collected|validated)\b/iu,
    },
    {
      label: "must not claim beta users participated or completed scenarios",
      pattern:
        /\b(?:closed\s+beta|beta\s+cohort|beta\s+users?|10\s+(?:beta\s+)?users|(?:beta|saturation)\s+survey\s+responses?)\b[^.\n]{0,80}\b(?:has\s+been|have\s+been|are\s+now|were|was|now)\s+(?:recruited|enrolled|contacted|surveyed|collected|completed|participated|submitted|validated)\b/iu,
    },
    {
      label: "must not claim beta survey results met scenario or pay-intent criteria",
      pattern:
        /\b(?:beta|saturation)\s+survey\b[^.\n]{0,100}\b(?:has\s+reported|has\s+shown|showed|confirmed|validated|met)\b[^.\n]{0,100}\b(?:completed\s+all\s+3\s+scenarios|pay\s+\$?249|pay\s+\$?249-299|would\s+pay|I'd\s+pay|I['’]d\s+pay)\b/iu,
    },
    {
      label: "must not claim launch posts are published",
      pattern:
        /\b(?:Show\s+HN|dev\.to|r\/devops|Claude\s+Code\s+Discord|launch\s+posts?)\b[^\n]{0,80}\b(?:are|now|have been|were)\s+(?:posted|published|live|complete|completed|done)\b/iu,
    },
    {
      label: "must not claim launch-post links were captured",
      pattern:
        /\b(?:Show\s+HN|dev\.to|r\/devops|Claude\s+Code\s+Discord|launch\s+post(?:s)?|public-post)\s+(?:link|links|URL|URLs|evidence)\b[^.\n]{0,80}\b(?:has\s+been|have\s+been|was|were|now)\s+(?:captured|collected|recorded|linked|published|posted)\b/iu,
    },
    {
      label: "must not claim runtime/model sessions executed",
      pattern:
        /(?<!no\s)\b(?:Claude\s+Code|Codex|Hermes|runtime\/model|model-backed)\s+(?:session|sessions|execution|run)\b[^\n]{0,80}\b(?:now|has been|have been|was|were)\s+(?:launched|executed|run|completed|passed)\b/iu,
    },
    {
      label: "must not claim runtime suite, parity, or final critic completion",
      pattern:
        /\b(?:5-scenario\s+suite|per-runtime\s+5-scenario\s+suite|cross-runtime\s+parity\s+test\s+harness|runtime\s+suite\s+and\s+parity|saturation\s+critic\s+over\s+the\s+test\s+results|Final\s+Stream\s+F\s+critic)\b[^.\n]{0,100}\b(?:is|are|now|has\s+been|have\s+been|was|were)\s+(?:complete|completed|done|green|passed|verified|accepted|executed|run)\b/iu,
    },
    {
      label: "must not claim runtime preflight allows execution",
      pattern: /["`]?(?:executionAllowed|externalSessionsLaunched)["`]?\s*:\s*true\b/iu,
    },
    {
      label: "must not claim self-test launched external runtime sessions",
      pattern: /["`]?externalRuntimeSessionsLaunched["`]?\s*:\s*true\b/iu,
    },
    {
      label: "must not claim benchmark dry-run is unblocked",
      pattern:
        /\b(?:benchmark|SWE-bench)\s+(?:plan|dry[-\s]?run)\b[^.\n]{0,100}\b(?:status|state)\b[^.\n]{0,80}\b(?:authorized|ready|unblocked|execution[-_\s]?allowed|executable|green)\b/iu,
    },
    {
      label: "must not claim real user-home install is complete",
      pattern:
        /\b(?:real\s+`?~\/\.hima`?|real\s+user-home|~\/\.hima\/skills)\b[^\n]{0,80}\b(?:now|has been|was)\s+(?:installed|written|complete|completed|done|proven|validated)\b/iu,
    },
    {
      label: "must not claim real user-home dry-run wrote files",
      pattern:
        /\b(?:real\s+`?~\/\.hima`?|real\s+user-home|~\/\.hima\/skills)\b[^.\n]{0,100}\b(?:dry[-\s]?run|planning\s+run)\b[^.\n]{0,100}\b(?<!not\s)(?:wrote|applied|installed|created|modified|changed)\b/iu,
    },
    {
      label: "must not claim real user-home backup or restore proof is complete",
      pattern:
        /\b(?:real\s+`?~\/\.hima`?|real\s+user-home|~\/\.hima\/skills)\b[^.\n]{0,120}\b(?:backup|restore|rollback)\b[^.\n]{0,120}\b(?:is|are|now|has\s+been|have\s+been|was|were)\s+(?:complete|completed|done|proven|validated|verified|accepted|captured)\b/iu,
    },
    {
      label: "must not claim book skills are installed in real user-home",
      pattern:
        /\b(?:00-idea-pmf|01-strategy-positioning|02-analysis-discovery|03-specification|04-design-ux-ui|05-architecture|07-build|09-quality-release-run|book[-\s]skills?|excellence[-\s]book\s+skills?)\b[^.\n]{0,100}\b(?:have\s+been|has\s+been|are\s+now|were|now)\s+(?:installed|written|validated|available|invokable)\b/iu,
    },
    {
      label: "must not claim harvested skills are installed or invoked in real sessions",
      pattern:
        /\b(?:HARV-\d{2}|ai-slop-cleaner|agnix-style|OMX\s+mode\s+state-machine|auto-harness\s+3-step\s+evidence\s+gate|typed\s+human-handoff|prompt-injection\s+scanner|opencode\s+default-deny|PreCompact\/PostCompact|claw-code\s+prompt-cache|opencode\s+anti-bypass|PreferenceRouter)\b[^.\n]{0,120}\b(?:has\s+been|have\s+been|is\s+now|are\s+now|was|were|now)\s+(?:installed|written|available|invokable|invoked|used|tested|validated)\b/iu,
    },
    {
      label: "must not claim SWE-bench or benchmark execution is complete",
      pattern:
        /\b(?:SWE-bench|benchmark)\b[^\n]{0,80}\b(?:now|has been|was)\s+(?:executed|run|completed|passed)\b/iu,
    },
    {
      label: "must not claim stress execution is complete",
      pattern:
        /\b(?:stress\s+test|100\s+concurrent|stress)\b[^\n]{0,80}\b(?:now|has been|was)\s+(?:executed|run|completed|passed)\b/iu,
    },
    {
      label: "must not claim external SIEM ingest is complete",
      pattern:
        /\b(?:external\s+SIEM|SIEM\s+ingest)\b[^\n]{0,80}\b(?:now|has been|was)\s+(?:ingested|transmitted|executed|completed|passed)\b/iu,
    },
    {
      label: "must not claim SIEM fixture transmitted externally",
      pattern: /["`]?externalTransmissions["`]?\s*:\s*true\b/iu,
    },
    {
      label: "must not claim fresh-machine external harness init is complete",
      pattern:
        /\b(?:external\s+`?harness\s+init`?\s+run|`?harness\s+init`?\s+run\s+on\s+a\s+fresh\s+machine|fresh[-\s]machine\s+`?harness\s+init`?\s+run)\b[^.\n]{0,80}\b(?:is|now|has been|was|were)\s+(?:complete|completed|successful|verified|passed)\b/iu,
    },
    {
      label: "must not claim business/legal/market/revenue proof is complete",
      pattern:
        /\b(?:revenue|legal\s+certification|market\s+validation|market\s+evidence|legal\/market\s+evidence|compliance[-\s]+certification)\b[^\n]{0,80}\b(?:is|now|has been|was|are|were)\s+(?:proven|validated|certified|complete|completed|done|collected|created|achieved)\b/iu,
    },
    {
      label: "must not claim external authorization was granted",
      pattern:
        /\b(?:(?:external|macOS|CI|runtime\/model|runtime|model-backed|user-home|~\/\.hima|SWE-bench|benchmark|stress|SIEM|beta|user-contact|public\s+release|GitHub|npm|Stripe|payment|launch)\b[^.\n]{0,80}\bauthorization\b|\bauthorization\b(?![-\s]+(?:packet|prep|field|surface|branch|blocker|class|route))[^.\n]{0,80}\b(?:external|macOS|CI|runtime\/model|runtime|model-backed|user-home|~\/\.hima|SWE-bench|benchmark|stress|SIEM|beta|user-contact|public\s+release|GitHub|npm|Stripe|payment|launch)\b)[^.\n]{0,80}\b(?:is|now|has been|was|were)\s+(?:granted|approved|obtained|provided|cleared|authorized|available)\b/iu,
    },
    {
      label: "must not claim authorization packets are execution-ready",
      pattern:
        /\b(?:authorization[-\s]?packet|packet\/prep|packet\s+coverage|coverage\s+audit|local\s+packet)\b[^.\n]{0,100}\b(?<!not\s)(?<!no\s)(?:is|are|now|has\s+been|have\s+been|was|were)\s+(?:ready|sufficient|accepted|approved|cleared|complete|completed|green|valid)\b[^.\n]{0,100}\b(?:to|for)\s+(?:run|execute|launch|proceed|start|publish|contact|transmit|write)\b/iu,
    },
    {
      label: "must not claim external blockers were resolved",
      pattern:
        /\b(?:external\s+(?:evidence\s+)?blockers?|macOS\s+blocker|runtime\/model\s+blocker|user-home\s+blocker|benchmark\s+blocker|stress(?:\/SIEM)?\s+blocker|SIEM\s+blocker|beta(?:\/user)?\s+blocker|release(?:\/payment\/launch)?\s+blocker|public\s+release\s+blocker|blocked\s+lanes?)\b[^.\n]{0,80}\b(?:are|now|have been|were|is|has been|was)\s+(?:resolved|cleared|removed|unblocked|closed|satisfied|lifted)\b/iu,
    },
    {
      label: "must not claim Cycle 96 is unblocked",
      pattern:
        /(?:\b(?:Cycle[-\s]*96|current\s+cycle|construction\s+goal|master\s+goal)\b[^.\n]{0,80}\b(?:is|now|has\s+been|was|were)?\s*(?:unblocked|blocker[-\s]?free|no\s+longer\s+blocked)\b|\b(?:no|zero|0)\s+(?:external\s+)?(?:evidence\s+)?blockers?\s+(?:remain|remaining|left|open)\b)/iu,
    },
    {
      label: "must not claim external evidence is present",
      pattern:
        /(?<!no\s)(?<!not\s)\b(?:external\s+evidence|macOS\s+evidence|runtime\s+evidence|model-backed\s+evidence|user-home\s+evidence|benchmark\s+evidence|stress\s+evidence|SIEM\s+evidence|beta\s+evidence|release\s+evidence|launch\s+evidence)\b[^.\n]{0,80}\b(?:is|are|now|has been|have been|was|were)\s+(?:present|created|collected|captured|available|accepted|verified|ready|complete|completed)\b/iu,
    },
    {
      label: "must not claim Cycle 96 is ready to close",
      pattern:
        /\b(?:Cycle[-\s]*96|current\s+cycle|this\s+cycle)\b[^.\n]{0,80}\b(?:is|now|has been|was|were|are)?\s*(?:ready|clear|safe|eligible|approved|permitted|allowed)\s+to\s+close\b/iu,
    },
    {
      label: "must not claim require-complete succeeded",
      pattern:
        /(?:--require-complete|\brequire-complete\b)[^.\n]{0,100}\b(?:succeeded|succeeds|returned\s+0|exit(?:ed)?\s+0|passes?\s+as\s+complete|reports?\s+complete|completed\s+successfully)\b/iu,
    },
    {
      label: "must not claim construction goal was achieved",
      pattern:
        /\b(?:construction\s+goal|master\s+goal|complete\s+construction\s+goal|full\s+construction\s+goal)\b\s+(?:(?:is|was|were)\s+|has\s+been\s+|has\s+now\s+been\s+|is\s+now\s+|now\s+)(?!not\b)(?:achieved|fulfilled|satisfied|complete|completed|done|closed|shipped)\b/iu,
    },
    {
      label: "must not claim green local tests prove construction completion",
      pattern:
        /\b(?:root\s+)?(?:tests?|test\s+suite|full\s+suite|lint|build|green\s+gates|local\s+gates)\b[^.\n]{0,100}\b(?:pass(?:ed|es)?|green|succeed(?:ed|s)?|clean)\b[^.\n]{0,100}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
    },
    {
      label: "must not claim empty audit issues prove construction completion",
      pattern:
        /\b(?:audit\s+issues?|issues\s*(?::\s*)?\[\]|issue\s+list|aggregate\s+audit\s+issue\s+list)\b[^.\n]{0,100}\b(?:empty|clear|clean|zero|0|none|no\s+issues?|no\s+findings?)\b[^.\n]{0,100}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
    },
    {
      label: "must not claim row mapping completeness proves construction completion",
      pattern:
        /\b(?:36\/36\s+)?(?:row-to-external-blocker\s+mappings?|external-blocker\s+mappings?|open-row\s+mappings?|row\s+mappings?|coverage[-\s]?map\s+rows?)\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
    },
    {
      label: "must not claim packet coverage completeness proves construction completion",
      pattern:
        /\b(?:36\/36\s+)?(?:open|unchecked|remaining)\s+(?:master\s+|checklist\s+)?rows?\b[^.\n]{0,80}\b(?:have|has|with|are|were)\s+(?:packet\/prep|packet\s+and\s+prep|packet[-\s]prep|authorization[-\s]packet|packet)\s+coverage\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
    },
    {
      label: "must not claim blocker-list exactness proves construction completion",
      pattern:
        /\b(?:machine[-\s]readable\s+)?(?:external[-\s]?blocker\s+list|blocker\s+list|external\s+blocker\s+classes?|blocker\s+classes?)\b[^.\n]{0,120}\b(?:exact|complete|clean|verified|mapped|pass(?:es|ed)?)\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
    },
    {
      label: "must not claim Falsifies-If validation proves construction completion",
      pattern:
        /\b(?:claim-bearing\s+(?:Falsifies-If\s+)?(?:validation|scan|checks?)|Falsifies-If\s+(?:validation|field\s+checks?|gate\s+checks?|checks?)|runtime\s+post_tool\s+Falsifies-If\s+gate)\b[^.\n]{0,120}\b(?:pass(?:es|ed)?|green|clean|complete|valid|verified)\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
    },
    {
      label: "must not claim completion-artifact absence proves construction completion",
      pattern:
        /\b(?:completion[-\s]artifact\s+absence|required\s+completion\s+artifacts?|missing\s+completion\s+artifacts?|artifact[-\s]absence\s+checks?)\b[^.\n]{0,120}\b(?:absent|missing|pass(?:es|ed)?|green|clean|verified)\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
    },
    {
      label: "must not claim status-blocker checks prove construction completion",
      pattern:
        /\b(?:status[-\s]blocker\s+checks?|completion[-\s]status\s+blocker\s+checks?|blocked[-\s]status\s+checks?)\b[^.\n]{0,120}\b(?:pass(?:es|ed)?|green|clean|verified|satisfied)\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
    },
    {
      label: "must not claim DONE-criteria checks prove construction completion",
      pattern:
        /\b(?:active\s+)?DONE[-\s]criteria\s+(?:checks?|requirements?|criteria)\b[^.\n]{0,120}\b(?:pass(?:es|ed)?|green|clean|verified|satisfied|strict)\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
    },
    {
      label: "must not claim local packet/prep/audit surfaces prove external completion",
      pattern:
        /\b(?:packet\s+coverage(?:\s+audit)?|coverage\s+audit|authorization[-\s]+prep|prep\s+surface|packet\/audit\s+artifact|local\s+proxy\s+artifacts?)\b[^.\n]{0,100}\b(?<!not\s)(?<!no\s)(?:proof|proves?|authorizes?|authorized|confirms?|(?:is|are|accepted|used)\s+as\s+evidence\s+of)\b[^.\n]{0,80}\b(?:external\s+(?:execution|evidence)|completion|DONE|row\s+closure|ledger\s+advance)/iu,
    },
    {
      label: "must not claim master-goal rescope was enacted",
      pattern:
        /\b(?:master\s+goal|construction\s+goal|Cycle[-\s]*96)\b[^\n]{0,80}\b(?:now|has been|was)\s+(?:rescoped|rescop(?:e|ed)\s+approved|rescop(?:e|ed)\s+enacted)\b/iu,
    },
    { label: "must not reference a Cycle 96 DONE archive", pattern: /cycle-96-DONE/iu },
    { label: "must not mark a Cycle 96 surface DONE", pattern: /^status:\s*DONE\s*$/imu },
    {
      label: "must not claim the launch snapshot exists",
      pattern: /v1\.0-LAUNCH-2026-08-01\.md[^\n]*(?:exists|created|present)/iu,
    },
    {
      label: "must not claim the launch snapshot was captured",
      pattern:
        /\b(?:opening\s+snapshot|launch\s+snapshot)\b[^.\n]{0,80}\b(?:has\s+been|was|is\s+now|now)\s+(?:captured|created|written|archived|completed|done)\b/iu,
    },
    {
      label: "must not reference stale 11 runtime Falsifies gate invariants",
      pattern: /\b11 runtime Falsifies gate invariants\b/iu,
    },
    {
      label: "must not reference stale runtimeFalsifiesGateChecks field counts",
      pattern: /\b(?:11|12)\s+`?runtimeFalsifiesGateChecks`?\b/iu,
    },
    {
      label: "must not reference stale runtime gate check ratios",
      pattern: /\b(?:11|12)\/(?:11|12)\s+runtime gate checks\b/iu,
    },
    {
      label: "must not reference stale falsifiesFieldChecks field counts",
      pattern: /\b(?:74|75)\s+`?falsifiesFieldChecks`?\b/iu,
    },
    {
      label: "must not reference stale falsifies-field check ratios",
      pattern: /\b(?:74|75)\/(?:74|75)\s+falsifies-field checks\b/iu,
    },
    {
      label: "must not reference stale artifactTermChecks field counts",
      pattern: /\b(?:47|48)\s+`?artifactTermChecks`?\b/iu,
    },
    {
      label: "must not reference stale required-term check ratios",
      pattern: /\b(?:47|48)\/(?:47|48)\s+required-term checks\b/iu,
    },
    {
      label: "must not reference stale artifactSurfaceChecks field counts",
      pattern: /\b(?:19|20)\s+`?artifactSurfaceChecks`?\b/iu,
    },
    {
      label: "must not reference stale surface check ratios",
      pattern: /\b(?:19|20)\/(?:19|20)\s+surface checks\b/iu,
    },
    {
      label: "must not reference stale coverageSurfacePathChecks field counts",
      pattern: /\b(?:10|11)\s+`?coverageSurfacePathChecks`?\b/iu,
    },
    {
      label: "must not reference stale referenced-surface check ratios",
      pattern: /\b(?:10|11)\/(?:10|11)\s+referenced surfaces\b/iu,
    },
    {
      label: "must not reference stale 9/9 blocked-state guard checks",
      pattern: /\b9\/9 blocked-state guard checks\b/iu,
    },
    {
      label: "must not reference stale 10/10 blocked-state guard checks",
      pattern: /\b10\/10 blocked-state guard checks\b/iu,
    },
    {
      label: "must not reference stale blockedStateGuardChecks field counts",
      pattern: /\b(?:9|10)\s+`?blockedStateGuardChecks`?\b/iu,
    },
  ];

  const checks = [];
  for (const doc of docs) {
    for (const check of patterns) {
      checks.push({
        path: doc.path,
        requirement: check.label,
        result: check.pattern.test(doc.content) ? "fail" : "pass",
      });
    }
  }

  checks.push({
    path: completePath,
    requirement: "must not claim all-OS H3 completion while macOS evidence is absent",
    result:
      /H3\b[^\n]*(?:complete|closed|PASS)[^\n]*(?:Linux\s*\+\s*macOS\s*\+\s*Windows|all three OS)/iu.test(
        complete,
      )
        ? "fail"
        : "pass",
  });

  return checks;
}

function buildNextAllowedBranchChecks() {
  const specs = [
    {
      path: shortTermPath,
      content: shortTerm,
      requiredBranches: [
        "Real macOS environment access, or explicit authorization to run the prepared manual CI workflow.",
        "Runtime/model sessions | Target runtime, credentials, cost scope, transcript retention, and stop conditions for Claude/Codex/Hermes.",
        "Real user-home install | Explicit write permission for `~/.hima`, backup path, restore proof, dry-run path match, and rollback stop condition.",
        "Benchmark execution | SWE-bench instance count, model budget, credential scope, cost accounting, transcript retention, and governed-vs-baseline result schema.",
        "SIEM/compliance | Test SIEM destination, data-retention permission, pack source run, and legal-copy boundary",
        "Beta/users | Contact permission, storage/privacy boundary, survey template, and acceptance/falsifier criteria",
        "Public release/payment/launch | GitHub/npm/hosting/Stripe/public-post authorization and rollback/incident boundaries",
        "the master goal is intentionally rescoped with a new claim-bearing decision",
      ],
    },
    {
      path: archivePath,
      content: archive,
      requiredBranches: [
        "A real macOS environment or manual CI execution is explicitly authorized for H3.",
        "Runtime/model execution is explicitly authorized with target, cost, credential, and transcript scope.",
        "Real user-home writes under `~/.hima` are explicitly authorized with backup and restore scope.",
        "Stress/SIEM execution is explicitly authorized with disposable environment and data-retention scope.",
        "Beta/user contact is explicitly authorized with privacy and survey boundaries.",
        "Public release/payment/launch actions are explicitly authorized with rollback and incident scope.",
        "The master goal is intentionally rescoped by a claim-bearing decision.",
        `Preparation-only packet: \`${rescopePacketPath}\`.`,
      ],
    },
  ];

  const checks = [];
  for (const spec of specs) {
    for (const branch of spec.requiredBranches) {
      checks.push({
        path: spec.path,
        requirement: `must preserve next allowed branch: ${branch.replace(/\s+/gu, " ")}`,
        result: spec.content.includes(branch) ? "pass" : "fail",
      });
    }
  }

  return checks;
}

function buildArchiveDeliveredArtifactChecks() {
  const specs = [
    {
      artifact: "docs/goals/h3-macos-authorization-packet.md",
      terms: ["real macOS host", "manual CI routes", "H3 macOS proof"],
    },
    {
      artifact: "docs/goals/beta-release-authorization-packet.md",
      terms: ["H8 and I1-I6", "user-contact", "launch-snapshot"],
    },
    {
      artifact: "docs/goals/stress-siem-authorization-packet.md",
      terms: ["F4/F5/F6", "external SIEM", "stop-condition fields"],
    },
    {
      artifact: "docs/goals/external-authorization-packet-coverage-audit.md",
      terms: ["36 remaining unchecked master rows", "authorization packets or prep surfaces"],
    },
    {
      artifact: "docs/goals/master-goal-rescope-decision-packet.md",
      terms: [
        "future claim-bearing master-goal rescope",
        "preparation only",
        "does not enact a rescope",
      ],
    },
    {
      artifact: "scripts/guard-construction-blocked-state.mjs",
      terms: [
        "active BLOCKED status",
        "required authorization packet/prep/rescope terms",
        "required packet/prep/rescope surfaces",
        "rescope packet boundary",
      ],
    },
    {
      artifact: "scripts/audit-construction-completion.mjs",
      terms: [
        "blockedStateGuardChecks",
        "authorization packet/prep/rescope surface checks",
        "authorization packet/prep/rescope required-term checks",
        "stale 9/9 blocked-state guard count drift",
        "stale 10/10 blocked-state guard count drift",
        "`--require-complete` fails",
      ],
    },
    {
      artifact: "scripts/validate-claim-bearing-falsifies.mjs",
      terms: ["215 claim-bearing files / 1,405 checks"],
    },
    {
      artifact: "packages/core/src/gates/evaluate-gate.ts",
      terms: ["Runtime `post_tool` Falsifies-If enforcement"],
    },
    {
      artifact: "packages/core/test/handle-hook.test.ts",
      terms: ["invalid-claim event to later `stop` blocker lifecycle"],
    },
  ];

  return specs.map((spec) => ({
    path: archivePath,
    requirement: `must preserve delivered-artifact summary for ${spec.artifact}`,
    result:
      archive.includes(`| \`${spec.artifact}\` |`) &&
      spec.terms.every((term) => archive.includes(term))
        ? "pass"
        : "fail",
  }));
}

function buildArchiveNonGoalChecks() {
  const requiredNonGoals = [
    "create `docs/goals/evidence/h3-install-macos.md`",
    "mark H3 complete",
    "launch Claude, Codex, Hermes, SWE-bench, or any model-backed session",
    "write to real `~/.hima`",
    "run production/concurrent stress",
    "transmit data to an external SIEM",
    "contact users or collect beta data",
    "publish a GitHub release, npm package, sale page, payment flow, or launch post",
    "create `docs/goals/archive/v1.0-LAUNCH-2026-08-01.md`",
    "claim revenue, legal certification, market validation, public release, or final completion",
  ];

  return requiredNonGoals.map((nonGoal) => ({
    path: archivePath,
    requirement: `must preserve archived non-goal: ${nonGoal}`,
    result: archive.includes(nonGoal) ? "pass" : "fail",
  }));
}

function buildArchiveBlockerChecks() {
  const requiredBlockers = [
    {
      label: "H3 macOS transcript",
      reason:
        "H3 requires `docs/goals/evidence/h3-install-macos.md` from real macOS or explicitly authorized CI.",
    },
    {
      label: "Runtime/model sessions",
      reason:
        "Adapter E2E, F1/F3, benchmark, and HARV live invocations require real Claude/Codex/Hermes or model-backed execution authorization.",
    },
    {
      label: "Real `~/.hima` writes",
      reason:
        "Book and harvested-skill install rows require explicit user-home write authorization plus backup/restore evidence.",
    },
    {
      label: "Stress/SIEM execution",
      reason:
        "F4/F5/F6 require a disposable stress environment, external SIEM destination, retention boundary, and real H-class pack source.",
    },
    {
      label: "Beta/user contact",
      reason:
        "H8 requires authorized external users, privacy/storage rules, survey records, and saturation summary.",
    },
    {
      label: "Public release/payment/launch",
      reason:
        "I1-I6 require GitHub/npm/hosting/Stripe/public-post authorization and real launch artifacts.",
    },
  ];

  return requiredBlockers.map((blocker) => ({
    path: archivePath,
    requirement: `must preserve archived blocker: ${blocker.label}`,
    result:
      archive.includes(`| ${blocker.label} |`) && archive.includes(blocker.reason)
        ? "pass"
        : "fail",
  }));
}

function buildArchiveVerificationEvidenceChecks() {
  const requiredEvidence = [
    {
      label: "Open-row extraction",
      terms: [
        "Open-row extraction",
        'rg -n "^- \\[ \\]" docs/goals/COMPLETE-CONSTRUCTION-GOAL.md',
        "exact 36 unchecked rows",
      ],
    },
    {
      label: "Packet coverage audit",
      terms: ["Packet coverage audit", "maps all 36 open rows"],
    },
    {
      label: "Completion artifact absence",
      terms: [
        "Completion artifact absence",
        "docs/goals/evidence/h3-install-macos.md",
        "docs/goals/archive/v1.0-LAUNCH-2026-08-01.md",
        "packages/adapter-claude/test/e2e.test.ts",
        "packages/adapter-codex/test/e2e.test.ts",
        "packages/adapter-hermes/test/e2e.test.ts",
      ],
    },
    {
      label: "Ledger truth",
      terms: ["Ledger truth", "119/155", "76.8%"],
    },
    {
      label: "docs:index",
      terms: ["`corepack pnpm docs:index`", "PASS"],
    },
    {
      label: "lint",
      terms: ["`corepack pnpm lint`", "PASS"],
    },
    {
      label: "guard test",
      terms: [
        "`corepack pnpm guard:construction-blocked-state:test`",
        "PASS",
        "authorization-packet execution-ready drift",
      ],
    },
    {
      label: "audit test",
      terms: [
        "`corepack pnpm audit:construction-completion:test`",
        "PASS",
        "authorization-packet execution-ready drift",
      ],
    },
    {
      label: "root tests",
      terms: ["`corepack pnpm test -- --bail`", "53 Vitest files / 702 tests"],
    },
    {
      label: "require-complete failure",
      terms: [
        "`node scripts/audit-construction-completion.mjs --require-complete`",
        "expected failure",
      ],
    },
    {
      label: "diff check",
      terms: ["`git diff --check`", "PASS"],
    },
    {
      label: "post-tool dry-run",
      terms: ["Post-tool dry-run", "`post_tool` allowed"],
    },
    {
      label: "saturation sweep",
      terms: ["Saturation sweep", "no stale ledger-advance"],
    },
  ];

  return requiredEvidence.map((evidence) => ({
    path: archivePath,
    requirement: `must preserve archived verification evidence: ${evidence.label}`,
    result: evidence.terms.every((term) => archive.includes(term)) ? "pass" : "fail",
  }));
}

function buildShortTermDoneCriteriaChecks() {
  const requiredDoneCriteria = [
    "This cycle cannot reach DONE through local code or docs alone.",
    "It reaches DONE only when one\nauthorization packet is explicitly provided and the corresponding real evidence is produced and\nverified, or the master goal is intentionally rescoped with a new claim-bearing decision.",
    "Cycle 96 is marked DONE from local proxy artifacts without the external/environment evidence named above.",
  ];

  return requiredDoneCriteria.map((criterion) => ({
    path: shortTermPath,
    requirement: `must preserve active DONE criterion: ${criterion.replace(/\s+/gu, " ")}`,
    result: shortTerm.includes(criterion) ? "pass" : "fail",
  }));
}

function buildShortTermBlockerSummaryChecks() {
  const requiredBlockerTerms = [
    "real macOS or authorized CI",
    "real runtime/model sessions",
    "real `~/.hima` writes",
    "benchmark/stress/SIEM execution",
    "beta users",
    "public release actions",
    "payment wiring",
    "launch posts",
    "legal/market evidence",
  ];

  return requiredBlockerTerms.map((term) => ({
    path: shortTermPath,
    requirement: `must preserve active blocked-rationale term: ${term}`,
    result: shortTerm.includes(term) ? "pass" : "fail",
  }));
}

async function buildFalsifiesFieldChecks() {
  const checks = [];

  for (const surfacePath of falsifiesFieldSurfacePaths) {
    const content = await readRequiredText(surfacePath);
    const blocks = extractFalsifiesBlocks(content);

    checks.push({
      path: surfacePath,
      requirement: "must include Falsifies-If block",
      result: blocks.length > 0 ? "pass" : "fail",
    });

    for (const [index, block] of blocks.entries()) {
      const blockLabel =
        blocks.length === 1 ? "Falsifies-If block" : `Falsifies-If block ${index + 1}`;
      const anchor = extractFalsifiesField(block, "evidence-anchor");
      const anchorPath = anchor ? normalizeEvidenceAnchorPath(anchor) : "";

      checks.push({
        path: surfacePath,
        requirement: `${blockLabel} must include kill-condition`,
        result: extractFalsifiesField(block, "kill-condition") ? "pass" : "fail",
      });
      checks.push({
        path: surfacePath,
        requirement: `${blockLabel} must include checkpoint-date`,
        result: extractFalsifiesField(block, "checkpoint-date") ? "pass" : "fail",
      });
      checks.push({
        path: surfacePath,
        requirement: `${blockLabel} must include evidence-anchor`,
        result: anchor ? "pass" : "fail",
      });
      checks.push({
        path: surfacePath,
        requirement: `${blockLabel} evidence-anchor must resolve`,
        evidence: anchorPath || "missing evidence-anchor",
        result: anchorPath && (await exists(anchorPath)) ? "pass" : "fail",
      });
      checks.push({
        path: surfacePath,
        requirement: `${blockLabel} must include on-fail`,
        result: extractFalsifiesField(block, "on-fail") ? "pass" : "fail",
      });
    }
  }

  return checks;
}

function buildRuntimeFalsifiesGateChecks() {
  const specs = [
    {
      path: gateEvaluatorPath,
      requirement: "runtime gate must emit MISSING_FALSIFIES_IF for invalid claim-bearing writes",
      pass:
        gateEvaluator.includes('violationType: "MISSING_FALSIFIES_IF"') &&
        gateEvaluator.includes('postToolPolicyEvent("MISSING_FALSIFIES_IF", true)'),
    },
    {
      path: gateEvaluatorPath,
      requirement: "runtime gate must validate claim-bearing write targets during post_tool",
      pass:
        gateEvaluator.includes("if (writeEvent)") &&
        gateEvaluator.includes("findFalsifiesIfViolation(context.projectRoot, targets)"),
    },
    {
      path: gateEvaluatorPath,
      requirement: "runtime gate must match top-of-file claim-bearing frontmatter scope",
      pass: gateEvaluator.includes(
        String.raw`^---\s*\r?\n[\s\S]*?\bclaim-bearing:\s*true\b[\s\S]*?\r?\n---`,
      ),
    },
    {
      path: gateEvaluatorPath,
      requirement: "runtime gate must resolve this-file evidence anchors",
      pass:
        gateEvaluator.includes("function normalizeEvidenceAnchor") &&
        gateEvaluator.includes("sourceRelativeTarget") &&
        gateEvaluator.includes("this file"),
    },
    {
      path: gateEvaluatorPath,
      requirement: "runtime gate must extract repo-local paths from explanatory evidence anchors",
      pass:
        gateEvaluator.includes("localPathMatch") &&
        gateEvaluator.includes("(?:\\.hima|docs|fixtures|packages|scripts)"),
    },
    {
      path: gateEvaluatorPath,
      requirement: "runtime gate must accept directory anchors consistently with repo validator",
      pass: gateEvaluator.includes("anchorStats.isDirectory()"),
    },
    {
      path: gateEvaluatorTestPath,
      requirement: "gate tests must cover missing claim-bearing Falsifies-If blocks",
      pass: gateEvaluatorTest.includes(
        "blocks claim-bearing artifact writes without a Falsifies-If block",
      ),
    },
    {
      path: gateEvaluatorTestPath,
      requirement: "gate tests must cover unresolved evidence anchors",
      pass: gateEvaluatorTest.includes(
        "blocks claim-bearing artifact writes when the evidence anchor cannot resolve",
      ),
    },
    {
      path: gateEvaluatorTestPath,
      requirement: "gate tests must cover explanatory-suffix evidence anchors",
      pass: gateEvaluatorTest.includes(
        "allows claim-bearing artifact anchors with local path plus explanatory suffix",
      ),
    },
    {
      path: gateEvaluatorTestPath,
      requirement: "gate tests must cover this-file section evidence anchors",
      pass: gateEvaluatorTest.includes(
        "allows claim-bearing artifact anchors that refer to this file section",
      ),
    },
    {
      path: gateEvaluatorTestPath,
      requirement: "gate tests must cover non-frontmatter claim-bearing text",
      pass: gateEvaluatorTest.includes(
        "ignores claim-bearing text outside top-of-file frontmatter",
      ),
    },
    {
      path: handleHookTestPath,
      requirement: "handle-hook tests must cover Falsifies-If policy event persistence",
      pass:
        handleHookTest.includes(
          "blocks later Stop after unresolved PostToolUse Falsifies-If policy events",
        ) &&
        handleHookTest.includes('violationType: "MISSING_FALSIFIES_IF"') &&
        handleHookTest.includes("resolvableByEvidence: true"),
    },
    {
      path: handleHookTestPath,
      requirement:
        "handle-hook tests must cover Stop blocking unresolved Falsifies-If policy events",
      pass:
        handleHookTest.includes('expect(stopResult.decision).toBe("block")') &&
        handleHookTest.includes(
          'expect(stopResult.violationType).toBe("UNRESOLVED_POLICY_VIOLATION")',
        ) &&
        handleHookTest.includes('expect(stopResult.reason).toContain("MISSING_FALSIFIES_IF")'),
    },
  ];

  return specs.map(({ path, requirement, pass }) => ({
    path,
    requirement,
    result: pass ? "pass" : "fail",
  }));
}

function extractFalsifiesBlocks(content) {
  const blocks = [];
  const blockPattern =
    /^Falsifies-If:\s*\r?\n(?<body>(?:[ \t]+(?:kill-condition|checkpoint-date|evidence-anchor|on-fail):[^\r\n]*(?:\r?\n|$))+)/gmu;

  for (const match of content.matchAll(blockPattern)) {
    blocks.push(match.groups?.body ?? "");
  }

  return blocks;
}

function extractFalsifiesField(block, field) {
  const match = block.match(new RegExp(`^\\s*${escapeRegExp(field)}:\\s*(?<value>\\S.*)$`, "mu"));
  return match?.groups?.value.trim() ?? "";
}

function normalizeEvidenceAnchorPath(anchor) {
  return anchor
    .replace(/^`(?<path>[^`]+)`.*$/u, "$<path>")
    .split(/\s+§\s+/u)[0]
    .trim();
}

function buildExternalBlockerListChecks() {
  const expectedBlockers = [
    "real macOS or authorized CI H3 transcript",
    "real Claude/Codex/Hermes runtime-model sessions",
    "real user-home ~/.hima install and restore evidence",
    "benchmark, stress, and external SIEM execution evidence",
    "closed-beta user evidence and saturation survey",
    "public GitHub/npm/release/payment/launch artifacts",
  ];

  const checks = expectedBlockers.map((blocker) => ({
    path: "scripts/audit-construction-completion.mjs",
    requirement: `must include external blocker: ${blocker}`,
    result: externalBlockers.includes(blocker) ? "pass" : "fail",
  }));

  checks.push({
    path: "scripts/audit-construction-completion.mjs",
    requirement: "must not add or remove external blocker classes",
    result: externalBlockers.length === expectedBlockers.length ? "pass" : "fail",
  });

  return checks;
}

function buildCompletionArtifactAbsenceChecks(entries) {
  return entries.map((entry) => ({
    path: entry.path,
    requirement: "required completion artifact must be absent while Cycle 96 is BLOCKED",
    result: cycle96Blocked && entry.exists ? "fail" : "pass",
  }));
}

function buildStatusBlockerChecks(completionEvidencePresent, baseIssueCount) {
  const allCompletionArtifactsPresent = pathStatus.every((entry) => entry.exists);
  const shortTermDone = /^status:\s*DONE\s*$/m.test(shortTerm);

  return [
    {
      path: completePath,
      requirement: "open master rows must keep completion status blocked",
      result: openRows.length > 0 && completionEvidencePresent ? "fail" : "pass",
    },
    {
      path: "required completion artifacts",
      requirement: "missing completion artifacts must keep completion status blocked",
      result: !allCompletionArtifactsPresent && completionEvidencePresent ? "fail" : "pass",
    },
    {
      path: shortTermPath,
      requirement: "Cycle 96 BLOCKED must keep completion status blocked",
      result: cycle96Blocked && completionEvidencePresent ? "fail" : "pass",
    },
    {
      path: "scripts/audit-construction-completion.mjs",
      requirement:
        "completion status may be true only when open rows, artifacts, cycle status, and audit issues all permit it",
      result:
        completionEvidencePresent ===
        (openRows.length === 0 && allCompletionArtifactsPresent && shortTermDone)
          ? "pass"
          : "fail",
    },
    {
      path: "scripts/audit-construction-completion.mjs",
      requirement: "audit issues must keep completion status blocked",
      result: baseIssueCount > 0 && completionEvidencePresent ? "fail" : "pass",
    },
  ];
}

function parsePackageJson(content, relativePath) {
  try {
    return JSON.parse(content);
  } catch (error) {
    issues.push(`${relativePath}: invalid JSON (${error.message})`);
    return undefined;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNodeErrorWithCode(error, code) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
