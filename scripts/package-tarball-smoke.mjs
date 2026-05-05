import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  essentialPackedFiles,
  listTarballEntries,
  packageDirectory,
  packageNames,
  readPackage,
  readTarballJson,
  repoRoot,
} from "./package-policy.mjs";

const catalogMarker =
  "<!-- HIMA:CATALOG-ARTIFACT kind=skill id=classify-risk source=operational-catalog -->";
const hookCatalogMarker =
  "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->";
const preToolHookCommand = "harness hook pre-tool-use";
const expectedMcpToolNames = [
  "rms.install_artifacts",
  "rms.install_platform",
  "rms.uninstall_platform",
  "rms.repair_platform",
  "rms.apply_lifecycle",
  "rms.uninstall_lifecycle",
  "rms.repair_lifecycle",
  "rms.rollback_artifacts",
  "rms.assess_route_runtime_bindings",
];

function debug(message) {
  if (process.env.HIMA_TARBALL_SMOKE_DEBUG === "1") {
    process.stderr.write(`[tarball-smoke] ${message}\n`);
  }
}

async function assertPathExists(filePath, message) {
  try {
    await access(filePath);
  } catch (error) {
    throw new Error(`${message}: ${filePath}`, { cause: error });
  }
}

async function assertPathMissing(filePath, message) {
  try {
    await access(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }

  throw new Error(`${message}: ${filePath}`);
}

function normalizeComparablePath(filePath) {
  const normalized = path.normalize(filePath);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function assertSamePathSet(actualPaths, expectedPaths, message) {
  const actual = actualPaths.map(normalizeComparablePath).sort();
  const expected = expectedPaths.map(normalizeComparablePath).sort();

  if (
    actual.length !== expected.length ||
    actual.some((filePath, index) => filePath !== expected[index])
  ) {
    throw new Error(
      `${message}: ${JSON.stringify(
        {
          actual: actualPaths,
          expected: expectedPaths,
        },
        null,
        2,
      )}`,
    );
  }
}

async function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: options.env ?? process.env,
  });

  const stdoutChunks = [];
  const stderrChunks = [];
  child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
  child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  const stdout = Buffer.concat(stdoutChunks).toString("utf8");
  const stderr = Buffer.concat(stderrChunks).toString("utf8");

  if (exitCode !== 0 && options.allowNonZero !== true) {
    throw new Error(
      `${command} ${args.join(" ")} exited with ${exitCode}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`,
    );
  }

  return { exitCode, stdout, stderr };
}

