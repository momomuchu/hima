import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = path.join(repoRoot, "packages", "cli", "dist", "index.js");
const catalogMarker =
  "<!-- HIMA:CATALOG-ARTIFACT kind=skill id=classify-risk source=operational-catalog -->";
const hookCatalogMarker =
  "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->";
const preToolHookCommand = "harness hook pre-tool-use";

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

async function runCli(args) {
  const child = spawn(process.execPath, [cliEntry, ...args], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
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

  if (exitCode !== 0) {
    throw new Error(`CLI exited with ${exitCode}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`CLI did not print valid JSON:\n${stdout}`, { cause: error });
  }
}

await assertPathExists(cliEntry, "Built CLI dist entry is required before package smoke");

const tempRoot = await mkdtemp(path.join(tmpdir(), "hima-package-smoke-"));
const lifecycleRoot = path.join(tempRoot, "lifecycle-target");
const platformRoot = path.join(tempRoot, "platform-target");
const artifactRoot = path.join(tempRoot, "artifact-target");
const restoreRoot = path.join(tempRoot, "restore-target");
const lifecycleSkillPath = path.join(
  lifecycleRoot,
  ".codex",
  "skills",
  "classify-risk",
  "SKILL.md",
);
const lifecycleArtifactManifestPath = path.join(
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
const skillPath = path.join(artifactRoot, ".codex", "skills", "classify-risk", "SKILL.md");
const artifactManifestPath = path.join(artifactRoot, ".planning", "artifact-install-manifest.json");
const restoreHookPath = path.join(restoreRoot, ".codex", "hooks", "gate-policy.md");
const restoreArtifactManifestPath = path.join(
  restoreRoot,
  ".planning",
  "artifact-install-manifest.json",
);
const platformManifestPath = path.join(platformRoot, ".planning", "install-manifest.json");
const codexConfigPath = path.join(platformRoot, ".codex", "config.toml");
const previousManagedHookContent = [
  hookCatalogMarker,
  "",
  "# Previous managed gate policy",
  "",
].join("\n");

try {
  const lifecycleDryRun = await runCli([
    "lifecycle",
    "apply",
    "codex",
    "--root",
    lifecycleRoot,
    "--kind",
    "skills",
    "--json",
  ]);

  if (!lifecycleDryRun.ok || lifecycleDryRun.apply !== false || lifecycleDryRun.dryRun !== true) {
    throw new Error(`Unexpected lifecycle dry-run result: ${JSON.stringify(lifecycleDryRun)}`);
  }
  if (lifecycleDryRun.artifactsWritten.length !== 0) {
    throw new Error(`Lifecycle dry-run wrote artifacts: ${JSON.stringify(lifecycleDryRun)}`);
  }
  await assertPathMissing(
    lifecycleCodexConfigPath,
    "Lifecycle dry-run must not write Codex config",
  );
  await assertPathMissing(
    lifecycleSkillPath,
    "Lifecycle dry-run must not write classify-risk skill",
  );

  const lifecycleApply = await runCli([
    "lifecycle",
    "apply",
    "codex",
    "--root",
    lifecycleRoot,
    "--kind",
    "skills",
    "--apply",
    "--json",
  ]);

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
      `Lifecycle apply did not add platform hooks: ${JSON.stringify(lifecycleApply)}`,
    );
  }
  if (lifecycleApply.artifactsWritten.length === 0) {
    throw new Error(`Lifecycle apply did not write artifacts: ${JSON.stringify(lifecycleApply)}`);
  }
  await assertPathExists(
    lifecyclePlatformManifestPath,
    "Lifecycle apply must write platform install manifest",
  );
  await assertPathExists(
    lifecycleArtifactManifestPath,
    "Lifecycle apply must write artifact install manifest",
  );
  await assertPathExists(lifecycleCodexConfigPath, "Lifecycle apply must write Codex config");
  await assertPathExists(lifecycleSkillPath, "Lifecycle apply must write classify-risk skill");
  if (!(await readFile(lifecycleCodexConfigPath, "utf8")).includes(preToolHookCommand)) {
    throw new Error("Lifecycle apply did not write the canonical pre_tool hook command");
  }

  await rm(lifecycleArtifactManifestPath);
  const lifecycleUninstallMissingArtifactManifest = await runCli([
    "lifecycle",
    "uninstall",
    "--root",
    lifecycleRoot,
    "--apply",
    "--json",
  ]);

  if (
    !lifecycleUninstallMissingArtifactManifest.ok ||
    lifecycleUninstallMissingArtifactManifest.platformHooksRemoved <= 0 ||
    lifecycleUninstallMissingArtifactManifest.artifactRollback?.skipped !== true
  ) {
    throw new Error(
      `Lifecycle uninstall did not remove hooks with missing artifact manifest: ${JSON.stringify(
        lifecycleUninstallMissingArtifactManifest,
      )}`,
    );
  }
  if ((await readFile(lifecycleCodexConfigPath, "utf8")).includes(preToolHookCommand)) {
    throw new Error("Lifecycle uninstall did not remove the canonical pre_tool hook command");
  }

  const platformInstall = await runCli([
    "install",
    "codex",
    "--root",
    platformRoot,
    "--apply",
    "--writeManifest",
    "--json",
  ]);

  if (platformInstall?.applied?.target !== "codex" || platformInstall.applied.hooksAdded <= 0) {
    throw new Error(`Unexpected platform install result: ${JSON.stringify(platformInstall)}`);
  }
  await assertPathExists(platformManifestPath, "Platform install must write install manifest");
  await assertPathExists(codexConfigPath, "Platform install must write Codex config");

  const platformConfig = await readFile(codexConfigPath, "utf8");
  if (!platformConfig.includes(preToolHookCommand)) {
    throw new Error("Platform install did not write the canonical pre_tool hook command");
  }

  const platformUninstallDryRun = await runCli([
    "uninstall-platform",
    "--root",
    platformRoot,
    "--json",
  ]);

  if (
    !platformUninstallDryRun.ok ||
    platformUninstallDryRun.apply !== false ||
    platformUninstallDryRun.hooksRemoved !== 0
  ) {
    throw new Error(
      `Unexpected platform uninstall dry-run result: ${JSON.stringify(platformUninstallDryRun)}`,
    );
  }
  if ((await readFile(codexConfigPath, "utf8")) !== platformConfig) {
    throw new Error("Platform uninstall dry-run mutated Codex config");
  }

  const platformUninstall = await runCli([
    "uninstall-platform",
    "--root",
    platformRoot,
    "--apply",
    "--json",
  ]);

  if (!platformUninstall.ok || platformUninstall.hooksRemoved <= 0) {
    throw new Error(`Unexpected platform uninstall result: ${JSON.stringify(platformUninstall)}`);
  }
  if ((await readFile(codexConfigPath, "utf8")).includes(preToolHookCommand)) {
    throw new Error("Platform uninstall did not remove the canonical pre_tool hook command");
  }
  await assertPathExists(platformManifestPath, "Platform uninstall must retain install manifest");

  const platformRepair = await runCli([
    "repair-platform",
    "--root",
    platformRoot,
    "--apply",
    "--json",
  ]);

  if (!platformRepair.ok || platformRepair.hooksAdded <= 0) {
    throw new Error(`Unexpected platform repair result: ${JSON.stringify(platformRepair)}`);
  }
  if (!(await readFile(codexConfigPath, "utf8")).includes(preToolHookCommand)) {
    throw new Error("Platform repair did not restore the canonical pre_tool hook command");
  }

  const dryRun = await runCli([
    "install-artifacts",
    "codex",
    "--root",
    artifactRoot,
    "--kind",
    "skills",
    "--json",
  ]);

  if (!dryRun.ok || dryRun.apply !== false || dryRun.dryRun !== true) {
    throw new Error(`Unexpected dry-run result: ${JSON.stringify(dryRun, null, 2)}`);
  }
  if (!Array.isArray(dryRun.artifactsWritten) || dryRun.artifactsWritten.length !== 0) {
    throw new Error(`Dry-run wrote artifacts: ${JSON.stringify(dryRun.artifactsWritten)}`);
  }
  await assertPathMissing(
    path.join(artifactRoot, ".codex"),
    "Dry-run must not create Codex directory",
  );
  await assertPathMissing(skillPath, "Dry-run must not write classify-risk skill");

  const apply = await runCli([
    "install-artifacts",
    "codex",
    "--root",
    artifactRoot,
    "--kind",
    "skills",
    "--apply",
    "--writeManifest",
    "--json",
  ]);

  if (!apply.ok || apply.apply !== true || apply.dryRun !== false) {
    throw new Error(`Unexpected apply result: ${JSON.stringify(apply, null, 2)}`);
  }
  if (!Array.isArray(apply.artifactsWritten) || apply.artifactsWritten.length === 0) {
    throw new Error("Apply did not report written artifacts");
  }
  if (apply.manifestFile !== artifactManifestPath) {
    throw new Error(`Apply did not report the expected manifest file: ${apply.manifestFile}`);
  }
  await assertPathExists(artifactManifestPath, "Apply must write artifact install manifest");

  const skill = await readFile(skillPath, "utf8");
  if (!skill.includes(catalogMarker)) {
    throw new Error(`Installed classify-risk skill is missing marker: ${catalogMarker}`);
  }

  const rollbackDryRun = await runCli(["rollback-artifacts", "--root", artifactRoot, "--json"]);

  if (!rollbackDryRun.ok || rollbackDryRun.apply !== false || rollbackDryRun.dryRun !== true) {
    throw new Error(
      `Unexpected rollback dry-run result: ${JSON.stringify(rollbackDryRun, null, 2)}`,
    );
  }
  if (
    !Array.isArray(rollbackDryRun.deletedPaths) ||
    rollbackDryRun.deletedPaths.length !== 0 ||
    rollbackDryRun.artifactsDeleted !== 0
  ) {
    throw new Error(
      `Rollback dry-run deleted artifacts: ${JSON.stringify(rollbackDryRun, null, 2)}`,
    );
  }
  await assertPathExists(skillPath, "Rollback dry-run must not delete classify-risk skill");

  const rollbackApply = await runCli([
    "rollback-artifacts",
    "--root",
    artifactRoot,
    "--apply",
    "--json",
  ]);

  if (!rollbackApply.ok || rollbackApply.apply !== true || rollbackApply.dryRun !== false) {
    throw new Error(`Unexpected rollback apply result: ${JSON.stringify(rollbackApply, null, 2)}`);
  }
  if (
    !Array.isArray(rollbackApply.deletedPaths) ||
    !rollbackApply.deletedPaths.includes(skillPath)
  ) {
    throw new Error(
      `Rollback apply did not report deleting classify-risk skill: ${JSON.stringify(rollbackApply, null, 2)}`,
    );
  }
  await assertPathMissing(skillPath, "Rollback apply must delete classify-risk skill");

  await mkdir(path.dirname(restoreHookPath), { recursive: true });
  await writeFile(restoreHookPath, previousManagedHookContent, "utf8");

  const restoreInstall = await runCli([
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
  ]);

  if (
    !restoreInstall.ok ||
    restoreInstall.apply !== true ||
    restoreInstall.dryRun !== false ||
    restoreInstall.captureRestoreSnapshots !== true
  ) {
    throw new Error(
      `Unexpected restore install-artifacts result: ${JSON.stringify(restoreInstall, null, 2)}`,
    );
  }
  if (restoreInstall.manifestFile !== restoreArtifactManifestPath) {
    throw new Error(
      `Restore install did not report the expected manifest file: ${restoreInstall.manifestFile}`,
    );
  }

  const restoreEntry = restoreInstall.manifest.entries.find(
    (entry) => entry.kind === "hook" && entry.id === "gate-policy",
  );
  if (restoreEntry?.rollback?.restoreSnapshot?.content !== previousManagedHookContent) {
    throw new Error(
      `Restore manifest did not capture previous managed hook content: ${JSON.stringify(
        restoreEntry,
        null,
        2,
      )}`,
    );
  }

  const restoreManifest = JSON.parse(await readFile(restoreArtifactManifestPath, "utf8"));
  const restoreManifestEntry = restoreManifest.entries.find(
    (entry) => entry.kind === "hook" && entry.id === "gate-policy",
  );
  if (restoreManifestEntry?.rollback?.restoreSnapshot?.content !== previousManagedHookContent) {
    throw new Error(
      `Written restore manifest did not preserve previous managed hook content: ${JSON.stringify(
        restoreManifestEntry,
        null,
        2,
      )}`,
    );
  }
  const expectedDeletedHookPaths = restoreManifest.entries
    .filter((entry) => entry.kind === "hook" && entry.id !== "gate-policy")
    .map((entry) => entry.path);
  if (expectedDeletedHookPaths.length === 0) {
    throw new Error("Restore smoke did not find any newly installed hooks to delete");
  }

  const restoreRollback = await runCli([
    "rollback-artifacts",
    "--root",
    restoreRoot,
    "--apply",
    "--json",
  ]);

  if (!restoreRollback.ok || restoreRollback.apply !== true || restoreRollback.dryRun !== false) {
    throw new Error(
      `Unexpected restore rollback result: ${JSON.stringify(restoreRollback, null, 2)}`,
    );
  }
  if (
    !Array.isArray(restoreRollback.restoredPaths) ||
    !restoreRollback.restoredPaths.includes(restoreHookPath)
  ) {
    throw new Error(
      `Restore rollback did not report restoring gate-policy hook: ${JSON.stringify(
        restoreRollback,
        null,
        2,
      )}`,
    );
  }
  if (restoreRollback.restoredPaths.length !== 1) {
    throw new Error(
      `Restore rollback restored an unexpected number of artifacts: ${JSON.stringify(
        restoreRollback,
        null,
        2,
      )}`,
    );
  }
  if (restoreRollback.deletedPaths.includes(restoreHookPath)) {
    throw new Error(
      `Restore rollback reported deleting the seeded gate-policy hook: ${JSON.stringify(
        restoreRollback,
        null,
        2,
      )}`,
    );
  }
  assertSamePathSet(
    restoreRollback.deletedPaths,
    expectedDeletedHookPaths,
    "Restore rollback deleted path set must exactly match newly installed hooks",
  );
  await assertPathExists(restoreHookPath, "Rollback restore must leave seeded hook in place");
  for (const deletedHookPath of expectedDeletedHookPaths) {
    await assertPathMissing(deletedHookPath, "Rollback restore must delete newly installed hook");
  }
  if ((await readFile(restoreHookPath, "utf8")) !== previousManagedHookContent) {
    throw new Error("Rollback restore did not restore the previous managed hook content");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        lifecycleDryRunArtifactsWritten: lifecycleDryRun.artifactsWritten.length,
        lifecycleApplyArtifactsWritten: lifecycleApply.artifactsWritten.length,
        lifecycleHooksAdded: lifecycleApply.platformApplied.hooksAdded,
        lifecycleHooksRemoved: lifecycleUninstallMissingArtifactManifest.platformHooksRemoved,
        platformHooksAdded: platformInstall.applied.hooksAdded,
        platformUninstallDryRunRemoved: platformUninstallDryRun.hooksRemoved,
        platformHooksRemoved: platformUninstall.hooksRemoved,
        platformHooksRepaired: platformRepair.hooksAdded,
        dryRunArtifactsWritten: dryRun.artifactsWritten.length,
        applyArtifactsWritten: apply.artifactsWritten.length,
        rollbackDryRunDeleted: rollbackDryRun.deletedPaths.length,
        rollbackApplyDeleted: rollbackApply.deletedPaths.length,
        restoreApplyArtifactsWritten: restoreInstall.artifactsWritten.length,
        restoreRollbackDeleted: restoreRollback.deletedPaths.length,
        restoreRollbackRestored: restoreRollback.restoredPaths.length,
        verifiedPath: path.relative(repoRoot, skillPath),
        restoredPath: path.relative(repoRoot, restoreHookPath),
      },
      null,
      2,
    ),
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
