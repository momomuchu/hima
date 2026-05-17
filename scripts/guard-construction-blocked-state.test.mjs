import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const guardPath = path.resolve("scripts/guard-construction-blocked-state.mjs");
const fixtureRoot = path.resolve(`.tmp-guard-construction-blocked-state-${process.pid}`);

await mkdir(path.join(fixtureRoot, "docs/goals/archive"), { recursive: true });
await mkdir(path.join(fixtureRoot, "docs/goals/evidence"), { recursive: true });

const filesToCopy = [
  "package.json",
  "scripts/run-tests.mjs",
  "docs/goals/SHORT-TERM-GOAL.md",
  "docs/goals/COMPLETE-CONSTRUCTION-GOAL.md",
  "docs/goals/h3-macos-authorization-packet.md",
  "docs/goals/evidence/h3-install-linux.md",
  "docs/goals/evidence/h3-install-windows.md",
  "docs/goals/beta-release-authorization-packet.md",
  "docs/goals/stress-siem-authorization-packet.md",
  "docs/goals/runtime-evidence-authorization-prep.md",
  "docs/goals/adapter-e2e-authorization-blocker-review.md",
  "docs/goals/real-user-home-install-authorization-prep.md",
  "docs/goals/master-goal-rescope-decision-packet.md",
  "docs/goals/external-authorization-packet-coverage-audit.md",
  "docs/goals/archive/cycle-96-BLOCKED-2026-05-15.md",
];