async function findCorepackEntrypoint() {
  const candidates = [
    path.join(path.dirname(process.execPath), "node_modules", "corepack", "dist", "corepack.js"),
    path.join(
      path.dirname(process.execPath),
      "..",
      "lib",
      "node_modules",
      "corepack",
      "dist",
      "corepack.js",
    ),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return null;
}

const corepackEntrypoint = await findCorepackEntrypoint();

async function runPnpm(args, cwd) {
  if (corepackEntrypoint) {
    return run(process.execPath, [corepackEntrypoint, "pnpm", ...args], { cwd });
  }

  return run("corepack", ["pnpm", ...args], { cwd });
}

async function runPnpmJson(args, cwd) {
  const { stdout, stderr } = await runPnpm(args, cwd);

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Expected JSON output from pnpm command:\n${stdout}\nSTDERR:\n${stderr}`, {
      cause: error,
    });
  }
}

async function resolveInstalledImport(consumerRoot, specifier) {
  const { stdout } = await runPnpm(
    [
      "exec",
      "node",
      "--input-type=module",
      "--eval",
      `console.log(new URL(import.meta.resolve(${JSON.stringify(specifier)})).pathname)`,
    ],
    consumerRoot,
  );

  const resolvedPath = decodeURIComponent(stdout.trim());

  return process.platform === "win32" && resolvedPath.startsWith("/")
    ? resolvedPath.slice(1).replaceAll("/", "\\")
    : resolvedPath;
}

async function packPackage(packageName, tarballDir) {
  await runPnpm(["--filter", packageName, "pack", "--pack-destination", tarballDir], repoRoot);
  const manifest = await readPackage(packageName);
  const tarballName = `${manifest.name.replace("@", "").replace("/", "-")}-${manifest.version}.tgz`;
  const tarballPath = path.join(tarballDir, tarballName);

  await assertPathExists(tarballPath, `Pack did not create ${manifest.name} tarball`);
  return { manifest, tarballPath };
}

async function assertBuiltPackage(packageName) {
  const packageDir = packageDirectory(packageName);

  for (const file of essentialPackedFiles) {
    await assertPathExists(
      path.join(packageDir, file),
      `${packageName} must be built before tarball smoke`,
    );
  }
}

async function verifyPackedPackage(packageName, tarballPath) {
  const entries = await listTarballEntries(tarballPath);
  const packedManifest = await readTarballJson(tarballPath, "package/package.json");
  const leaks = dependencyProtocolLeaks(packedManifest);

  for (const file of essentialPackedFiles) {
    const entry = `package/${file}`;

    if (!entries.includes(entry)) {
      throw new Error(`${packageName} tarball is missing ${entry}`);
    }
  }

  if (leaks.length > 0) {
    throw new Error(
      `${packageName} packed manifest contains local dependency protocols: ${leaks
        .map(([name, value]) => `${name}@${value}`)
        .join(", ")}`,
    );
  }

  return {
    entryCount: entries.length,
    packedManifestPrivate: packedManifest.private === true,
  };
}

function dependencyProtocolLeaks(manifest) {
  return Object.entries({
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
  }).filter(([, value]) => /^(workspace:|link:|file:)/.test(String(value)));
}

async function writeConsumerProject(consumerRoot, tarballs) {
  const dependencies = Object.fromEntries(
    [...tarballs.values()].map(({ manifest, tarballPath }) => [
      manifest.name,
      `file:${path.relative(consumerRoot, tarballPath).replaceAll(path.sep, "/")}`,
    ]),
  );
  const overrides = Object.fromEntries(
    Object.entries(dependencies).filter(([name]) => name.startsWith("@harness/")),
  );

  await writeFile(
    path.join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "hima-tarball-consumer-smoke",
        version: "0.0.0",
        private: true,
        type: "module",
        packageManager: "pnpm@10.33.2",
        dependencies,
        pnpm: {
          overrides,
        },
      },
      null,
      2,
    )}\n`,
  );
}

async function verifyCoreImport(consumerRoot) {
  const result = await runPnpmJson(
    [
      "exec",
      "node",
      "--input-type=module",
      "--eval",
      "const catalog = (await import('@harness/core')).getOperationalCatalog(); console.log(JSON.stringify({ skills: catalog.skills.length }));",
    ],
    consumerRoot,
  );

  if (result.skills !== 10) {
    throw new Error(`Expected @harness/core catalog to expose 10 skills, got ${result.skills}`);
  }
}

