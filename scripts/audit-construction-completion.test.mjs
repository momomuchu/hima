import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const script = "scripts/audit-construction-completion.mjs";
const fixtureRoot = path.resolve(`.tmp-audit-construction-completion-${process.pid}`);

const currentResult = spawnSync(process.execPath, [script, "--json"], {
  cwd: process.cwd(),
  encoding: "utf8",
});

assert.equal(currentResult.status, 0, currentResult.stderr);

const audit = JSON.parse(currentResult.stdout);
assert.equal(audit.status, "not_complete");
assert.deepEqual(audit.issues, []);
assert.deepEqual(audit.ledger, { done: 119, total: 155, open: 36, percent: 76.8 });
assert.equal(audit.cycle.id, "cycle-96-external-authorization-required");
assert.equal(audit.cycle.status, "BLOCKED");
assert.equal(audit.cycle.cycle96Blocked, true);
assert.equal(audit.promptToArtifactChecklist.length, 35);
assert.equal(
  audit.promptToArtifactChecklist.some(
    (entry) =>
      entry.requirement ===
      "No stale completion, ledger-advance, progress-percentage, open-row-count, open-row-closure, completion-artifact, macOS-install-completion, adapter-e2e-completion, adapter-production-readiness, adapter-hook/behavior-proof, unsupported/degraded-hook-upgrade, five-client-compatibility, manual-ci-h3-workflow-success, partial-h3-promotion, release-tag-notes, global-install-success, registry-lookup/test-transaction, visibility-flip/launch-snapshot-capture, beta-participation/survey-result, founding-cohort-sales, launch-post-link, book-skill-real-install, harvested-skill-real-install/invocation, runtime-suite/parity/critic, runtime-preflight-allowed, self-test-external-runtime-launch, benchmark-dry-run-unblocked, siem-external-transmission, user-home-dry-run-write, user-home-backup-restore-complete, release/payment/beta, runtime/user-home/benchmark/SIEM, fresh-machine-init, legal/market/revenue, authorization-granted, authorization-packet-execution-ready, blocker-resolved, cycle-unblocked, external-evidence-present, closure-ready, require-complete-success, goal-achieved, test-green-proxy-completion, audit-issues-empty-proxy-completion, row-mapping-proxy-completion, coverage-completeness-proxy-completion, blocker-list-proxy-completion, falsifies-if-proxy-completion, artifact-absence-proxy-completion, status-blocker-proxy-completion, done-criteria-proxy-completion, proxy-evidence, rescope-status, or audit-count claims",
  ),
  true,
);
assert.deepEqual(
  audit.promptToArtifactChecklist.find(
    (entry) => entry.requirement === "Aggregate audit issue list remains empty",
  ),
  {
    requirement: "Aggregate audit issue list remains empty",
    evidence: "0 audit issues",
    result: "pass",
  },
);
assert.equal(audit.openRows.length, 36);
assert.equal(audit.openRowChecklist.length, 36);
assert.equal(audit.coverageFamilyCounts.length, 13);
assert.equal(audit.coverageAuditSurfaceChecks.length, 5);
assert.equal(audit.coverageVerdictBoundaryChecks.length, 13);
assert.equal(audit.nonRowExternalMentionChecks.length, 12);
assert.equal(audit.gateWiringChecks.length, 12);
assert.equal(audit.blockedStateGuardChecks.length, 11);
assert.equal(audit.artifactSurfaceChecks.length, 21);
assert.equal(audit.coverageSurfacePathChecks.length, 12);
assert.equal(audit.artifactTermChecks.length, 49);
assert.equal(audit.partialH3EvidenceChecks.length, 6);
assert.equal(audit.staleClaimChecks.length, 325);
assert.equal(audit.nextAllowedBranchChecks.length, 16);
assert.equal(audit.archiveDeliveredArtifactChecks.length, 10);
assert.equal(audit.archiveNonGoalChecks.length, 10);
assert.equal(audit.archiveBlockerChecks.length, 6);
assert.equal(audit.archiveVerificationEvidenceChecks.length, 13);
assert.equal(audit.shortTermDoneCriteriaChecks.length, 3);
assert.equal(audit.shortTermBlockerSummaryChecks.length, 9);
assert.equal(audit.falsifiesFieldChecks.length, 76);
assert.equal(audit.runtimeFalsifiesGateChecks.length, 13);
assert.equal(audit.externalBlockerListChecks.length, 7);
assert.equal(audit.openRowExternalBlockerChecks.length, 36);
assert.equal(audit.completionArtifactAbsenceChecks.length, 5);
assert.equal(audit.statusBlockerChecks.length, 5);
assert.equal(
  audit.openRowChecklist.every((entry) => entry.result === "blocked"),
  true,
);
assert.equal(
  audit.coverageFamilyCounts.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.coverageAuditSurfaceChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.coverageVerdictBoundaryChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.nonRowExternalMentionChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.gateWiringChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.blockedStateGuardChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.artifactSurfaceChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.coverageSurfacePathChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.artifactTermChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.partialH3EvidenceChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.staleClaimChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.nextAllowedBranchChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.archiveDeliveredArtifactChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.archiveNonGoalChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.archiveBlockerChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.archiveVerificationEvidenceChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.shortTermDoneCriteriaChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.shortTermBlockerSummaryChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.falsifiesFieldChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.runtimeFalsifiesGateChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.externalBlockerListChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.openRowExternalBlockerChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.completionArtifactAbsenceChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.equal(
  audit.statusBlockerChecks.every((entry) => entry.result === "pass"),
  true,
);
assert.deepEqual(audit.externalBlockers, [
  "real macOS or authorized CI H3 transcript",
  "real Claude/Codex/Hermes runtime-model sessions",
  "real user-home ~/.hima install and restore evidence",
  "benchmark, stress, and external SIEM execution evidence",
  "closed-beta user evidence and saturation survey",
  "public GitHub/npm/release/payment/launch artifacts",
]);
assert.deepEqual(
  audit.completionArtifactAbsenceChecks.map((entry) => entry.path),
  [
    "docs/goals/evidence/h3-install-macos.md",
    "docs/goals/archive/v1.0-LAUNCH-2026-08-01.md",
    "packages/adapter-claude/test/e2e.test.ts",
    "packages/adapter-codex/test/e2e.test.ts",
    "packages/adapter-hermes/test/e2e.test.ts",
  ],
);
assert.deepEqual(
  [...new Set(audit.openRowChecklist.map((entry) => entry.coverageFamily))].sort(),
  [
    "Adapter real E2E",
    "Book-skill real installs",
    "Closed beta",
    "Compliance/SIEM",
    "Final Stream F critic",
    "H3 OS install matrix",
    "Harvested-skill original rows",
    "Launch snapshot",
    "Public release",
    "Runtime suite and parity",
    "SWE-bench benchmark",
    "Sale page, payment, launch posts",
    "Stress/concurrency",
  ].sort(),
);
assert.deepEqual(
  [...new Set(audit.openRowExternalBlockerChecks.map((entry) => entry.externalBlocker))].sort(),
  [...audit.externalBlockers].sort(),
);
assert.deepEqual(
  [...new Set(audit.coverageSurfacePathChecks.map((entry) => entry.path))].sort(),
  [
    "docs/goals/adapter-e2e-authorization-blocker-review.md",
    "docs/goals/beta-release-authorization-packet.md",
    "docs/goals/h3-macos-authorization-packet.md",
    "docs/goals/real-user-home-install-authorization-prep.md",
    "docs/goals/runtime-evidence-authorization-prep.md",
    "docs/goals/stress-siem-authorization-packet.md",
  ].sort(),
);
assert.deepEqual(audit.openRowIdentity, {
  expected: 36,
  actual: 36,
  missingExpected: [],
  unexpected: [],
});
assert.match(audit.externalBlockers.join("\n"), /real macOS/);

const requireCompleteResult = spawnSync(process.execPath, [script, "--require-complete"], {
  cwd: process.cwd(),
  encoding: "utf8",
});

assert.equal(requireCompleteResult.status, 1);
assert.match(requireCompleteResult.stderr, /not complete/);

await mkdir(path.join(fixtureRoot, "docs/goals"), { recursive: true });

try {
  for (const file of [
    "package.json",
    "scripts/run-tests.mjs",
    "scripts/guard-construction-blocked-state.mjs",
    "packages/core/src/gates/evaluate-gate.ts",
    "packages/core/test/gates.test.ts",
    "packages/core/test/handle-hook.test.ts",
    "docs/business-model/claims-register.csv",
    "docs/business-model/message-hierarchy.md",
    "docs/goals/COMPLETE-CONSTRUCTION-GOAL.md",
    "docs/goals/SHORT-TERM-GOAL.md",
    "docs/goals/external-authorization-packet-coverage-audit.md",
    "docs/goals/h3-macos-authorization-packet.md",
    "docs/goals/beta-release-authorization-packet.md",
    "docs/goals/stress-siem-authorization-packet.md",
    "docs/goals/runtime-evidence-authorization-prep.md",
    "docs/goals/adapter-e2e-authorization-blocker-review.md",
    "docs/goals/real-user-home-install-authorization-prep.md",
    "docs/goals/master-goal-rescope-decision-packet.md",
    "docs/goals/evidence/h3-install-linux.md",
    "docs/goals/evidence/h3-install-windows.md",
    "docs/goals/archive/cycle-96-BLOCKED-2026-05-15.md",
  ]) {
    await mkdir(path.dirname(path.join(fixtureRoot, file)), { recursive: true });
    await cp(path.resolve(file), path.join(fixtureRoot, file));
  }

  const completeGoalPath = path.join(fixtureRoot, "docs/goals/COMPLETE-CONSTRUCTION-GOAL.md");
  const completeGoal = await readFile(completeGoalPath, "utf8");
  await writeFile(
    completeGoalPath,
    completeGoal.replace(
      "- [ ] H3 install tested on Linux + macOS + Windows",
      "- [ ] FAKE local proxy completion row",
    ),
    "utf8",
  );

  const rowDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot, "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(rowDriftResult.status, 1);
  assert.match(rowDriftResult.stderr, /expected unchecked row is missing/);
  assert.match(rowDriftResult.stderr, /unexpected unchecked row/);

  const rowDriftAudit = JSON.parse(rowDriftResult.stdout);
  assert.equal(
    rowDriftAudit.promptToArtifactChecklist.some(
      (entry) =>
        entry.requirement === "Aggregate audit issue list remains empty" &&
        entry.result === "fail" &&
        /^[1-9]\d* audit issues$/u.test(entry.evidence),
    ),
    true,
  );
  assert.equal(rowDriftAudit.openRowIdentity.missingExpected.length, 1);
  assert.equal(rowDriftAudit.openRowIdentity.unexpected.length, 1);
  assert.equal(
    rowDriftAudit.openRowChecklist.some(
      (entry) => entry.requirement === "FAKE local proxy completion row" && entry.result === "fail",
    ),
    true,
  );
  assert.equal(
    rowDriftAudit.openRowExternalBlockerChecks.some(
      (entry) =>
        entry.row === "FAKE local proxy completion row" &&
        entry.externalBlocker === "unmapped external blocker" &&
        entry.result === "fail",
    ),
    true,
  );

  await writeFile(completeGoalPath, completeGoal, "utf8");
  await mkdir(path.join(fixtureRoot, "docs/goals/evidence"), { recursive: true });
  await writeFile(
    path.join(fixtureRoot, "docs/goals/evidence/h3-install-macos.md"),
    "# Fake macOS transcript\n",
    "utf8",
  );

  const fakeEvidenceResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot, "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(fakeEvidenceResult.status, 1);
  assert.match(fakeEvidenceResult.stderr, /h3-install-macos\.md: must be absent/);
  const fakeEvidenceAudit = JSON.parse(fakeEvidenceResult.stdout);
  assert.equal(
    fakeEvidenceAudit.completionArtifactAbsenceChecks.some(
      (entry) =>
        entry.path === "docs/goals/evidence/h3-install-macos.md" && entry.result === "fail",
    ),
    true,
  );

  await rm(path.join(fixtureRoot, "docs/goals/evidence/h3-install-macos.md"));
  await mkdir(path.join(fixtureRoot, "docs/goals/archive"), { recursive: true });
  await writeFile(
    path.join(fixtureRoot, "docs/goals/archive/v1.0-LAUNCH-2026-08-01.md"),
    "# Fake launch snapshot\n",
    "utf8",
  );

  const fakeLaunchResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(fakeLaunchResult.status, 1);
  assert.match(fakeLaunchResult.stderr, /v1\.0-LAUNCH-2026-08-01\.md: must be absent/);

  for (const fakeE2ePath of [
    "packages/adapter-claude/test/e2e.test.ts",
    "packages/adapter-codex/test/e2e.test.ts",
    "packages/adapter-hermes/test/e2e.test.ts",
  ]) {
    await rm(path.join(fixtureRoot, "docs/goals/archive/v1.0-LAUNCH-2026-08-01.md"), {
      force: true,
    });
    await mkdir(path.dirname(path.join(fixtureRoot, fakeE2ePath)), { recursive: true });
    await writeFile(
      path.join(fixtureRoot, fakeE2ePath),
      "test('fake e2e placeholder', () => {});\n",
      "utf8",
    );

    const fakeE2eResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    assert.equal(fakeE2eResult.status, 1);
    assert.match(fakeE2eResult.stderr, new RegExp(`${escapeRegExp(fakeE2ePath)}: must be absent`));
    await rm(path.join(fixtureRoot, fakeE2ePath));
  }

  const coverageAuditPath = path.join(
    fixtureRoot,
    "docs/goals/external-authorization-packet-coverage-audit.md",
  );
  const coverageAudit = await readFile(coverageAuditPath, "utf8");
  await writeFile(
    coverageAuditPath,
    coverageAudit
      .replace("| Adapter real E2E | 3 |", "| Adapter real E2E | 2 |")
      .replace("| Runtime suite and parity | 2 |", "| Runtime suite and parity | 3 |"),
    "utf8",
  );

  const familyDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot, "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(familyDriftResult.status, 1);
  assert.match(familyDriftResult.stderr, /Adapter real E2E declares 2 rows but actual/);
  assert.match(familyDriftResult.stderr, /Runtime suite and parity declares 3 rows but actual/);

  const familyDriftAudit = JSON.parse(familyDriftResult.stdout);
  assert.equal(familyDriftAudit.ledger.open, 36);
  assert.equal(
    familyDriftAudit.coverageFamilyCounts.filter((entry) => entry.result === "fail").length,
    2,
  );

  await writeFile(coverageAuditPath, coverageAudit, "utf8");

  await writeFile(
    coverageAuditPath,
    coverageAudit.replace(
      "They are not\nindependent open checklist rows in the current master ledger.",
      "They are\nindependent open checklist rows in the current master ledger.",
    ),
    "utf8",
  );

  const nonRowBoundaryDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot, "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(nonRowBoundaryDriftResult.status, 1);
  assert.match(nonRowBoundaryDriftResult.stderr, /outside independent open checklist rows/);
  const nonRowBoundaryDriftAudit = JSON.parse(nonRowBoundaryDriftResult.stdout);
  assert.equal(
    nonRowBoundaryDriftAudit.nonRowExternalMentionChecks.some(
      (entry) =>
        entry.requirement ===
          "non-row mentions must remain outside independent open checklist rows" &&
        entry.result === "fail",
    ),
    true,
  );

  await writeFile(coverageAuditPath, coverageAudit, "utf8");

  await writeFile(
    coverageAuditPath,
    coverageAudit.replace(
      "Covered for runtime/model authorization, target prerequisites, transcript retention, and preflight shape; not executed.",
      "Covered for runtime/model authorization, target prerequisites, transcript retention, and preflight shape; executed.",
    ),
    "utf8",
  );

  const coverageVerdictDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot, "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(coverageVerdictDriftResult.status, 1);
  assert.match(coverageVerdictDriftResult.stderr, /coverage verdict must preserve/);
  const coverageVerdictDriftAudit = JSON.parse(coverageVerdictDriftResult.stdout);
  assert.equal(
    coverageVerdictDriftAudit.coverageVerdictBoundaryChecks.some(
      (entry) => entry.family === "Runtime suite and parity" && entry.result === "fail",
    ),
    true,
  );

  await writeFile(coverageAuditPath, coverageAudit, "utf8");

  await writeFile(
    coverageAuditPath,
    coverageAudit.replace(
      "`docs/goals/runtime-evidence-authorization-prep.md`",
      "`docs/goals/missing-runtime-authorization-prep.md`",
    ),
    "utf8",
  );

  const missingSurfaceResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(missingSurfaceResult.status, 1);
  assert.match(missingSurfaceResult.stderr, /referenced surface must exist/);
  assert.match(missingSurfaceResult.stderr, /referenced surface must be guarded/);

  await writeFile(coverageAuditPath, coverageAudit, "utf8");

  await writeFile(
    coverageAuditPath,
    coverageAudit.replace(
      "does not authorize execution, does not create external evidence,\ndoes not close any row",
      "authorizes execution, creates external evidence,\nand closes a row",
    ),
    "utf8",
  );

  const coverageBoundaryDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(coverageBoundaryDriftResult.status, 1);
  assert.match(coverageBoundaryDriftResult.stderr, /non-authorization boundary/);

  await writeFile(coverageAuditPath, coverageAudit, "utf8");
  await writeFile(
    coverageAuditPath,
    coverageAudit.replace(
      "evidence-anchor: docs/goals/external-authorization-packet-coverage-audit.md",
      "evidence-anchor: docs/goals/missing-falsifies-anchor.md",
    ),
    "utf8",
  );

  const falsifiesAnchorDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot, "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(falsifiesAnchorDriftResult.status, 1);
  assert.match(falsifiesAnchorDriftResult.stderr, /evidence-anchor must resolve/);
  const falsifiesAnchorDriftAudit = JSON.parse(falsifiesAnchorDriftResult.stdout);
  assert.equal(
    falsifiesAnchorDriftAudit.falsifiesFieldChecks.some(
      (entry) =>
        entry.path === "docs/goals/external-authorization-packet-coverage-audit.md" &&
        entry.requirement === "Falsifies-If block evidence-anchor must resolve" &&
        entry.result === "fail",
    ),
    true,
  );

  await writeFile(coverageAuditPath, coverageAudit, "utf8");

  const packageJsonPath = path.join(fixtureRoot, "package.json");
  const packageJson = await readFile(packageJsonPath, "utf8");
  await writeFile(
    packageJsonPath,
    packageJson.replace(" && node scripts/audit-construction-completion.mjs", ""),
    "utf8",
  );

  const lintWiringDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(lintWiringDriftResult.status, 1);
  assert.match(lintWiringDriftResult.stderr, /lint script must run audit-construction/);

  await writeFile(packageJsonPath, packageJson, "utf8");

  const runTestsPath = path.join(fixtureRoot, "scripts/run-tests.mjs");
  const runTests = await readFile(runTestsPath, "utf8");
  await writeFile(
    runTestsPath,
    runTests.replace('  ["node", ["scripts/audit-construction-completion.test.mjs"]],\n', ""),
    "utf8",
  );

  const testWiringDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(testWiringDriftResult.status, 1);
  assert.match(
    testWiringDriftResult.stderr,
    /test runner must execute audit-construction-completion\.test\.mjs/,
  );

  await writeFile(runTestsPath, runTests, "utf8");

  const blockedStateGuardPath = path.join(
    fixtureRoot,
    "scripts/guard-construction-blocked-state.mjs",
  );
  const blockedStateGuard = await readFile(blockedStateGuardPath, "utf8");
  await writeFile(
    blockedStateGuardPath,
    blockedStateGuard.replaceAll(
      "docs/goals/master-goal-rescope-decision-packet.md",
      "docs/goals/removed-rescope-packet.md",
    ),
    "utf8",
  );

  const blockedGuardDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot, "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(blockedGuardDriftResult.status, 1);
  assert.match(blockedGuardDriftResult.stderr, /must read the master-goal rescope packet/);
  const blockedGuardDriftAudit = JSON.parse(blockedGuardDriftResult.stdout);
  assert.equal(
    blockedGuardDriftAudit.blockedStateGuardChecks.some(
      (entry) =>
        entry.requirement === "blocked-state guard must read the master-goal rescope packet" &&
        entry.result === "fail",
    ),
    true,
  );

  await writeFile(blockedStateGuardPath, blockedStateGuard, "utf8");
  await writeFile(
    blockedStateGuardPath,
    blockedStateGuard.replace(
      "synthetic completion-with-issues drift",
      "synthetic completion drift",
    ),
    "utf8",
  );

  const blockedGuardAuditIssueTermDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot, "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(blockedGuardAuditIssueTermDriftResult.status, 1);
  assert.match(
    blockedGuardAuditIssueTermDriftResult.stderr,
    /must preserve archived audit-issues and stale-count terms/,
  );
  const blockedGuardAuditIssueTermDriftAudit = JSON.parse(
    blockedGuardAuditIssueTermDriftResult.stdout,
  );
  assert.equal(
    blockedGuardAuditIssueTermDriftAudit.blockedStateGuardChecks.some(
      (entry) =>
        entry.requirement ===
          "blocked-state guard must preserve archived audit-issues and stale-count terms" &&
        entry.result === "fail",
    ),
    true,
  );

  await writeFile(blockedStateGuardPath, blockedStateGuard, "utf8");
  await writeFile(
    blockedStateGuardPath,
    blockedStateGuard.replace(
      "authorization-packet execution-ready drift",
      "authorization packet ready drift",
    ),
    "utf8",
  );

  const blockedGuardAuthorizationPacketTermDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot, "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(blockedGuardAuthorizationPacketTermDriftResult.status, 1);
  assert.match(
    blockedGuardAuthorizationPacketTermDriftResult.stderr,
    /must preserve archived authorization-packet drift term/,
  );
  const blockedGuardAuthorizationPacketTermDriftAudit = JSON.parse(
    blockedGuardAuthorizationPacketTermDriftResult.stdout,
  );
  assert.equal(
    blockedGuardAuthorizationPacketTermDriftAudit.blockedStateGuardChecks.some(
      (entry) =>
        entry.requirement ===
          "blocked-state guard must preserve archived authorization-packet drift term" &&
        entry.result === "fail",
    ),
    true,
  );

  await writeFile(blockedStateGuardPath, blockedStateGuard, "utf8");

  const h3PacketPath = path.join(fixtureRoot, "docs/goals/h3-macos-authorization-packet.md");
  const h3Packet = await readFile(h3PacketPath, "utf8");
  await writeFile(
    h3PacketPath,
    h3Packet.replace(/^status:\s*BLOCKED_AUTHORIZATION_PACKET$/mu, "status: COMPLETE"),
    "utf8",
  );

  const surfaceStatusDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(surfaceStatusDriftResult.status, 1);
  assert.match(surfaceStatusDriftResult.stderr, /status must be BLOCKED_AUTHORIZATION_PACKET/);

  await writeFile(
    h3PacketPath,
    h3Packet.replace(
      "It is not authorization, not macOS evidence, and not a substitute for",
      "It is approved execution proof and a substitute for",
    ),
    "utf8",
  );

  const surfaceBoundaryDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(surfaceBoundaryDriftResult.status, 1);
  assert.match(
    surfaceBoundaryDriftResult.stderr,
    /must preserve non-authorization\/non-evidence boundary/,
  );

  await writeFile(
    h3PacketPath,
    h3Packet.replace("Authorized Route B: Manual GitHub Actions CI", "Authorized Route B: Removed"),
    "utf8",
  );

  const artifactTermDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(artifactTermDriftResult.status, 1);
  assert.match(artifactTermDriftResult.stderr, /must include required term/);

  await writeFile(h3PacketPath, h3Packet, "utf8");

  const rescopePacketPath = path.join(
    fixtureRoot,
    "docs/goals/master-goal-rescope-decision-packet.md",
  );
  const rescopePacket = await readFile(rescopePacketPath, "utf8");
  await writeFile(
    rescopePacketPath,
    rescopePacket.replace(
      "It is not a rescope\ndecision, not authorization, not external evidence",
      "It is an approved rescope decision and completion evidence",
    ),
    "utf8",
  );

  const rescopeBoundaryDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(rescopeBoundaryDriftResult.status, 1);
  assert.match(
    rescopeBoundaryDriftResult.stderr,
    /master-goal-rescope-decision-packet\.md: must preserve non-authorization\/non-evidence boundary/,
  );

  await writeFile(rescopePacketPath, rescopePacket, "utf8");

  const linuxTranscriptPath = path.join(fixtureRoot, "docs/goals/evidence/h3-install-linux.md");
  const linuxTranscript = await readFile(linuxTranscriptPath, "utf8");
  await writeFile(
    linuxTranscriptPath,
    linuxTranscript.replace("| Failure count | 0 |", "| Failure count | 1 |"),
    "utf8",
  );

  const h3TranscriptDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(h3TranscriptDriftResult.status, 1);
  assert.match(h3TranscriptDriftResult.stderr, /missing zero-failure H3 transcript summary/);

  await writeFile(linuxTranscriptPath, linuxTranscript, "utf8");

  const shortTermPath = path.join(fixtureRoot, "docs/goals/SHORT-TERM-GOAL.md");
  const shortTerm = await readFile(shortTermPath, "utf8");
  await writeFile(
    shortTermPath,
    shortTerm.replace("ledger remains 119/155", "ledger is now 121/155"),
    "utf8",
  );

  const staleClaimDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(staleClaimDriftResult.status, 1);
  assert.match(staleClaimDriftResult.stderr, /must not claim ledger progress above 119\/155/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\nConstruction progress is now 77.0%\n`, "utf8");

  const stalePercentDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(stalePercentDriftResult.status, 1);
  assert.match(stalePercentDriftResult.stderr, /must not claim construction progress above 76\.8%/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\nCycle 96 has 35 open rows\n`, "utf8");

  const staleOpenRowCountDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleOpenRowCountDriftResult.status, 1);
  assert.match(
    staleOpenRowCountDriftResult.stderr,
    /must not claim current open-row count below 36/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\ndocs/goals/evidence/h3-install-macos.md exists\n`,
    "utf8",
  );

  const staleMacosArtifactClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleMacosArtifactClaimResult.status, 1);
  assert.match(
    staleMacosArtifactClaimResult.stderr,
    /must not claim the macOS transcript artifact exists/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\nmacOS install test has been passed\n`, "utf8");

  const staleMacosInstallCompletionClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleMacosInstallCompletionClaimResult.status, 1);
  assert.match(
    staleMacosInstallCompletionClaimResult.stderr,
    /must not claim macOS install proof is complete/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nmanual CI workflow has been executed successfully\n`,
    "utf8",
  );

  const staleManualCiH3WorkflowClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleManualCiH3WorkflowClaimResult.status, 1);
  assert.match(
    staleManualCiH3WorkflowClaimResult.stderr,
    /must not claim manual CI H3 workflow success/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nLinux and Windows transcripts satisfy H3\n`,
    "utf8",
  );

  const stalePartialH3PromotionClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(stalePartialH3PromotionClaimResult.status, 1);
  assert.match(
    stalePartialH3PromotionClaimResult.stderr,
    /must not claim partial Linux\/Windows H3 evidence satisfies H3/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\npackages/adapter-claude/test/e2e.test.ts passes\n`,
    "utf8",
  );

  const staleAdapterE2eArtifactClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleAdapterE2eArtifactClaimResult.status, 1);
  assert.match(
    staleAdapterE2eArtifactClaimResult.stderr,
    /must not claim adapter E2E artifacts exist or pass/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\nadapter E2E has passed\n`, "utf8");

  const staleAdapterE2eCompletionClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleAdapterE2eCompletionClaimResult.status, 1);
  assert.match(
    staleAdapterE2eCompletionClaimResult.stderr,
    /must not claim adapter E2E completion/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\n3 adapters are now production-ready\n`, "utf8");

  const staleAdapterProductionReadinessClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleAdapterProductionReadinessClaimResult.status, 1);
  assert.match(
    staleAdapterProductionReadinessClaimResult.stderr,
    /must not claim adapter production readiness/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nadapter hook firing proof has been captured\n`,
    "utf8",
  );

  const staleAdapterHookProofClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleAdapterHookProofClaimResult.status, 1);
  assert.match(
    staleAdapterHookProofClaimResult.stderr,
    /must not claim adapter hook firing or behavior proof/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nunsupported hooks are now production-blocking controls\n`,
    "utf8",
  );

  const staleUnsupportedHookUpgradeClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleUnsupportedHookUpgradeClaimResult.status, 1);
  assert.match(
    staleUnsupportedHookUpgradeClaimResult.stderr,
    /must not claim unsupported or degraded adapter hooks are blocking controls/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\nfive-client compatibility is complete\n`, "utf8");

  const staleFiveClientCompatibilityClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleFiveClientCompatibilityClaimResult.status, 1);
  assert.match(
    staleFiveClientCompatibilityClaimResult.stderr,
    /must not claim five-client compatibility is complete/,
  );

  const releaseClaimFixtures = [
    {
      claim: "GitHub repository is public",
      expected: /must not claim the GitHub repository is public or released/,
    },
    {
      claim: "GitHub repository visibility has been flipped to public",
      expected: /must not claim GitHub repository visibility was flipped public/,
    },
    {
      claim: "v1.0.0 tag has been created",
      expected: /must not claim v1 release tag or notes are published/,
    },
    {
      claim: "@hima/cli is published",
      expected: /must not claim npm publication is complete/,
    },
    {
      claim: "npm registry lookup has returned the @hima/cli package",
      expected: /must not claim npm registry lookup returns the package/,
    },
    {
      claim: "npm install -g @hima/cli now works",
      expected: /must not claim global npm install works/,
    },
    {
      claim: "sale page is live",
      expected: /must not claim sale page or Stripe payment is live/,
    },
    {
      claim: "sale page has accepted a real Stripe test transaction",
      expected: /must not claim sale page accepted a real test transaction/,
    },
    {
      claim: "1000 licenses have been sold",
      expected: /must not claim founding-cohort sales or cap reached/,
    },
    {
      claim: "closed beta is complete",
      expected: /must not claim closed beta or saturation survey is complete/,
    },
    {
      claim: "10 beta users have been recruited and completed the scenarios",
      expected: /must not claim beta users participated or completed scenarios/,
    },
    {
      claim: "beta survey has reported six users completed all 3 scenarios and would pay $249",
      expected: /must not claim beta survey results met scenario or pay-intent criteria/,
    },
    {
      claim: "Show HN and dev.to are posted",
      expected: /must not claim launch posts are published/,
    },
    {
      claim: "Show HN link has been captured",
      expected: /must not claim launch-post links were captured/,
    },
  ];

  for (const fixture of releaseClaimFixtures) {
    await writeFile(shortTermPath, `${shortTerm}\n${fixture.claim}\n`, "utf8");

    const staleReleaseClaimResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    assert.equal(staleReleaseClaimResult.status, 1);
    assert.match(staleReleaseClaimResult.stderr, fixture.expected);
  }

  const executionClaimFixtures = [
    {
      claim: "Claude Code session has been executed",
      expected: /must not claim runtime\/model sessions executed/,
    },
    {
      claim: "Cross-runtime parity test harness is now green",
      expected: /must not claim runtime suite, parity, or final critic completion/,
    },
    {
      claim: "runtime parity preflight reports executionAllowed: true",
      expected: /must not claim runtime preflight allows execution/,
    },
    {
      claim: "harness self-test reports externalRuntimeSessionsLaunched: true",
      expected: /must not claim self-test launched external runtime sessions/,
    },
    {
      claim: "benchmark dry-run status is now ready",
      expected: /must not claim benchmark dry-run is unblocked/,
    },
    {
      claim: "real ~/.hima has been installed",
      expected: /must not claim real user-home install is complete/,
    },
    {
      claim: "real ~/.hima dry-run wrote files",
      expected: /must not claim real user-home dry-run wrote files/,
    },
    {
      claim: "real ~/.hima backup and restore proof is complete",
      expected: /must not claim real user-home backup or restore proof is complete/,
    },
    {
      claim: "00-idea-pmf skills have been installed under ~/.hima",
      expected: /must not claim book skills are installed in real user-home/,
    },
    {
      claim: "HARV-01 ai-slop-cleaner has been installed under ~/.hima",
      expected: /must not claim harvested skills are installed or invoked in real sessions/,
    },
    {
      claim: "SWE-bench has been executed",
      expected: /must not claim SWE-bench or benchmark execution is complete/,
    },
    {
      claim: "stress test has been completed",
      expected: /must not claim stress execution is complete/,
    },
    {
      claim: "external SIEM has been ingested",
      expected: /must not claim external SIEM ingest is complete/,
    },
    {
      claim: "siem fixture reports externalTransmissions: true",
      expected: /must not claim SIEM fixture transmitted externally/,
    },
    {
      claim: "external harness init run has been completed successfully",
      expected: /must not claim fresh-machine external harness init is complete/,
    },
  ];

  for (const fixture of executionClaimFixtures) {
    await writeFile(shortTermPath, `${shortTerm}\n${fixture.claim}\n`, "utf8");

    const staleExecutionClaimResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    assert.equal(staleExecutionClaimResult.status, 1);
    assert.match(staleExecutionClaimResult.stderr, fixture.expected);
  }

  await writeFile(shortTermPath, `${shortTerm}\nrevenue has been validated\n`, "utf8");

  const staleBusinessClaimResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(staleBusinessClaimResult.status, 1);
  assert.match(
    staleBusinessClaimResult.stderr,
    /must not claim business\/legal\/market\/revenue proof is complete/,
  );

  await writeFile(shortTermPath, `${shortTerm}\nruntime authorization has been granted\n`, "utf8");

  const staleAuthorizationClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleAuthorizationClaimResult.status, 1);
  assert.match(
    staleAuthorizationClaimResult.stderr,
    /must not claim external authorization was granted/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\nauthorization packet is ready to execute the macOS run\n`,
    "utf8",
  );

  const staleAuthorizationPacketReadyClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleAuthorizationPacketReadyClaimResult.status, 1);
  assert.match(
    staleAuthorizationPacketReadyClaimResult.stderr,
    /must not claim authorization packets are execution-ready/,
  );

  await writeFile(shortTermPath, `${shortTerm}\nexternal blockers have been resolved\n`, "utf8");

  const staleBlockerResolutionClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleBlockerResolutionClaimResult.status, 1);
  assert.match(
    staleBlockerResolutionClaimResult.stderr,
    /must not claim external blockers were resolved/,
  );

  await writeFile(shortTermPath, `${shortTerm}\nCycle 96 is now unblocked\n`, "utf8");

  const staleCycleUnblockedClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleCycleUnblockedClaimResult.status, 1);
  assert.match(staleCycleUnblockedClaimResult.stderr, /must not claim Cycle 96 is unblocked/);

  await writeFile(shortTermPath, `${shortTerm}\nexternal evidence has been collected\n`, "utf8");

  const staleExternalEvidenceClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleExternalEvidenceClaimResult.status, 1);
  assert.match(
    staleExternalEvidenceClaimResult.stderr,
    /must not claim external evidence is present/,
  );

  await writeFile(shortTermPath, `${shortTerm}\nCycle 96 is ready to close\n`, "utf8");

  const staleClosureReadyClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleClosureReadyClaimResult.status, 1);
  assert.match(staleClosureReadyClaimResult.stderr, /must not claim Cycle 96 is ready to close/);

  await writeFile(
    shortTermPath,
    `${shortTerm}\nnode scripts/audit-construction-completion.mjs --require-complete exited 0\n`,
    "utf8",
  );

  const staleRequireCompleteSuccessClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleRequireCompleteSuccessClaimResult.status, 1);
  assert.match(
    staleRequireCompleteSuccessClaimResult.stderr,
    /must not claim require-complete succeeded/,
  );

  await writeFile(shortTermPath, `${shortTerm}\nconstruction goal has been achieved\n`, "utf8");

  const staleGoalAchievedClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleGoalAchievedClaimResult.status, 1);
  assert.match(
    staleGoalAchievedClaimResult.stderr,
    /must not claim construction goal was achieved/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\nroot tests pass proves construction goal complete\n`,
    "utf8",
  );

  const staleGreenTestsProxyClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleGreenTestsProxyClaimResult.status, 1);
  assert.match(
    staleGreenTestsProxyClaimResult.stderr,
    /must not claim green local tests prove construction completion/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\naudit issues are empty proves construction goal complete\n`,
    "utf8",
  );

  const staleEmptyAuditIssuesProxyClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleEmptyAuditIssuesProxyClaimResult.status, 1);
  assert.match(
    staleEmptyAuditIssuesProxyClaimResult.stderr,
    /must not claim empty audit issues prove construction completion/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\n36/36 row-to-external-blocker mappings prove construction goal complete\n`,
    "utf8",
  );

  const staleRowMappingProxyClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleRowMappingProxyClaimResult.status, 1);
  assert.match(
    staleRowMappingProxyClaimResult.stderr,
    /must not claim row mapping completeness proves construction completion/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\n36/36 open rows have packet/prep coverage proves construction goal complete\n`,
    "utf8",
  );

  const staleCoverageCompletenessProxyClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleCoverageCompletenessProxyClaimResult.status, 1);
  assert.match(
    staleCoverageCompletenessProxyClaimResult.stderr,
    /must not claim packet coverage completeness proves construction completion/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\nexternal blocker list exact proves construction goal complete\n`,
    "utf8",
  );

  const staleBlockerListProxyClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleBlockerListProxyClaimResult.status, 1);
  assert.match(
    staleBlockerListProxyClaimResult.stderr,
    /must not claim blocker-list exactness proves construction completion/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\nclaim-bearing Falsifies-If validation passes proves construction goal complete\n`,
    "utf8",
  );

  const staleFalsifiesIfProxyClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleFalsifiesIfProxyClaimResult.status, 1);
  assert.match(
    staleFalsifiesIfProxyClaimResult.stderr,
    /must not claim Falsifies-If validation proves construction completion/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\nrequired completion artifacts absent proves construction goal complete\n`,
    "utf8",
  );

  const staleArtifactAbsenceProxyClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleArtifactAbsenceProxyClaimResult.status, 1);
  assert.match(
    staleArtifactAbsenceProxyClaimResult.stderr,
    /must not claim completion-artifact absence proves construction completion/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\nstatus-blocker checks pass proves construction goal complete\n`,
    "utf8",
  );

  const staleStatusBlockerProxyClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleStatusBlockerProxyClaimResult.status, 1);
  assert.match(
    staleStatusBlockerProxyClaimResult.stderr,
    /must not claim status-blocker checks prove construction completion/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\nactive DONE criteria checks pass proves construction goal complete\n`,
    "utf8",
  );

  const staleDoneCriteriaProxyClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleDoneCriteriaProxyClaimResult.status, 1);
  assert.match(
    staleDoneCriteriaProxyClaimResult.stderr,
    /must not claim DONE-criteria checks prove construction completion/,
  );

  await writeFile(shortTermPath, `${shortTerm}\nlaunch snapshot has been captured\n`, "utf8");

  const staleLaunchSnapshotCaptureClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleLaunchSnapshotCaptureClaimResult.status, 1);
  assert.match(
    staleLaunchSnapshotCaptureClaimResult.stderr,
    /must not claim the launch snapshot was captured/,
  );

  await writeFile(shortTermPath, `${shortTerm}\nremaining open rows have been closed\n`, "utf8");

  const staleOpenRowClosureClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleOpenRowClosureClaimResult.status, 1);
  assert.match(staleOpenRowClosureClaimResult.stderr, /must not claim open rows were closed/);

  await writeFile(
    shortTermPath,
    `${shortTerm}\ncoverage audit proves external evidence completion\n`,
    "utf8",
  );

  const staleProxyEvidenceClaimResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleProxyEvidenceClaimResult.status, 1);
  assert.match(
    staleProxyEvidenceClaimResult.stderr,
    /must not claim local packet\/prep\/audit surfaces prove external completion/,
  );

  await writeFile(shortTermPath, `${shortTerm}\nmaster goal has been rescoped\n`, "utf8");

  const staleRescopeClaimResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(staleRescopeClaimResult.status, 1);
  assert.match(staleRescopeClaimResult.stderr, /must not claim master-goal rescope was enacted/);

  await writeFile(shortTermPath, shortTerm, "utf8");

  const runtimeInvariantGoalPath = path.join(
    fixtureRoot,
    "docs/goals/COMPLETE-CONSTRUCTION-GOAL.md",
  );
  const runtimeInvariantGoal = await readFile(runtimeInvariantGoalPath, "utf8");
  await writeFile(
    runtimeInvariantGoalPath,
    runtimeInvariantGoal.replace(
      "13 runtime Falsifies gate invariants",
      "11 runtime Falsifies gate invariants",
    ),
    "utf8",
  );

  const staleRuntimeInvariantDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleRuntimeInvariantDriftResult.status, 1);
  assert.match(
    staleRuntimeInvariantDriftResult.stderr,
    /must not reference stale 11 runtime Falsifies gate invariants/,
  );

  await writeFile(runtimeInvariantGoalPath, runtimeInvariantGoal, "utf8");

  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit now exposes 12 \`runtimeFalsifiesGateChecks\`\n`,
    "utf8",
  );

  const staleRuntimeFalsifiesFieldCountResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleRuntimeFalsifiesFieldCountResult.status, 1);
  assert.match(
    staleRuntimeFalsifiesFieldCountResult.stderr,
    /must not reference stale runtimeFalsifiesGateChecks field counts/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit reports 12/12 runtime gate checks pass\n`,
    "utf8",
  );

  const staleRuntimeGateRatioResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(staleRuntimeGateRatioResult.status, 1);
  assert.match(
    staleRuntimeGateRatioResult.stderr,
    /must not reference stale runtime gate check ratios/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit now exposes 75 \`falsifiesFieldChecks\`\n`,
    "utf8",
  );

  const staleFalsifiesFieldCountResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleFalsifiesFieldCountResult.status, 1);
  assert.match(
    staleFalsifiesFieldCountResult.stderr,
    /must not reference stale falsifiesFieldChecks field counts/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit reports 75/75 falsifies-field checks pass\n`,
    "utf8",
  );

  const staleFalsifiesFieldRatioResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleFalsifiesFieldRatioResult.status, 1);
  assert.match(
    staleFalsifiesFieldRatioResult.stderr,
    /must not reference stale falsifies-field check ratios/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit now exposes 48 \`artifactTermChecks\`\n`,
    "utf8",
  );

  const staleArtifactTermFieldCountResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleArtifactTermFieldCountResult.status, 1);
  assert.match(
    staleArtifactTermFieldCountResult.stderr,
    /must not reference stale artifactTermChecks field counts/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit reports 48/48 required-term checks pass\n`,
    "utf8",
  );

  const staleRequiredTermRatioResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleRequiredTermRatioResult.status, 1);
  assert.match(
    staleRequiredTermRatioResult.stderr,
    /must not reference stale required-term check ratios/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit now exposes 20 \`artifactSurfaceChecks\`\n`,
    "utf8",
  );

  const staleArtifactSurfaceFieldCountResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleArtifactSurfaceFieldCountResult.status, 1);
  assert.match(
    staleArtifactSurfaceFieldCountResult.stderr,
    /must not reference stale artifactSurfaceChecks field counts/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit reports 20/20 surface checks pass\n`,
    "utf8",
  );

  const staleSurfaceRatioResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(staleSurfaceRatioResult.status, 1);
  assert.match(staleSurfaceRatioResult.stderr, /must not reference stale surface check ratios/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit now exposes 11 \`coverageSurfacePathChecks\`\n`,
    "utf8",
  );

  const staleCoverageSurfacePathFieldCountResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleCoverageSurfacePathFieldCountResult.status, 1);
  assert.match(
    staleCoverageSurfacePathFieldCountResult.stderr,
    /must not reference stale coverageSurfacePathChecks field counts/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit reports 11/11 referenced surfaces pass\n`,
    "utf8",
  );

  const staleReferencedSurfaceRatioResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleReferencedSurfaceRatioResult.status, 1);
  assert.match(
    staleReferencedSurfaceRatioResult.stderr,
    /must not reference stale referenced-surface check ratios/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");

  await writeFile(
    shortTermPath,
    shortTerm.replace("11/11 blocked-state guard checks", "10/10 blocked-state guard checks"),
    "utf8",
  );

  const staleBlockedStateGuardCountDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleBlockedStateGuardCountDriftResult.status, 1);
  assert.match(
    staleBlockedStateGuardCountDriftResult.stderr,
    /must not reference stale 10\/10 blocked-state guard checks/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit now exposes 10 \`blockedStateGuardChecks\`\n`,
    "utf8",
  );

  const staleBlockedStateGuardFieldCountResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(staleBlockedStateGuardFieldCountResult.status, 1);
  assert.match(
    staleBlockedStateGuardFieldCountResult.stderr,
    /must not reference stale blockedStateGuardChecks field counts/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");

  const archivePath = path.join(fixtureRoot, "docs/goals/archive/cycle-96-BLOCKED-2026-05-15.md");
  const archive = await readFile(archivePath, "utf8");
  await writeFile(
    archivePath,
    archive.replace(
      "5. Beta/user contact is explicitly authorized with privacy and survey boundaries.",
      "5. Beta/user contact can be skipped locally.",
    ),
    "utf8",
  );

  const nextBranchDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(nextBranchDriftResult.status, 1);
  assert.match(nextBranchDriftResult.stderr, /must preserve next allowed branch/);

  await writeFile(archivePath, archive, "utf8");
  await writeFile(
    archivePath,
    archive.replace(
      "Preparation-only packet: `docs/goals/master-goal-rescope-decision-packet.md`.",
      "Preparation-only packet: removed.",
    ),
    "utf8",
  );

  const rescopePacketBranchDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(rescopePacketBranchDriftResult.status, 1);
  assert.match(rescopePacketBranchDriftResult.stderr, /master-goal-rescope-decision-packet/);

  await writeFile(archivePath, archive, "utf8");
  await writeFile(
    archivePath,
    archive.replace(
      "required authorization packet/prep/rescope terms",
      "required authorization packet/prep terms",
    ),
    "utf8",
  );

  const archiveDeliveredArtifactDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(archiveDeliveredArtifactDriftResult.status, 1);
  assert.match(
    archiveDeliveredArtifactDriftResult.stderr,
    /must preserve delivered-artifact summary/,
  );

  await writeFile(archivePath, archive, "utf8");
  await writeFile(
    archivePath,
    archive.replace(
      "launch Claude, Codex, Hermes, SWE-bench, or any model-backed session",
      "launch model-backed sessions after local packet coverage",
    ),
    "utf8",
  );

  const archiveNonGoalDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(archiveNonGoalDriftResult.status, 1);
  assert.match(archiveNonGoalDriftResult.stderr, /must preserve archived non-goal/);

  await writeFile(archivePath, archive, "utf8");
  await writeFile(
    archivePath,
    archive.replace(
      "H8 requires authorized external users, privacy/storage rules, survey records, and saturation summary.",
      "H8 can be inferred from local packet coverage.",
    ),
    "utf8",
  );

  const archiveBlockerDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(archiveBlockerDriftResult.status, 1);
  assert.match(archiveBlockerDriftResult.stderr, /must preserve archived blocker/);

  await writeFile(archivePath, archive, "utf8");
  await writeFile(
    archivePath,
    archive.replace("53 Vitest files / 702 tests", "local focused tests only"),
    "utf8",
  );

  const archiveVerificationEvidenceDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(archiveVerificationEvidenceDriftResult.status, 1);
  assert.match(
    archiveVerificationEvidenceDriftResult.stderr,
    /must preserve archived verification evidence/,
  );

  await writeFile(archivePath, archive, "utf8");
  await writeFile(
    shortTermPath,
    shortTerm.replace(
      "the corresponding real evidence is produced and\nverified",
      "the corresponding local packet coverage is reviewed and\naccepted",
    ),
    "utf8",
  );

  const doneCriteriaDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(doneCriteriaDriftResult.status, 1);
  assert.match(doneCriteriaDriftResult.stderr, /must preserve active DONE criterion/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    shortTerm.replace("beta users", "local beta packet review"),
    "utf8",
  );

  const blockerSummaryDriftResult = spawnSync(process.execPath, [script, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(blockerSummaryDriftResult.status, 1);
  assert.match(blockerSummaryDriftResult.stderr, /must preserve active blocked-rationale term/);

  await writeFile(shortTermPath, shortTerm, "utf8");

  await writeFile(completeGoalPath, completeGoal.replace(/^- \[ \]/gmu, "- [x]"), "utf8");
  await writeFile(
    shortTermPath,
    shortTerm.replace(/^status:\s*BLOCKED$/mu, "status: DONE"),
    "utf8",
  );

  const syntheticCompletionArtifacts = [
    "docs/goals/evidence/h3-install-macos.md",
    "docs/goals/archive/v1.0-LAUNCH-2026-08-01.md",
    "packages/adapter-claude/test/e2e.test.ts",
    "packages/adapter-codex/test/e2e.test.ts",
    "packages/adapter-hermes/test/e2e.test.ts",
  ];

  for (const syntheticArtifact of syntheticCompletionArtifacts) {
    await mkdir(path.dirname(path.join(fixtureRoot, syntheticArtifact)), { recursive: true });
    await writeFile(
      path.join(fixtureRoot, syntheticArtifact),
      "synthetic completion artifact\n",
      "utf8",
    );
  }

  const syntheticCompletionWithIssuesResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot, "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(syntheticCompletionWithIssuesResult.status, 1);
  const syntheticCompletionWithIssuesAudit = JSON.parse(syntheticCompletionWithIssuesResult.stdout);
  assert.equal(syntheticCompletionWithIssuesAudit.status, "not_complete");
  assert.equal(syntheticCompletionWithIssuesAudit.issues.length > 0, true);
  assert.equal(
    syntheticCompletionWithIssuesAudit.statusBlockerChecks.some(
      (entry) =>
        entry.requirement === "audit issues must keep completion status blocked" &&
        entry.result === "fail",
    ),
    true,
  );
  assert.equal(
    syntheticCompletionWithIssuesAudit.promptToArtifactChecklist.some(
      (entry) =>
        entry.requirement === "Aggregate audit issue list remains empty" && entry.result === "fail",
    ),
    true,
  );

  await writeFile(completeGoalPath, completeGoal, "utf8");
  await writeFile(shortTermPath, shortTerm, "utf8");
  for (const syntheticArtifact of syntheticCompletionArtifacts) {
    await rm(path.join(fixtureRoot, syntheticArtifact), { force: true });
  }

  const gateEvaluatorPath = path.join(fixtureRoot, "packages/core/src/gates/evaluate-gate.ts");
  const gateEvaluator = await readFile(gateEvaluatorPath, "utf8");
  await writeFile(
    gateEvaluatorPath,
    gateEvaluator.replace("anchorStats.isDirectory()", "false"),
    "utf8",
  );

  const runtimeGateDriftResult = spawnSync(
    process.execPath,
    [script, "--root", fixtureRoot, "--json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(runtimeGateDriftResult.status, 1);
  assert.match(runtimeGateDriftResult.stderr, /runtime gate must accept directory anchors/);
  const runtimeGateDriftAudit = JSON.parse(runtimeGateDriftResult.stdout);
  assert.equal(
    runtimeGateDriftAudit.runtimeFalsifiesGateChecks.some(
      (entry) =>
        entry.requirement ===
          "runtime gate must accept directory anchors consistently with repo validator" &&
        entry.result === "fail",
    ),
    true,
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