try {
  for (const file of filesToCopy) {
    await mkdir(path.dirname(path.join(fixtureRoot, file)), { recursive: true });
    await cp(path.resolve(file), path.join(fixtureRoot, file));
  }

  const passResult = runGuard();
  assert.equal(passResult.status, 0, passResult.stderr);

  const shortTermPath = path.join(fixtureRoot, "docs/goals/SHORT-TERM-GOAL.md");
  const shortTerm = await readFile(shortTermPath, "utf8");
  await writeFile(
    shortTermPath,
    shortTerm.replace(
      /^cycle-id:\s*cycle-96-external-authorization-required$/mu,
      "cycle-id: cycle-97-bypass",
    ),
    "utf8",
  );

  const cycleIdDriftResult = runGuard();
  assert.equal(cycleIdDriftResult.status, 1);
  assert.match(cycleIdDriftResult.stderr, /cycle-id must remain cycle-96/);

  await writeFile(shortTermPath, shortTerm, "utf8");

  await writeFile(
    shortTermPath,
    shortTerm.replace(/^status:\s*BLOCKED$/mu, "status: DONE"),
    "utf8",
  );

  const statusDriftResult = runGuard();
  assert.equal(statusDriftResult.status, 1);
  assert.match(statusDriftResult.stderr, /Cycle 96 must remain status: BLOCKED/);

  await writeFile(shortTermPath, shortTerm, "utf8");

  await writeFile(
    shortTermPath,
    shortTerm.replace(
      "This cycle cannot reach DONE through local code or docs alone.",
      "This cycle can reach DONE through local code or docs alone.",
    ),
    "utf8",
  );

  const shortTermBoundaryResult = runGuard();
  assert.equal(shortTermBoundaryResult.status, 1);
  assert.match(
    shortTermBoundaryResult.stderr,
    /missing required Cycle 96 external-evidence boundary/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");

  await writeFile(
    shortTermPath,
    shortTerm.replace("ledger remains 119/155", "ledger is now 121/155"),
    "utf8",
  );

  const staleClaimResult = runGuard();
  assert.equal(staleClaimResult.status, 1);
  assert.match(staleClaimResult.stderr, /forbidden ledger progress above 119\/155 claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\nConstruction progress is now 77.0%\n`, "utf8");

  const stalePercentClaimResult = runGuard();
  assert.equal(stalePercentClaimResult.status, 1);
  assert.match(stalePercentClaimResult.stderr, /construction progress above 76\.8% claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\nCycle 96 has 35 open rows\n`, "utf8");

  const staleOpenRowCountClaimResult = runGuard();
  assert.equal(staleOpenRowCountClaimResult.status, 1);
  assert.match(staleOpenRowCountClaimResult.stderr, /current open-row count below 36 claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\ndocs/goals/evidence/h3-install-macos.md exists\n`,
    "utf8",
  );

  const staleMacosArtifactClaimResult = runGuard();
  assert.equal(staleMacosArtifactClaimResult.status, 1);
  assert.match(staleMacosArtifactClaimResult.stderr, /macOS transcript artifact existence claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\nmacOS install test has been passed\n`, "utf8");

  const staleMacosInstallCompletionClaimResult = runGuard();
  assert.equal(staleMacosInstallCompletionClaimResult.status, 1);
  assert.match(staleMacosInstallCompletionClaimResult.stderr, /macOS install proof complete claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nmanual CI workflow has been executed successfully\n`,
    "utf8",
  );

  const staleManualCiH3WorkflowClaimResult = runGuard();
  assert.equal(staleManualCiH3WorkflowClaimResult.status, 1);
  assert.match(staleManualCiH3WorkflowClaimResult.stderr, /manual CI H3 workflow success claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nLinux and Windows transcripts satisfy H3\n`,
    "utf8",
  );

  const stalePartialH3PromotionClaimResult = runGuard();
  assert.equal(stalePartialH3PromotionClaimResult.status, 1);
  assert.match(
    stalePartialH3PromotionClaimResult.stderr,
    /partial Linux\/Windows H3 evidence satisfies H3 claim/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\npackages/adapter-claude/test/e2e.test.ts passes\n`,
    "utf8",
  );

  const staleAdapterE2eArtifactClaimResult = runGuard();
  assert.equal(staleAdapterE2eArtifactClaimResult.status, 1);
  assert.match(
    staleAdapterE2eArtifactClaimResult.stderr,
    /adapter E2E artifact existence or pass claim/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\nadapter E2E has passed\n`, "utf8");

  const staleAdapterE2eCompletionClaimResult = runGuard();
  assert.equal(staleAdapterE2eCompletionClaimResult.status, 1);
  assert.match(staleAdapterE2eCompletionClaimResult.stderr, /adapter E2E completion claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\n3 adapters are now production-ready\n`, "utf8");

  const staleAdapterProductionReadinessClaimResult = runGuard();
  assert.equal(staleAdapterProductionReadinessClaimResult.status, 1);
  assert.match(
    staleAdapterProductionReadinessClaimResult.stderr,
    /adapter production readiness claim/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nadapter hook firing proof has been captured\n`,
    "utf8",
  );

  const staleAdapterHookProofClaimResult = runGuard();
  assert.equal(staleAdapterHookProofClaimResult.status, 1);
  assert.match(
    staleAdapterHookProofClaimResult.stderr,
    /adapter hook firing or behavior proof claim/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nunsupported hooks are now production-blocking controls\n`,
    "utf8",
  );

  const staleUnsupportedHookUpgradeClaimResult = runGuard();
  assert.equal(staleUnsupportedHookUpgradeClaimResult.status, 1);
  assert.match(
    staleUnsupportedHookUpgradeClaimResult.stderr,
    /unsupported or degraded adapter hooks blocking-control claim/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\nfive-client compatibility is complete\n`, "utf8");

  const staleFiveClientCompatibilityClaimResult = runGuard();
  assert.equal(staleFiveClientCompatibilityClaimResult.status, 1);
  assert.match(
    staleFiveClientCompatibilityClaimResult.stderr,
    /five-client compatibility complete claim/,
  );

  const releaseClaimFixtures = [
    {
      claim: "GitHub repository is public",
      expected: /GitHub repository public or released claim/,
    },
    {
      claim: "GitHub repository visibility has been flipped to public",
      expected: /GitHub repository visibility flipped public claim/,
    },
    {
      claim: "v1.0.0 tag has been created",
      expected: /v1 release tag or notes published claim/,
    },
    {
      claim: "@hima/cli is published",
      expected: /npm publication complete claim/,
    },
    {
      claim: "npm registry lookup has returned the @hima/cli package",
      expected: /npm registry lookup returns package claim/,
    },
    {
      claim: "npm install -g @hima/cli now works",
      expected: /global npm install works claim/,
    },
    {
      claim: "sale page is live",
      expected: /sale page or Stripe payment live claim/,
    },
    {
      claim: "sale page has accepted a real Stripe test transaction",
      expected: /sale page test transaction accepted claim/,
    },
    {
      claim: "1000 licenses have been sold",
      expected: /founding-cohort sales or cap reached claim/,
    },
    {
      claim: "closed beta is complete",
      expected: /closed beta or saturation survey complete claim/,
    },
    {
      claim: "10 beta users have been recruited and completed the scenarios",
      expected: /beta users participated or completed scenarios claim/,
    },
    {
      claim: "beta survey has reported six users completed all 3 scenarios and would pay $249",
      expected: /beta survey met scenario or pay-intent criteria claim/,
    },
    {
      claim: "Show HN and dev.to are posted",
      expected: /launch posts published claim/,
    },
    {
      claim: "Show HN link has been captured",
      expected: /launch-post links captured claim/,
    },
  ];

  for (const fixture of releaseClaimFixtures) {
    await writeFile(shortTermPath, `${shortTerm}\n${fixture.claim}\n`, "utf8");

    const staleReleaseClaimResult = runGuard();
    assert.equal(staleReleaseClaimResult.status, 1);
    assert.match(staleReleaseClaimResult.stderr, fixture.expected);
  }

  const executionClaimFixtures = [
    {
      claim: "Claude Code session has been executed",
      expected: /runtime\/model sessions executed claim/,
    },
    {
      claim: "Cross-runtime parity test harness is now green",
      expected: /runtime suite, parity, or final critic completion claim/,
    },
    {
      claim: "runtime parity preflight reports executionAllowed: true",
      expected: /runtime preflight allows execution claim/,
    },
    {
      claim: "harness self-test reports externalRuntimeSessionsLaunched: true",
      expected: /self-test external runtime launch claim/,
    },
    {
      claim: "benchmark dry-run status is now ready",
      expected: /benchmark dry-run unblocked claim/,
    },
    {
      claim: "real ~/.hima has been installed",
      expected: /real user-home install complete claim/,
    },
    {
      claim: "real ~/.hima dry-run wrote files",
      expected: /real user-home dry-run wrote files claim/,
    },
    {
      claim: "real ~/.hima backup and restore proof is complete",
      expected: /real user-home backup or restore proof complete claim/,
    },
    {
      claim: "00-idea-pmf skills have been installed under ~/.hima",
      expected: /book skills installed in real user-home claim/,
    },
    {
      claim: "HARV-01 ai-slop-cleaner has been installed under ~/.hima",
      expected: /harvested skills installed or invoked claim/,
    },
    {
      claim: "SWE-bench has been executed",
      expected: /SWE-bench or benchmark execution complete claim/,
    },
    {
      claim: "stress test has been completed",
      expected: /stress execution complete claim/,
    },
    {
      claim: "external SIEM has been ingested",
      expected: /external SIEM ingest complete claim/,
    },
    {
      claim: "siem fixture reports externalTransmissions: true",
      expected: /SIEM fixture external transmission claim/,
    },
    {
      claim: "external harness init run has been completed successfully",
      expected: /fresh-machine external harness init complete claim/,
    },
  ];

  for (const fixture of executionClaimFixtures) {
    await writeFile(shortTermPath, `${shortTerm}\n${fixture.claim}\n`, "utf8");

    const staleExecutionClaimResult = runGuard();
    assert.equal(staleExecutionClaimResult.status, 1);
    assert.match(staleExecutionClaimResult.stderr, fixture.expected);
  }

  await writeFile(shortTermPath, `${shortTerm}\nrevenue has been validated\n`, "utf8");

  const staleBusinessClaimResult = runGuard();
  assert.equal(staleBusinessClaimResult.status, 1);
  assert.match(
    staleBusinessClaimResult.stderr,
    /business\/legal\/market\/revenue proof complete claim/,
  );

  await writeFile(shortTermPath, `${shortTerm}\nruntime authorization has been granted\n`, "utf8");

  const staleAuthorizationClaimResult = runGuard();
  assert.equal(staleAuthorizationClaimResult.status, 1);
  assert.match(staleAuthorizationClaimResult.stderr, /external authorization granted claim/);

  await writeFile(
    shortTermPath,
    `${shortTerm}\nauthorization packet is ready to execute the macOS run\n`,
    "utf8",
  );

  const staleAuthorizationPacketReadyClaimResult = runGuard();
  assert.equal(staleAuthorizationPacketReadyClaimResult.status, 1);
  assert.match(
    staleAuthorizationPacketReadyClaimResult.stderr,
    /authorization packet execution-ready claim/,
  );

  await writeFile(shortTermPath, `${shortTerm}\nexternal blockers have been resolved\n`, "utf8");

  const staleBlockerResolutionClaimResult = runGuard();
  assert.equal(staleBlockerResolutionClaimResult.status, 1);
  assert.match(staleBlockerResolutionClaimResult.stderr, /external blockers resolved claim/);

  await writeFile(shortTermPath, `${shortTerm}\nCycle 96 is now unblocked\n`, "utf8");

  const staleCycleUnblockedClaimResult = runGuard();
  assert.equal(staleCycleUnblockedClaimResult.status, 1);
  assert.match(staleCycleUnblockedClaimResult.stderr, /Cycle 96 unblocked claim/);

  await writeFile(shortTermPath, `${shortTerm}\nexternal evidence has been collected\n`, "utf8");

  const staleExternalEvidenceClaimResult = runGuard();
  assert.equal(staleExternalEvidenceClaimResult.status, 1);
  assert.match(staleExternalEvidenceClaimResult.stderr, /external evidence present claim/);

  await writeFile(shortTermPath, `${shortTerm}\nCycle 96 is ready to close\n`, "utf8");

  const staleClosureReadyClaimResult = runGuard();
  assert.equal(staleClosureReadyClaimResult.status, 1);
  assert.match(staleClosureReadyClaimResult.stderr, /Cycle 96 closure-ready claim/);

  await writeFile(
    shortTermPath,
    `${shortTerm}\nnode scripts/audit-construction-completion.mjs --require-complete exited 0\n`,
    "utf8",
  );

  const staleRequireCompleteSuccessClaimResult = runGuard();
  assert.equal(staleRequireCompleteSuccessClaimResult.status, 1);
  assert.match(staleRequireCompleteSuccessClaimResult.stderr, /require-complete success claim/);

  await writeFile(shortTermPath, `${shortTerm}\nconstruction goal has been achieved\n`, "utf8");

  const staleGoalAchievedClaimResult = runGuard();
  assert.equal(staleGoalAchievedClaimResult.status, 1);
  assert.match(staleGoalAchievedClaimResult.stderr, /construction goal achieved claim/);

  await writeFile(
    shortTermPath,
    `${shortTerm}\nroot tests pass proves construction goal complete\n`,
    "utf8",
  );

  const staleGreenTestsProxyClaimResult = runGuard();
  assert.equal(staleGreenTestsProxyClaimResult.status, 1);
  assert.match(
    staleGreenTestsProxyClaimResult.stderr,
    /green local tests prove construction completion claim/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\naudit issues are empty proves construction goal complete\n`,
    "utf8",
  );

  const staleEmptyAuditIssuesProxyClaimResult = runGuard();
  assert.equal(staleEmptyAuditIssuesProxyClaimResult.status, 1);
  assert.match(
    staleEmptyAuditIssuesProxyClaimResult.stderr,
    /empty audit issues prove construction completion claim/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\n36/36 row-to-external-blocker mappings prove construction goal complete\n`,
    "utf8",
  );

  const staleRowMappingProxyClaimResult = runGuard();
  assert.equal(staleRowMappingProxyClaimResult.status, 1);
  assert.match(
    staleRowMappingProxyClaimResult.stderr,
    /row mapping completeness proves construction completion claim/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\n36/36 open rows have packet/prep coverage proves construction goal complete\n`,
    "utf8",
  );

  const staleCoverageCompletenessProxyClaimResult = runGuard();
  assert.equal(staleCoverageCompletenessProxyClaimResult.status, 1);
  assert.match(
    staleCoverageCompletenessProxyClaimResult.stderr,
    /packet coverage completeness proves construction completion claim/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\nexternal blocker list exact proves construction goal complete\n`,
    "utf8",
  );

  const staleBlockerListProxyClaimResult = runGuard();
  assert.equal(staleBlockerListProxyClaimResult.status, 1);
  assert.match(
    staleBlockerListProxyClaimResult.stderr,
    /blocker-list exactness proves construction completion claim/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\nclaim-bearing Falsifies-If validation passes proves construction goal complete\n`,
    "utf8",
  );

  const staleFalsifiesIfProxyClaimResult = runGuard();
  assert.equal(staleFalsifiesIfProxyClaimResult.status, 1);
  assert.match(
    staleFalsifiesIfProxyClaimResult.stderr,
    /Falsifies-If validation proves construction completion claim/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\nrequired completion artifacts absent proves construction goal complete\n`,
    "utf8",
  );

  const staleArtifactAbsenceProxyClaimResult = runGuard();
  assert.equal(staleArtifactAbsenceProxyClaimResult.status, 1);
  assert.match(
    staleArtifactAbsenceProxyClaimResult.stderr,
    /completion-artifact absence proves construction completion claim/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\nstatus-blocker checks pass proves construction goal complete\n`,
    "utf8",
  );

  const staleStatusBlockerProxyClaimResult = runGuard();
  assert.equal(staleStatusBlockerProxyClaimResult.status, 1);
  assert.match(
    staleStatusBlockerProxyClaimResult.stderr,
    /status-blocker checks prove construction completion claim/,
  );

  await writeFile(
    shortTermPath,
    `${shortTerm}\nactive DONE criteria checks pass proves construction goal complete\n`,
    "utf8",
  );

  const staleDoneCriteriaProxyClaimResult = runGuard();
  assert.equal(staleDoneCriteriaProxyClaimResult.status, 1);
  assert.match(
    staleDoneCriteriaProxyClaimResult.stderr,
    /DONE-criteria checks prove construction completion claim/,
  );

  await writeFile(shortTermPath, `${shortTerm}\nlaunch snapshot has been captured\n`, "utf8");

  const staleLaunchSnapshotCaptureClaimResult = runGuard();
  assert.equal(staleLaunchSnapshotCaptureClaimResult.status, 1);
  assert.match(staleLaunchSnapshotCaptureClaimResult.stderr, /launch snapshot captured claim/);

  await writeFile(shortTermPath, `${shortTerm}\nremaining open rows have been closed\n`, "utf8");

  const staleOpenRowClosureClaimResult = runGuard();
  assert.equal(staleOpenRowClosureClaimResult.status, 1);
  assert.match(staleOpenRowClosureClaimResult.stderr, /open-row closure claim/);

  await writeFile(
    shortTermPath,
    `${shortTerm}\ncoverage audit proves external evidence completion\n`,
    "utf8",
  );

  const staleProxyEvidenceClaimResult = runGuard();
  assert.equal(staleProxyEvidenceClaimResult.status, 1);
  assert.match(
    staleProxyEvidenceClaimResult.stderr,
    /local packet\/prep\/audit surface proves external completion claim/,
  );

  await writeFile(shortTermPath, `${shortTerm}\nmaster goal has been rescoped\n`, "utf8");

  const staleRescopeClaimResult = runGuard();
  assert.equal(staleRescopeClaimResult.status, 1);
  assert.match(staleRescopeClaimResult.stderr, /master-goal rescope enacted claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    shortTerm.replace("11/11 blocked-state guard checks", "10/10 blocked-state guard checks"),
    "utf8",
  );

  const staleGuardCountClaimResult = runGuard();
  assert.equal(staleGuardCountClaimResult.status, 1);
  assert.match(staleGuardCountClaimResult.stderr, /stale 10\/10 blocked-state guard claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit now exposes 10 \`blockedStateGuardChecks\`\n`,
    "utf8",
  );

  const staleGuardFieldCountClaimResult = runGuard();
  assert.equal(staleGuardFieldCountClaimResult.status, 1);
  assert.match(
    staleGuardFieldCountClaimResult.stderr,
    /stale blockedStateGuardChecks field-count claim/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(shortTermPath, `${shortTerm}\nH3 PASS Linux + macOS + Windows\n`, "utf8");

  const staleH3AllOsClaimResult = runGuard();
  assert.equal(staleH3AllOsClaimResult.status, 1);
  assert.match(staleH3AllOsClaimResult.stderr, /H3 all-OS completion claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");

  const packageJsonPath = path.join(fixtureRoot, "package.json");
  const packageJson = await readFile(packageJsonPath, "utf8");
  const packageJsonObject = JSON.parse(packageJson);
  delete packageJsonObject.scripts["audit:construction-completion"];
  delete packageJsonObject.scripts["audit:construction-completion:test"];
  await writeFile(packageJsonPath, `${JSON.stringify(packageJsonObject, null, 2)}\n`, "utf8");

  const missingAuditScriptsResult = runGuard();
  assert.equal(missingAuditScriptsResult.status, 1);
  assert.match(missingAuditScriptsResult.stderr, /missing audit:construction-completion script/);
  assert.match(
    missingAuditScriptsResult.stderr,
    /missing audit:construction-completion:test script/,
  );

  await writeFile(packageJsonPath, packageJson, "utf8");

  await writeFile(
    packageJsonPath,
    packageJson.replace(" && node scripts/guard-construction-blocked-state.mjs", ""),
    "utf8",
  );

  const missingLintWiringResult = runGuard();
  assert.equal(missingLintWiringResult.status, 1);
  assert.match(
    missingLintWiringResult.stderr,
    /lint script must run guard-construction-blocked-state\.mjs/,
  );

  await writeFile(packageJsonPath, packageJson, "utf8");

  await writeFile(
    packageJsonPath,
    packageJson.replace(" && node scripts/audit-construction-completion.mjs", ""),
    "utf8",
  );

  const missingLintAuditWiringResult = runGuard();
  assert.equal(missingLintAuditWiringResult.status, 1);
  assert.match(
    missingLintAuditWiringResult.stderr,
    /lint script must run audit-construction-completion\.mjs/,
  );

  await writeFile(packageJsonPath, packageJson, "utf8");

  const runTestsPath = path.join(fixtureRoot, "scripts/run-tests.mjs");
  const runTests = await readFile(runTestsPath, "utf8");
  await writeFile(
    runTestsPath,
    runTests.replace('  ["node", ["scripts/audit-construction-completion.test.mjs"]],\n', ""),
    "utf8",
  );

  const missingAuditTestRunnerWiringResult = runGuard();
  assert.equal(missingAuditTestRunnerWiringResult.status, 1);
  assert.match(
    missingAuditTestRunnerWiringResult.stderr,
    /test runner must execute audit-construction-completion\.test\.mjs/,
  );

  await writeFile(runTestsPath, runTests, "utf8");

  await writeFile(
    runTestsPath,
    runTests.replace('  ["node", ["scripts/guard-construction-blocked-state.test.mjs"]],\n', ""),
    "utf8",
  );

  const missingTestRunnerWiringResult = runGuard();
  assert.equal(missingTestRunnerWiringResult.status, 1);
  assert.match(
    missingTestRunnerWiringResult.stderr,
    /test runner must execute guard-construction-blocked-state\.test\.mjs/,
  );

  await writeFile(runTestsPath, runTests, "utf8");

  const linuxEvidencePath = path.join(fixtureRoot, "docs/goals/evidence/h3-install-linux.md");
  const linuxEvidence = await readFile(linuxEvidencePath, "utf8");
  await writeFile(
    linuxEvidencePath,
    linuxEvidence.replace("| Failure count | 0 |", "| Failure count | 1 |"),
    "utf8",
  );

  const partialEvidenceDriftResult = runGuard();
  assert.equal(partialEvidenceDriftResult.status, 1);
  assert.match(partialEvidenceDriftResult.stderr, /missing zero-failure H3 transcript summary/);

  await writeFile(linuxEvidencePath, linuxEvidence, "utf8");

  await writeFile(
    path.join(fixtureRoot, "docs/goals/evidence/h3-install-macos.md"),
    "# Fabricated macOS transcript\n",
    "utf8",
  );

  const failResult = runGuard();
  assert.equal(failResult.status, 1);
  assert.match(failResult.stderr, /h3-install-macos\.md: must be absent/);

  await rm(path.join(fixtureRoot, "docs/goals/evidence/h3-install-macos.md"));

  for (const fakeE2ePath of [
    "packages/adapter-claude/test/e2e.test.ts",
    "packages/adapter-codex/test/e2e.test.ts",
    "packages/adapter-hermes/test/e2e.test.ts",
  ]) {
    await mkdir(path.dirname(path.join(fixtureRoot, fakeE2ePath)), { recursive: true });
    await writeFile(
      path.join(fixtureRoot, fakeE2ePath),
      "test('fake e2e placeholder', () => {});\n",
      "utf8",
    );

    const fakeE2eResult = runGuard();
    assert.equal(fakeE2eResult.status, 1);
    assert.match(fakeE2eResult.stderr, new RegExp(`${escapeRegExp(fakeE2ePath)}: must be absent`));
    await rm(path.join(fixtureRoot, fakeE2ePath));
  }

  const h3PacketPath = path.join(fixtureRoot, "docs/goals/h3-macos-authorization-packet.md");
  const h3Packet = await readFile(h3PacketPath, "utf8");
  await writeFile(
    h3PacketPath,
    h3Packet.replace("Authorized Route B: Manual GitHub Actions CI", "Authorized Route B: Removed"),
    "utf8",
  );

  const packetTermDriftResult = runGuard();
  assert.equal(packetTermDriftResult.status, 1);
  assert.match(packetTermDriftResult.stderr, /missing required authorization-packet term/);

  await writeFile(h3PacketPath, h3Packet, "utf8");

  const runtimePrepPath = path.join(
    fixtureRoot,
    "docs/goals/runtime-evidence-authorization-prep.md",
  );
  const runtimePrep = await readFile(runtimePrepPath, "utf8");
  await writeFile(
    runtimePrepPath,
    runtimePrep.replace(
      "Do not launch the runtime binary until the authorization packet exists",
      "Runtime launch is allowed without the authorization packet",
    ),
    "utf8",
  );

  const prepTermDriftResult = runGuard();
  assert.equal(prepTermDriftResult.status, 1);
  assert.match(prepTermDriftResult.stderr, /missing required authorization-prep term/);

  await writeFile(runtimePrepPath, runtimePrep, "utf8");

  const rescopePacketPath = path.join(
    fixtureRoot,
    "docs/goals/master-goal-rescope-decision-packet.md",
  );
  const rescopePacket = await readFile(rescopePacketPath, "utf8");
  await writeFile(
    rescopePacketPath,
    rescopePacket.replace("Replacement claims", "Replacement claim boundary removed"),
    "utf8",
  );

  const rescopeTermDriftResult = runGuard();
  assert.equal(rescopeTermDriftResult.status, 1);
  assert.match(rescopeTermDriftResult.stderr, /missing required rescope-packet term/);

  await writeFile(rescopePacketPath, rescopePacket, "utf8");

  await writeFile(
    rescopePacketPath,
    rescopePacket.replace(
      "states that no row, ledger count, or completion status changes from\nthis packet alone.",
      "states that this packet closes the remaining master-goal rows.",
    ),
    "utf8",
  );

  const rescopeBoundaryDriftResult = runGuard();
  assert.equal(rescopeBoundaryDriftResult.status, 1);
  assert.match(
    rescopeBoundaryDriftResult.stderr,
    /missing explicit non-rescope\/non-evidence\/no-ledger-change boundary/,
  );

  await writeFile(rescopePacketPath, rescopePacket, "utf8");

  const completeGoalPath = path.join(fixtureRoot, "docs/goals/COMPLETE-CONSTRUCTION-GOAL.md");
  const completeGoal = await readFile(completeGoalPath, "utf8");
  await writeFile(
    completeGoalPath,
    completeGoal.replace(
      "13 runtime Falsifies gate invariants",
      "11 runtime Falsifies gate invariants",
    ),
    "utf8",
  );

  const staleRuntimeInvariantClaimResult = runGuard();
  assert.equal(staleRuntimeInvariantClaimResult.status, 1);
  assert.match(
    staleRuntimeInvariantClaimResult.stderr,
    /stale 11 runtime Falsifies gate invariants claim/,
  );

  await writeFile(completeGoalPath, completeGoal, "utf8");

  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit now exposes 12 \`runtimeFalsifiesGateChecks\`\n`,
    "utf8",
  );

  const staleRuntimeFalsifiesFieldCountResult = runGuard();
  assert.equal(staleRuntimeFalsifiesFieldCountResult.status, 1);
  assert.match(
    staleRuntimeFalsifiesFieldCountResult.stderr,
    /stale runtimeFalsifiesGateChecks field-count claim/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit reports 12/12 runtime gate checks pass\n`,
    "utf8",
  );

  const staleRuntimeGateRatioResult = runGuard();
  assert.equal(staleRuntimeGateRatioResult.status, 1);
  assert.match(staleRuntimeGateRatioResult.stderr, /stale runtime gate check ratio claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit now exposes 75 \`falsifiesFieldChecks\`\n`,
    "utf8",
  );

  const staleFalsifiesFieldCountResult = runGuard();
  assert.equal(staleFalsifiesFieldCountResult.status, 1);
  assert.match(
    staleFalsifiesFieldCountResult.stderr,
    /stale falsifiesFieldChecks field-count claim/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit reports 75/75 falsifies-field checks pass\n`,
    "utf8",
  );

  const staleFalsifiesFieldRatioResult = runGuard();
  assert.equal(staleFalsifiesFieldRatioResult.status, 1);
  assert.match(staleFalsifiesFieldRatioResult.stderr, /stale falsifies-field check ratio claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit now exposes 48 \`artifactTermChecks\`\n`,
    "utf8",
  );

  const staleArtifactTermFieldCountResult = runGuard();
  assert.equal(staleArtifactTermFieldCountResult.status, 1);
  assert.match(
    staleArtifactTermFieldCountResult.stderr,
    /stale artifactTermChecks field-count claim/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit reports 48/48 required-term checks pass\n`,
    "utf8",
  );

  const staleRequiredTermRatioResult = runGuard();
  assert.equal(staleRequiredTermRatioResult.status, 1);
  assert.match(staleRequiredTermRatioResult.stderr, /stale required-term check ratio claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit now exposes 20 \`artifactSurfaceChecks\`\n`,
    "utf8",
  );

  const staleArtifactSurfaceFieldCountResult = runGuard();
  assert.equal(staleArtifactSurfaceFieldCountResult.status, 1);
  assert.match(
    staleArtifactSurfaceFieldCountResult.stderr,
    /stale artifactSurfaceChecks field-count claim/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit reports 20/20 surface checks pass\n`,
    "utf8",
  );

  const staleSurfaceRatioResult = runGuard();
  assert.equal(staleSurfaceRatioResult.status, 1);
  assert.match(staleSurfaceRatioResult.stderr, /stale surface check ratio claim/);

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit now exposes 11 \`coverageSurfacePathChecks\`\n`,
    "utf8",
  );

  const staleCoverageSurfacePathFieldCountResult = runGuard();
  assert.equal(staleCoverageSurfacePathFieldCountResult.status, 1);
  assert.match(
    staleCoverageSurfacePathFieldCountResult.stderr,
    /stale coverageSurfacePathChecks field-count claim/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");
  await writeFile(
    shortTermPath,
    `${shortTerm}\nCompletion audit reports 11/11 referenced surfaces pass\n`,
    "utf8",
  );

  const staleReferencedSurfaceRatioResult = runGuard();
  assert.equal(staleReferencedSurfaceRatioResult.status, 1);
  assert.match(
    staleReferencedSurfaceRatioResult.stderr,
    /stale referenced-surface check ratio claim/,
  );

  await writeFile(shortTermPath, shortTerm, "utf8");

  await writeFile(
    completeGoalPath,
    completeGoal.replace("- [ ] HARV-02 agnix-style linting", "- [ ] FAKE local replacement row"),
    "utf8",
  );

  const rowDriftResult = runGuard();
  assert.equal(rowDriftResult.status, 1);
  assert.match(rowDriftResult.stderr, /expected blocked open row is not unchecked/);
  assert.match(rowDriftResult.stderr, /unexpected unchecked row while Cycle 96 is BLOCKED/);

  await writeFile(completeGoalPath, completeGoal, "utf8");

  const coverageAuditPath = path.join(
    fixtureRoot,
    "docs/goals/external-authorization-packet-coverage-audit.md",
  );
  const coverageAudit = await readFile(coverageAuditPath, "utf8");
  await writeFile(
    coverageAuditPath,
    coverageAudit.replace("| Adapter real E2E | 3 |", "| Adapter real E2E | 2 |"),
    "utf8",
  );

  const coverageDriftResult = runGuard();
  assert.equal(coverageDriftResult.status, 1);
  assert.match(coverageDriftResult.stderr, /expected coverage-map row sum 36, found 35/);
  assert.match(coverageDriftResult.stderr, /Adapter real E2E expected 3 rows, found 2/);

  await writeFile(coverageAuditPath, coverageAudit, "utf8");

  const archivePath = path.join(fixtureRoot, "docs/goals/archive/cycle-96-BLOCKED-2026-05-15.md");
  const archive = await readFile(archivePath, "utf8");
  await writeFile(
    archivePath,
    archive.replace("blockedStateGuardChecks", "blocked state guard checks"),
    "utf8",
  );

  const archiveBlockedStateTermDriftResult = runGuard();
  assert.equal(archiveBlockedStateTermDriftResult.status, 1);
  assert.match(
    archiveBlockedStateTermDriftResult.stderr,
    /missing required archived blocked-state term/,
  );

  await writeFile(archivePath, archive, "utf8");
  await writeFile(
    archivePath,
    archive.replace("archiveDeliveredArtifactChecks", "archive delivered artifact checks"),
    "utf8",
  );

  const archiveDeliveredArtifactTermDriftResult = runGuard();
  assert.equal(archiveDeliveredArtifactTermDriftResult.status, 1);
  assert.match(
    archiveDeliveredArtifactTermDriftResult.stderr,
    /missing required archived blocked-state term/,
  );

  await writeFile(archivePath, archive, "utf8");
  await writeFile(
    archivePath,
    archive.replaceAll("synthetic completion-with-issues drift", "synthetic completion drift"),
    "utf8",
  );

  const archiveAuditIssueTermDriftResult = runGuard();
  assert.equal(archiveAuditIssueTermDriftResult.status, 1);
  assert.match(
    archiveAuditIssueTermDriftResult.stderr,
    /missing required archived blocked-state term/,
  );

  await writeFile(archivePath, archive, "utf8");
  await writeFile(
    archivePath,
    archive.replaceAll(
      "stale 9/9 blocked-state guard count drift",
      "stale blocked-state guard count drift",
    ),
    "utf8",
  );

  const archiveStaleCountTermDriftResult = runGuard();
  assert.equal(archiveStaleCountTermDriftResult.status, 1);
  assert.match(
    archiveStaleCountTermDriftResult.stderr,
    /missing required archived blocked-state term/,
  );

  await writeFile(archivePath, archive, "utf8");
  await writeFile(
    archivePath,
    archive.replaceAll(
      "authorization-packet execution-ready drift",
      "authorization packet ready drift",
    ),
    "utf8",
  );

  const archiveAuthorizationPacketTermDriftResult = runGuard();
  assert.equal(archiveAuthorizationPacketTermDriftResult.status, 1);
  assert.match(
    archiveAuthorizationPacketTermDriftResult.stderr,
    /missing required archived blocked-state term/,
  );

  await writeFile(archivePath, archive, "utf8");
  await writeFile(
    archivePath,
    archive.replace("53 Vitest files / 702 tests", "53 Vitest files / 698 tests"),
    "utf8",
  );

  const archiveStaleTestCountResult = runGuard();
  assert.equal(archiveStaleTestCountResult.status, 1);
  assert.match(archiveStaleTestCountResult.stderr, /stale root-test count/);

  await writeFile(archivePath, archive, "utf8");
  await rm(path.join(fixtureRoot, "docs/goals/runtime-evidence-authorization-prep.md"));

  const missingPrepResult = runGuard();
  assert.equal(missingPrepResult.status, 1);
  assert.match(
    missingPrepResult.stderr,
    /runtime-evidence-authorization-prep\.md: required file is missing/,
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

function runGuard() {
  return spawnSync(process.execPath, [guardPath, "--root", fixtureRoot], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