async function runHarnessJson(consumerRoot, cliEntry, args, options = {}) {
  const { exitCode, stdout, stderr } = await run(process.execPath, [cliEntry, ...args], {
    cwd: consumerRoot,
    allowNonZero: options.allowNonZero,
  });

  try {
    return {
      exitCode,
      json: JSON.parse(stdout),
    };
  } catch (error) {
    throw new Error(`Expected JSON output from harness:\n${stdout}\nSTDERR:\n${stderr}`, {
      cause: error,
    });
  }
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array: ${JSON.stringify(value)}`);
  }

  return value;
}

function findGateAssessment(assessment, gateType) {
  return requireArray(assessment.assessments, "Route assessment assessments").find(
    (entry) => entry?.binding?.gateType === gateType,
  );
}

function normalizeSnapshotPath(filePath) {
  return filePath.split(path.sep).join("/");
}

async function snapshotPlanningTree(projectRoot) {
  const planningRoot = path.join(projectRoot, ".planning");
  const entries = [];

  async function walk(directory, relativeDirectory = "") {
    const dirents = await readdir(directory, { withFileTypes: true });

    for (const dirent of dirents.sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = path.join(relativeDirectory, dirent.name);
      const absolutePath = path.join(directory, dirent.name);
      const snapshotPath = normalizeSnapshotPath(relativePath);

      if (dirent.isDirectory()) {
        entries.push({ path: snapshotPath, type: "directory" });
        await walk(absolutePath, relativePath);
        continue;
      }

      if (dirent.isFile()) {
        entries.push({
          path: snapshotPath,
          type: "file",
          content: (await readFile(absolutePath)).toString("base64"),
        });
        continue;
      }

      throw new Error(`Unsupported .planning entry type in tarball smoke: ${absolutePath}`);
    }
  }

  await walk(planningRoot);
  return JSON.stringify(entries);
}

async function seedDelegatedCodexRouteAssessment(consumerRoot, cliEntry, core, routeRoot) {
  await runHarnessJson(consumerRoot, cliEntry, ["init", "--root", routeRoot]);
  await runHarnessJson(consumerRoot, cliEntry, [
    "install",
    "codex",
    "--root",
    routeRoot,
    "--apply",
    "--writeManifest",
    "--json",
  ]);
  await runHarnessJson(consumerRoot, cliEntry, [
    "runtime",
    "probe",
    "codex",
    "--root",
    routeRoot,
    "--bind",
    "--verifyBlockingFixtures",
    "--json",
  ]);

  const project = await core.readPlanningProject(routeRoot);
  await core.writePlanningProject(routeRoot, {
    ...project,
    currentRisk: {
      ...project.currentRisk,
      risk_class: "M",
      rank: core.RISK_CLASS_RANK.M,
      bypass_allowed: core.RISK_POLICY.M.bypassAllowed,
      human_checkpoint_required: core.RISK_POLICY.M.requiresHumanCheckpoint,
    },
    runSet: {
      ...project.runSet,
      route: {
        ...project.runSet.route,
        riskClass: "M",
      },
      subagents: [
        ...project.runSet.subagents,
        {
          agentId: "worker-route-required",
          status: "planned",
        },
      ],
    },
  });
}

function assertDelegatedCodexRouteAssessment(assessment, label) {
  const requiredGates = requireArray(assessment.requiredGates, "Route assessment requiredGates");
  const gaps = requireArray(assessment.gaps, "Route assessment gaps");
  const preToolAssessment = findGateAssessment(assessment, "pre_tool");
  const subagentStopAssessment = findGateAssessment(assessment, "subagent_stop");

  for (const gateType of ["user_prompt", "pre_tool", "stop", "subagent_start", "subagent_stop"]) {
    if (!requiredGates.includes(gateType)) {
      throw new Error(`${label} required gates missing ${gateType}: ${JSON.stringify(assessment)}`);
    }
  }

  if (assessment.riskClass !== "M" || assessment.activeTarget !== "codex") {
    throw new Error(`${label} context mismatch: ${JSON.stringify(assessment)}`);
  }
  if (assessment.healthy !== false) {
    throw new Error(`${label} must be unhealthy: ${JSON.stringify(assessment)}`);
  }
  if (
    preToolAssessment?.binding?.status !== "native" ||
    preToolAssessment.binding.canBlock !== true ||
    preToolAssessment.enforceable !== true
  ) {
    throw new Error(
      `${label} pre_tool should be a native blocking binding: ${JSON.stringify(assessment)}`,
    );
  }
  if (
    subagentStopAssessment?.binding?.status !== "missing" ||
    subagentStopAssessment.binding.canBlock !== false ||
    subagentStopAssessment.enforceable !== false ||
    subagentStopAssessment.availabilityProblem !== true ||
    subagentStopAssessment.blockingProblem !== true
  ) {
    throw new Error(
      `${label} subagent_stop should be a missing route-required binding: ${JSON.stringify(assessment)}`,
    );
  }
  if (!gaps.some((gap) => String(gap).includes("runtime binding unavailable for subagent_stop"))) {
    throw new Error(`${label} gaps did not include subagent_stop: ${JSON.stringify(gaps)}`);
  }

  return {
    requiredGateCount: requiredGates.length,
    gapCount: gaps.length,
  };
}

async function verifyPackagedCliRouteAssessment(consumerRoot, cliEntry, core) {
  const routeRoot = path.join(consumerRoot, "route-assessment-cli-target");

  await seedDelegatedCodexRouteAssessment(consumerRoot, cliEntry, core, routeRoot);

  const beforePlanning = await snapshotPlanningTree(routeRoot);
  const assessment = (
    await runHarnessJson(consumerRoot, cliEntry, [
      "runtime",
      "assess-route",
      "--root",
      routeRoot,
      "--json",
    ])
  ).json;
  const afterPlanning = await snapshotPlanningTree(routeRoot);

  if (afterPlanning !== beforePlanning) {
    throw new Error("runtime assess-route mutated .planning in packaged CLI smoke");
  }

  const asserted = assertDelegatedCodexRouteAssessment(assessment, "Packaged CLI route assessment");

  return {
    routeAssessRequiredGates: asserted.requiredGateCount,
    routeAssessGaps: asserted.gapCount,
    routeAssessSubagentStopBlocked: true,
    routeAssessReadOnly: true,
  };
}

async function verifyCliArtifacts(consumerRoot, cliEntry, coreEntry) {
  const targetRoot = path.join(consumerRoot, "codex-target");
  const restoreRoot = path.join(consumerRoot, "restore-target");
  const lifecycleRoot = path.join(consumerRoot, "lifecycle-target");
  const skillPath = path.join(targetRoot, ".codex", "skills", "classify-risk", "SKILL.md");
  const restoreHookPath = path.join(restoreRoot, ".codex", "hooks", "gate-policy.md");
  const manifestPath = path.join(targetRoot, ".planning", "artifact-install-manifest.json");
  const restoreManifestPath = path.join(restoreRoot, ".planning", "artifact-install-manifest.json");
  const platformManifestPath = path.join(targetRoot, ".planning", "install-manifest.json");
  const codexConfigPath = path.join(targetRoot, ".codex", "config.toml");
  const lifecycleSkillPath = path.join(
    lifecycleRoot,
    ".codex",
    "skills",
    "classify-risk",
    "SKILL.md",
  );
  const lifecycleManifestPath = path.join(
    lifecycleRoot,
    ".planning",
    "artifact-install-manifest.json",
  );
  const lifecyclePlatformManifestPath = path.join(
    lifecycleRoot,
    ".planning",
    "install-manifest.json",
  );
  const lifecycleCodexConfigPath = path.join(lifecycleRoot, ".codex", "config.toml");

  const lifecycleDryRun = (
    await runHarnessJson(consumerRoot, cliEntry, [
      "lifecycle",
      "apply",
      "codex",
      "--root",
      lifecycleRoot,
      "--kind",
      "skills",
      "--json",
    ])
  ).json;

  if (!lifecycleDryRun.ok || lifecycleDryRun.apply !== false || lifecycleDryRun.dryRun !== true) {
    throw new Error(`Unexpected lifecycle dry-run result: ${JSON.stringify(lifecycleDryRun)}`);
  }
  await assertPathMissing(lifecycleCodexConfigPath, "Lifecycle dry-run must not write config");
  await assertPathMissing(lifecycleSkillPath, "Lifecycle dry-run must not write artifacts");

  const lifecycleApply = (
    await runHarnessJson(consumerRoot, cliEntry, [
      "lifecycle",
      "apply",
      "codex",
      "--root",
      lifecycleRoot,
      "--kind",
      "skills",
      "--apply",
      "--json",
    ])
  ).json;

  if (
    !lifecycleApply.ok ||
    lifecycleApply.apply !== true ||
    lifecycleApply.dryRun !== false ||
    lifecycleApply.writeManifests !== true
  ) {
    throw new Error(`Unexpected lifecycle apply result: ${JSON.stringify(lifecycleApply)}`);
  }
  if (
    typeof lifecycleApply.platformApplied?.hooksAdded !== "number" ||
    lifecycleApply.platformApplied.hooksAdded <= 0
  ) {
    throw new Error(
      `Lifecycle apply did not report hook writes: ${JSON.stringify(lifecycleApply)}`,
    );
  }
  if (
    !Array.isArray(lifecycleApply.artifactsWritten) ||
    lifecycleApply.artifactsWritten.length === 0
  ) {
    throw new Error(
      `Lifecycle apply did not report artifact writes: ${JSON.stringify(lifecycleApply)}`,
    );
  }
  await assertPathExists(
    lifecyclePlatformManifestPath,
    "Lifecycle apply must write platform manifest",
  );
  await assertPathExists(lifecycleManifestPath, "Lifecycle apply must write artifact manifest");
  await assertPathExists(lifecycleSkillPath, "Lifecycle apply must write classify-risk skill");
  if (!(await readFile(lifecycleCodexConfigPath, "utf8")).includes(preToolHookCommand)) {
    throw new Error("Lifecycle apply did not write the canonical pre_tool hook command");
  }

  await writeFile(lifecycleSkillPath, "tampered\n", "utf8");
  const lifecycleBlockedUninstallResult = await runHarnessJson(
    consumerRoot,
    cliEntry,
    ["lifecycle", "uninstall", "--root", lifecycleRoot, "--apply", "--json"],
    { allowNonZero: true },
  );
  const lifecycleBlockedUninstall = lifecycleBlockedUninstallResult.json;

  if (
    lifecycleBlockedUninstallResult.exitCode === 0 ||
    lifecycleBlockedUninstall.ok !== false ||
    lifecycleBlockedUninstall.blockers.length === 0 ||
    lifecycleBlockedUninstall.platformRemoved !== undefined
  ) {
    throw new Error(
      `Lifecycle uninstall did not surface rollback blockers: ${JSON.stringify(
        lifecycleBlockedUninstall,
      )}`,
    );
  }

  await rm(lifecycleManifestPath);
  const lifecycleUninstallMissingManifest = (
    await runHarnessJson(consumerRoot, cliEntry, [
      "lifecycle",
      "uninstall",
      "--root",
      lifecycleRoot,
      "--apply",
      "--json",
    ])
  ).json;

  if (
    !lifecycleUninstallMissingManifest.ok ||
    lifecycleUninstallMissingManifest.artifactRollback?.skipped !== true ||
    lifecycleUninstallMissingManifest.platformHooksRemoved <= 0
  ) {
    throw new Error(
      `Lifecycle uninstall missing-manifest path failed: ${JSON.stringify(
        lifecycleUninstallMissingManifest,
      )}`,
    );
  }
  if ((await readFile(lifecycleCodexConfigPath, "utf8")).includes(preToolHookCommand)) {
    throw new Error("Lifecycle uninstall did not remove the canonical pre_tool hook command");
  }

  const platformInstall = (
    await runHarnessJson(consumerRoot, cliEntry, [
      "install",
      "codex",
      "--root",
      targetRoot,
      "--apply",
      "--writeManifest",
      "--json",
    ])
  ).json;

  if (platformInstall?.applied?.target !== "codex" || platformInstall.applied.hooksAdded <= 0) {
    throw new Error(`Unexpected platform install result: ${JSON.stringify(platformInstall)}`);
  }
  await assertPathExists(platformManifestPath, "Platform install must write install manifest");
  if (!(await readFile(codexConfigPath, "utf8")).includes(preToolHookCommand)) {
    throw new Error("Platform install did not write the canonical pre_tool hook command");
  }

  const platformUninstall = (
    await runHarnessJson(consumerRoot, cliEntry, [
      "uninstall-platform",
      "--root",
      targetRoot,
      "--apply",
      "--json",
    ])
  ).json;

  if (!platformUninstall.ok || platformUninstall.hooksRemoved <= 0) {
    throw new Error(`Unexpected platform uninstall result: ${JSON.stringify(platformUninstall)}`);
  }
  if ((await readFile(codexConfigPath, "utf8")).includes(preToolHookCommand)) {
    throw new Error("Platform uninstall did not remove the canonical pre_tool hook command");
  }

  const platformRepair = (
    await runHarnessJson(consumerRoot, cliEntry, [
      "repair-platform",
      "--root",
      targetRoot,
      "--apply",
      "--json",
    ])
  ).json;

  if (!platformRepair.ok || platformRepair.hooksAdded <= 0) {
    throw new Error(`Unexpected platform repair result: ${JSON.stringify(platformRepair)}`);
  }
  if (!(await readFile(codexConfigPath, "utf8")).includes(preToolHookCommand)) {
    throw new Error("Platform repair did not restore the canonical pre_tool hook command");
  }

  const install = (
    await runHarnessJson(consumerRoot, cliEntry, [
      "install-artifacts",
      "codex",
      "--root",
      targetRoot,
      "--kind",
      "skills",
      "--apply",
      "--writeManifest",
      "--json",
    ])
  ).json;

  if (!install.ok || install.apply !== true || install.dryRun !== false) {
    throw new Error(`Unexpected install-artifacts apply result: ${JSON.stringify(install)}`);
  }
  if (!Array.isArray(install.artifactsWritten) || install.artifactsWritten.length === 0) {
    throw new Error("install-artifacts apply did not report written artifacts");
  }
  if (install.manifestFile !== manifestPath) {
    throw new Error(`install-artifacts reported unexpected manifest path: ${install.manifestFile}`);
  }

  const skill = await readFile(skillPath, "utf8");
  if (!skill.includes(catalogMarker)) {
    throw new Error(`Installed classify-risk skill is missing marker: ${catalogMarker}`);
  }

  const rollbackDryRun = (
    await runHarnessJson(consumerRoot, cliEntry, [
      "rollback-artifacts",
      "--root",
      targetRoot,
      "--json",
    ])
  ).json;

  if (!rollbackDryRun.ok || rollbackDryRun.apply !== false || rollbackDryRun.dryRun !== true) {
    throw new Error(`Unexpected rollback dry-run result: ${JSON.stringify(rollbackDryRun)}`);
  }
  if (rollbackDryRun.artifactsDeleted !== 0 || rollbackDryRun.deletedPaths.length !== 0) {
    throw new Error(`Rollback dry-run deleted artifacts: ${JSON.stringify(rollbackDryRun)}`);
  }
  await assertPathExists(skillPath, "Rollback dry-run must not delete classify-risk skill");

  const rollbackApply = (
    await runHarnessJson(consumerRoot, cliEntry, [
      "rollback-artifacts",
      "--root",
      targetRoot,
      "--apply",
      "--json",
    ])
  ).json;

  if (!rollbackApply.ok || rollbackApply.apply !== true || rollbackApply.dryRun !== false) {
    throw new Error(`Unexpected rollback apply result: ${JSON.stringify(rollbackApply)}`);
  }
  if (!rollbackApply.deletedPaths.includes(skillPath)) {
    throw new Error(`Rollback apply did not report deleting classify-risk skill`);
  }
  await assertPathMissing(skillPath, "Rollback apply must delete classify-risk skill");

  const previousManagedHookContent = [hookCatalogMarker, "", "# Previous managed content", ""].join(
    "\n",
  );
  await mkdir(path.dirname(restoreHookPath), { recursive: true });
  await writeFile(restoreHookPath, previousManagedHookContent, "utf8");

  const restoreInstall = (
    await runHarnessJson(consumerRoot, cliEntry, [
      "install-artifacts",
      "codex",
      "--root",
      restoreRoot,
      "--kind",
      "hooks",
      "--apply",
      "--writeManifest",
      "--captureRestoreSnapshots",
      "--json",
    ])
  ).json;

  if (
    !restoreInstall.ok ||
    restoreInstall.apply !== true ||
    restoreInstall.dryRun !== false ||
    restoreInstall.captureRestoreSnapshots !== true
  ) {
    throw new Error(
      `Unexpected restore install-artifacts result: ${JSON.stringify(restoreInstall)}`,
    );
  }
  if (
    !Array.isArray(restoreInstall.artifactsWritten) ||
    restoreInstall.artifactsWritten.length === 0
  ) {
    throw new Error("Restore install-artifacts apply did not report written hooks");
  }
  if (restoreInstall.manifestFile !== restoreManifestPath) {
    throw new Error(
      `Restore install-artifacts reported unexpected manifest path: ${restoreInstall.manifestFile}`,
    );
  }

  const restoreManifest = JSON.parse(await readFile(restoreManifestPath, "utf8"));
  const restoreManifestEntry = restoreManifest.entries?.find(
    (entry) => entry.id === "gate-policy" && entry.kind === "hook",
  );
  if (
    restoreManifestEntry?.rollback?.restoreSnapshot?.encoding !== "utf8" ||
    restoreManifestEntry.rollback.restoreSnapshot.content !== previousManagedHookContent
  ) {
    throw new Error(
      `Restore manifest did not capture previous managed hook content: ${JSON.stringify(
        restoreManifestEntry,
      )}`,
    );
  }
  const expectedDeletedHookPaths = restoreManifest.entries
    .filter((entry) => entry.kind === "hook" && entry.id !== "gate-policy")
    .map((entry) => entry.path);
  if (expectedDeletedHookPaths.length === 0) {
    throw new Error("Restore smoke did not find any newly installed hooks to delete");
  }

  const restoreRollback = (
    await runHarnessJson(consumerRoot, cliEntry, [
      "rollback-artifacts",
      "--root",
      restoreRoot,
      "--apply",
      "--json",
    ])
  ).json;

  if (!restoreRollback.ok || restoreRollback.apply !== true || restoreRollback.dryRun !== false) {
    throw new Error(`Unexpected restore rollback result: ${JSON.stringify(restoreRollback)}`);
  }
  if (
    !Array.isArray(restoreRollback.restoredPaths) ||
    !restoreRollback.restoredPaths.includes(restoreHookPath)
  ) {
    throw new Error(
      `Restore rollback did not report restoring gate-policy hook: ${JSON.stringify(
        restoreRollback,
      )}`,
    );
  }
  if (restoreRollback.restoredPaths.length !== 1) {
    throw new Error(
      `Restore rollback restored an unexpected number of artifacts: ${JSON.stringify(
        restoreRollback,
      )}`,
    );
  }
  if (restoreRollback.deletedPaths.includes(restoreHookPath)) {
    throw new Error(
      `Restore rollback reported deleting seeded hook: ${JSON.stringify(restoreRollback)}`,
    );
  }
  assertSamePathSet(
    restoreRollback.deletedPaths,
    expectedDeletedHookPaths,
    "Restore rollback deleted path set must exactly match newly installed hooks",
  );
  for (const deletedHookPath of expectedDeletedHookPaths) {
    await assertPathMissing(deletedHookPath, "Rollback restore must delete newly installed hook");
  }
  if ((await readFile(restoreHookPath, "utf8")) !== previousManagedHookContent) {
    throw new Error("Restore rollback did not restore previous managed gate-policy hook content");
  }

  const core = await import(pathToFileURL(coreEntry).href);
  const routeAssessment = await verifyPackagedCliRouteAssessment(consumerRoot, cliEntry, core);

  return {
    lifecycleHooksAdded: lifecycleApply.platformApplied.hooksAdded,
    lifecycleHooksRemoved: lifecycleUninstallMissingManifest.platformHooksRemoved,
    lifecycleArtifactsWritten: lifecycleApply.artifactsWritten.length,
    lifecycleBlockers: lifecycleBlockedUninstall.blockers.length,
    platformHooksAdded: platformInstall.applied.hooksAdded,
    platformHooksRemoved: platformUninstall.hooksRemoved,
    platformHooksRepaired: platformRepair.hooksAdded,
    installArtifactsWritten: install.artifactsWritten.length,
    rollbackDryRunDeleted: rollbackDryRun.deletedPaths.length,
    rollbackApplyDeleted: rollbackApply.deletedPaths.length,
    restoreInstallArtifactsWritten: restoreInstall.artifactsWritten.length,
    restoreRollbackDeleted: restoreRollback.deletedPaths.length,
    restoreRollbackRestored: restoreRollback.restoredPaths.length,
    ...routeAssessment,
  };
}

async function requestMcpServer(consumerRoot, mcpEntry, request) {
  const child = spawn(process.execPath, [mcpEntry], {
    cwd: consumerRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stderrChunks = [];
  child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
  let childClosed = false;
  const closePromise = new Promise((resolve) => {
    child.on("close", (code) => {
      childClosed = true;
      resolve(code);
    });
  });

  const responsePromise = new Promise((resolve, reject) => {
    let buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline === -1) {
        return;
      }

      const line = buffer.slice(0, newline).trim();
      try {
        resolve(JSON.parse(line));
      } catch (error) {
        reject(new Error(`MCP server returned invalid JSON: ${line}`, { cause: error }));
      }
    });
    child.on("error", reject);
    closePromise.then((code) => {
      if (code !== null && code !== 0) {
        reject(
          new Error(
            `MCP server exited with ${code}\nSTDERR:\n${Buffer.concat(stderrChunks).toString("utf8")}`,
          ),
        );
      }
    });
  });

  child.stdin.write(`${JSON.stringify(request)}\n`);

  try {
    return await responsePromise;
  } finally {
    child.stdin.end();
    if (!childClosed) {
      const killTimer = setTimeout(() => child.kill(), 1_000);
      try {
        await closePromise;
      } finally {
        clearTimeout(killTimer);
      }
    }
  }
}

async function requestMcpToolsList(consumerRoot, mcpEntry) {
  return requestMcpServer(consumerRoot, mcpEntry, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
}

async function requestMcpToolCall(consumerRoot, mcpEntry, name, args) {
  return requestMcpServer(consumerRoot, mcpEntry, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
  });
}

async function verifyPackagedMcpRouteAssessment(consumerRoot, cliEntry, core, mcpEntry) {
  const routeRoot = path.join(consumerRoot, "route-assessment-mcp-target");

  await seedDelegatedCodexRouteAssessment(consumerRoot, cliEntry, core, routeRoot);

  const beforePlanning = await snapshotPlanningTree(routeRoot);
  const response = await requestMcpToolCall(
    consumerRoot,
    mcpEntry,
    "rms.assess_route_runtime_bindings",
    { root: routeRoot },
  );
  const afterPlanning = await snapshotPlanningTree(routeRoot);

  if (response.error !== undefined || response.result?.isError === true) {
    throw new Error(
      `MCP route assessment call failed: ${JSON.stringify(response?.error ?? response?.result)}`,
    );
  }
  if (afterPlanning !== beforePlanning) {
    throw new Error(
      "MCP assess_route_runtime_bindings mutated .planning in packaged tarball smoke",
    );
  }

  const assessment = response.result?.structuredContent;
  if (typeof assessment !== "object" || assessment === null || Array.isArray(assessment)) {
    throw new Error(`MCP route assessment returned invalid payload: ${JSON.stringify(response)}`);
  }

  const asserted = assertDelegatedCodexRouteAssessment(assessment, "Packaged MCP route assessment");

  return {
    mcpRouteAssessRequiredGates: asserted.requiredGateCount,
    mcpRouteAssessGaps: asserted.gapCount,
    mcpRouteAssessSubagentStopBlocked: true,
    mcpRouteAssessReadOnly: true,
  };
}

async function verifyMcpServer(consumerRoot, cliEntry, coreEntry, mcpEntry) {
  const response = await requestMcpToolsList(consumerRoot, mcpEntry);
  const tools = response?.result?.tools;

  if (!Array.isArray(tools)) {
    throw new Error(`MCP tools/list did not return tools: ${JSON.stringify(response)}`);
  }
  for (const toolName of expectedMcpToolNames) {
    if (!tools.some((tool) => tool?.name === toolName)) {
      throw new Error(`MCP tools/list is missing ${toolName}`);
    }
  }

  const core = await import(pathToFileURL(coreEntry).href);
  const routeAssessment = await verifyPackagedMcpRouteAssessment(
    consumerRoot,
    cliEntry,
    core,
    mcpEntry,
  );

  return { mcpTools: tools.length, ...routeAssessment };
}

const tempRoot = await mkdtemp(path.join(tmpdir(), "hima-tarball-smoke-"));
const tarballRoot = path.join(tempRoot, "tarballs");
const consumerRoot = path.join(tempRoot, "consumer");

try {
  await rm(tarballRoot, { recursive: true, force: true });
  await rm(consumerRoot, { recursive: true, force: true });
  await mkdir(tarballRoot, { recursive: true });
  await mkdir(consumerRoot, { recursive: true });

  for (const packageName of packageNames) {
    debug(`checking dist for ${packageName}`);
    await assertBuiltPackage(packageName);
  }

  const tarballs = new Map();
  const packedPackages = [];
  for (const packageName of packageNames) {
    debug(`packing ${packageName}`);
    const packed = await packPackage(packageName, tarballRoot);
    tarballs.set(packageName, packed);
    packedPackages.push({
      packageName,
      ...(await verifyPackedPackage(packageName, packed.tarballPath)),
    });
  }

  debug("writing consumer project");
  await writeConsumerProject(consumerRoot, tarballs);
  debug("installing consumer dependencies");
  await runPnpm(["install", "--frozen-lockfile=false"], consumerRoot);
  debug("resolving installed core");
  const coreEntry = await resolveInstalledImport(consumerRoot, "@harness/core");
  debug("resolving installed cli");
  const cliEntry = await resolveInstalledImport(consumerRoot, "@harness/cli");
  debug("resolving installed mcp server");
  const mcpEntry = await resolveInstalledImport(consumerRoot, "@harness/mcp-server");
  debug("verifying core import");
  await verifyCoreImport(consumerRoot);
  debug("verifying cli artifacts");
  const cli = await verifyCliArtifacts(consumerRoot, cliEntry, coreEntry);
  debug("verifying mcp server");
  const mcp = await verifyMcpServer(consumerRoot, cliEntry, coreEntry, mcpEntry);

  console.log(
    JSON.stringify(
      {
        ok: true,
        packagesPacked: tarballs.size,
        packedPackages,
        temporaryConsumerProject: true,
        coreSkills: 10,
        ...cli,
        ...mcp,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
