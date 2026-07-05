/**
 * spawn-manifest — R-035 live role-spawn manifest gate (advisory-strong).
 *
 * Provides I/O helpers for the spawn manifest file that signals which roles
 * have been assigned for a given ward + stage. The coordinator writes the
 * manifest immediately after ward creation and emits role assignments as
 * additionalContext. The StageParallelizationGate reads `hasSpawnManifest`
 * in handlePreToolUse to confirm the spawn wave was issued before allowing
 * writes in a non-discovery stage.
 *
 * File path: `<root>/.hima/state/spawn-manifest-<wardId>-<stage>.json`
 *
 * Advisory contract: the gate is advisory-strong (not hard-blocking) to avoid
 * bricking the pipeline when roles are not yet Task-spawnable in a given
 * runtime. The manifest is the signal that the spawn instruction was emitted;
 * actual Task creation is the agent's responsibility.
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-035,
 *      PARALLELIZATION-v3.md §1 (role catalog), AMENDMENT-002.
 */

import { access } from "node:fs/promises";
import path from "node:path";
import { safeAtomicWriteFile } from "@norm/storage-core";

// ---------------------------------------------------------------------------
// SpawnManifest type
// ---------------------------------------------------------------------------

/**
 * The JSON payload written to the spawn manifest file.
 * `roles` is the list of role names assigned for this ward + stage.
 */
export type SpawnManifest = {
  wardId: string;
  stage: string;
  roles: string[];
  ts: string;
};

// ---------------------------------------------------------------------------
// Path helper
// ---------------------------------------------------------------------------

/**
 * Canonical absolute path for the per-ward-stage spawn manifest file.
 *
 * `<root>/.hima/state/spawn-manifest-<wardId>-<stage>.json`
 */
export function spawnManifestPath(root: string, wardId: string, stage: string): string {
  return path.join(root, ".hima", "state", `spawn-manifest-${wardId}-${stage}.json`);
}

// ---------------------------------------------------------------------------
// writeSpawnManifest
// ---------------------------------------------------------------------------

/**
 * Write the spawn manifest for `wardId` + `stage` to disk.
 *
 * The manifest records which roles have been assigned so `hasSpawnManifest`
 * can confirm the spawn instruction was issued in a subsequent gate check.
 * Uses atomic write via `@norm/storage-core` to prevent partial writes.
 *
 * @param root      Project root; writes are confined inside it by safeAtomicWriteFile.
 * @param wardId    Ward identifier (e.g. "run-20260630-abc123").
 * @param stage     Stage identifier (e.g. "discovery", "spec", "design").
 * @param roleNames Names of the roles assigned for this stage.
 */
export async function writeSpawnManifest(
  root: string,
  wardId: string,
  stage: string,
  roleNames: string[],
): Promise<void> {
  const filePath = spawnManifestPath(root, wardId, stage);
  const payload: SpawnManifest = {
    wardId,
    stage,
    roles: roleNames,
    ts: new Date().toISOString(),
  };
  await safeAtomicWriteFile(root, filePath, JSON.stringify(payload, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// hasSpawnManifest
// ---------------------------------------------------------------------------

/**
 * Return `true` when a spawn manifest exists for `wardId` + `stage`.
 *
 * Used by the StageParallelizationGate in handlePreToolUse to confirm the
 * spawn instruction was emitted before allowing writes in a non-discovery stage.
 * Returns `false` on any access error (ENOENT or otherwise) — fail-open for
 * the advisory-strong design: absence of the manifest triggers a warning
 * injection, not a hard block.
 *
 * @param root    Project root.
 * @param wardId  Ward identifier.
 * @param stage   Stage identifier.
 */
export async function hasSpawnManifest(
  root: string,
  wardId: string,
  stage: string,
): Promise<boolean> {
  const filePath = spawnManifestPath(root, wardId, stage);
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// buildSpawnAssignmentContext
// ---------------------------------------------------------------------------

/**
 * Build the additionalContext string that instructs the agent to spawn
 * the given roles as Task subagents with explicit model fields.
 *
 * Format:
 *   "[HIMA spawn] stage <stage> role-team: <role1, role2, ...> — spawn these
 *    as Task subagents (explicit model each)."
 *
 * This is the advisory mechanism: the handler emits this string as context
 * so the agent spawns the roles; actual Task creation is the agent's
 * responsibility. A hard gate is out of scope to avoid bricking — advisory only.
 *
 * @param stage  Stage identifier (e.g. "discovery", "design").
 * @param roles  Array of role descriptor objects with at least a `role` string.
 */
export function buildSpawnAssignmentContext(
  stage: string,
  roles: { role: string }[],
): string {
  const roleNames = roles.map((r) => r.role).join(", ");
  return `[HIMA spawn] stage ${stage} role-team: ${roleNames} — spawn these as Task subagents (explicit model each).`;
}
