import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  DEV_CYCLE,
  Ward,
  StageVerdict,
  decodeWard,
} from "@hima/schemas";
import {
  safeAtomicWriteFile,
  assertSafeWriteTarget,
  withFileLock,
} from "@hima/storage-core";
import { resumeWard } from "./ward-store.js";

/**
 * ward-transitions — cycle-transition guards and archival for the ward.
 *
 * This module provides three exported functions:
 *
 *   checkStageGate    — pure predecessor-seal check (R-042, R-052)
 *   writeStageVerdict — atomic verdict push/replace + openStage advance (R-043)
 *   closeWard         — ledger archival when verify is complete
 *
 * All writes share the same file-lock path as ward-store.ts to prevent
 * concurrent corruption without requiring a direct dependency on internal
 * ward-store constants (they are re-declared here, mirroring the source).
 *
 * See: gap register R-006, R-007, R-021, R-040, R-042, R-043, R-052, R-054.
 */

// ---------------------------------------------------------------------------
// Internal constants (mirrored from ward-store.ts — must use the same lock)
// ---------------------------------------------------------------------------

/** Relative path from root to the ward state file. */
const WARD_REL = ".hima/state/ward.json";

/**
 * Relative path for the directory-lock used during ward writes.
 * Must be identical to the one used in ward-store.ts so all writers compete
 * on the same lock and never corrupt each other's writes.
 */
const LOCK_REL = ".hima/state/.ward-store.lock";

/** Relative path to the ledger directory for archived ward snapshots. */
const LEDGER_DIR_REL = ".hima/state/ledger";

/** Relative path for the per-root closed marker file. */
const CLOSED_MARKER_REL = ".hima/state/.ward-closed";

// ---------------------------------------------------------------------------
// Stage order derived from DEV_CYCLE (single source of truth)
// ---------------------------------------------------------------------------

/** Ordered stage IDs taken directly from the canonical DEV_CYCLE definition. */
const STAGE_ORDER: readonly string[] = DEV_CYCLE.stages.map((s) => s.id);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Status values that fully seal a stage, making it eligible as a resolved
 * predecessor for later stages.
 *
 * "blocked" and "partial" are NOT sealed — they indicate incomplete or
 * halted work and must not unblock downstream stages.
 */
const SEALED_STATUSES = new Set<string>(["done", "done-verified", "done-validated"]);

function isSealed(status: StageVerdict["status"]): boolean {
  return SEALED_STATUSES.has(status);
}

function serialize(ward: Ward): string {
  return `${JSON.stringify(ward, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// checkStageGate
// ---------------------------------------------------------------------------

/**
 * checkStageGate — pure predecessor-seal check for a target stage.
 *
 * Returns `{ ok: true }` when all predecessor stages in DEV_CYCLE order have a
 * sealed verdict (done / done-verified / done-validated) in `ward.verdicts`.
 *
 * The "discovery" stage (first in DEV_CYCLE) has no predecessors and is always
 * allowed. Stages not present in DEV_CYCLE are also always allowed (no gate
 * can be applied to an unknown stage).
 *
 * @param ward         The current ward state to inspect.
 * @param targetStage  The stage being entered or about to be sealed.
 * @returns            `{ ok: true }` or `{ ok: false, reason: string }`.
 */
export function checkStageGate(
  ward: Ward,
  targetStage: string,
): { ok: boolean; reason?: string } {
  const targetIdx = STAGE_ORDER.indexOf(targetStage);

  // discovery (idx 0) or unknown stage — no predecessor gate to enforce.
  if (targetIdx <= 0) {
    return { ok: true };
  }

  const predecessors = STAGE_ORDER.slice(0, targetIdx);

  for (const predecessor of predecessors) {
    const verdict = ward.verdicts.find((v) => v.stage === predecessor);
    if (!verdict || !isSealed(verdict.status)) {
      const found = verdict?.status ?? "no verdict";
      return {
        ok: false,
        reason:
          `predecessor stage "${predecessor}" is not sealed ` +
          `(requires done, done-verified, or done-validated; found: ${found})`,
      };
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// writeStageVerdict
// ---------------------------------------------------------------------------

/**
 * writeStageVerdict — push or replace a StageVerdict for the given stage,
 * then advance the ward's openStage to the next DEV_CYCLE stage.
 *
 * Behaviour:
 *   - If a verdict for `stage` already exists in `ward.verdicts`, it is replaced.
 *   - Otherwise a new verdict entry is appended.
 *   - `ward.openStage` is advanced to the next stage in STAGE_ORDER after `stage`.
 *     When `stage` is the last stage (maintenance), `openStage` stays at maintenance.
 *     When `stage` is not in DEV_CYCLE, `openStage` is unchanged.
 *
 * Guards:
 *   - Throws when `status` is "done-verified" or "done-validated" and any
 *     predecessor stage in DEV_CYCLE is not yet sealed in `ward.verdicts`.
 *   - Throws when no ward exists at `root`.
 *
 * Atomicity:
 *   The write is performed inside the same file-lock used by ward-store.ts
 *   (`LOCK_REL`). The ward file is re-read inside the lock to prevent
 *   lost-update races between concurrent agents.
 *
 * @param root      Project root; all writes are restricted inside it.
 * @param stage     The stage to record a verdict for.
 * @param status    The outcome to record.
 * @param evidence  Supporting evidence strings (default: empty array).
 * @returns         The updated, persisted Ward.
 */
export async function writeStageVerdict(
  root: string,
  stage: string,
  status: StageVerdict["status"],
  evidence: string[] = [],
): Promise<Ward> {
  const wardPath = path.join(root, WARD_REL);
  const lockDir = path.join(root, LOCK_REL);

  // Ensure the state directory exists before attempting to acquire the lock.
  await mkdir(path.dirname(lockDir), { recursive: true });

  return withFileLock(lockDir, async () => {
    // Re-read inside the lock to prevent lost updates.
    const rawContent = await readFile(wardPath, "utf8");
    const current = decodeWard(JSON.parse(rawContent));

    // Guard: stronger statuses require all predecessors to already be sealed.
    if (status === "done-verified" || status === "done-validated") {
      const gate = checkStageGate(current, stage);
      if (!gate.ok) {
        throw new Error(
          `Cannot mark stage "${stage}" as "${status}": ${gate.reason}`,
        );
      }
    }

    // Push or replace the verdict for this stage (last-write wins).
    const newVerdict: StageVerdict = { stage, status, evidence };
    const verdicts: StageVerdict[] = [
      ...current.verdicts.filter((v) => v.stage !== stage),
      newVerdict,
    ];

    // Advance openStage to the next DEV_CYCLE stage.
    const stageIdx = STAGE_ORDER.indexOf(stage);
    let nextOpenStage: string;
    if (stageIdx < 0) {
      // Stage not in DEV_CYCLE — preserve current openStage.
      nextOpenStage = current.openStage;
    } else if (stageIdx >= STAGE_ORDER.length - 1) {
      // Last stage (maintenance) — stay.
      nextOpenStage = stage;
    } else {
      nextOpenStage = STAGE_ORDER[stageIdx + 1]!;
    }

    const updated: Ward = {
      ...current,
      openStage: nextOpenStage,
      verdicts,
    };

    // Validate through the Effect Schema decoder before writing.
    const validated = decodeWard(updated);

    await assertSafeWriteTarget(root, wardPath);
    await safeAtomicWriteFile(root, wardPath, serialize(validated));

    return validated;
  });
}

// ---------------------------------------------------------------------------
// closeWard
// ---------------------------------------------------------------------------

/**
 * closeWard — archive the ward to the ledger when the verify stage is complete.
 *
 * Preconditions (throws on violation):
 *   - A ward must exist at `root` (resumeWard non-null).
 *   - The `verify` stage must have a sealed verdict (done / done-verified /
 *     done-validated) in `ward.verdicts`.
 *
 * Actions:
 *   1. Writes the current ward state as a single JSONL line to:
 *      `<root>/.hima/state/ledger/<ward.id>-<safeTs>.jsonl`
 *      where `safeTs` is `isoTs` with `:` replaced by `-` for filesystem safety.
 *   2. Writes a closed marker to:
 *      `<root>/.hima/state/.ward-closed`
 *      containing `{ wardId, closedAt, ledgerPath }`.
 *
 * Both writes use `safeAtomicWriteFile` (temp-rename) for atomicity.
 *
 * @param root   Project root; all writes are restricted inside it.
 * @param isoTs  ISO-8601 timestamp string for the ledger filename.
 *               Pass an explicit value in tests to keep them deterministic.
 *               Defaults to `new Date().toISOString()` in production.
 */
export async function closeWard(
  root: string,
  isoTs: string = new Date().toISOString(),
): Promise<void> {
  const ward = await resumeWard(root);
  if (!ward) {
    throw new Error("closeWard: no ward found at root");
  }

  // Guard: verify stage must be sealed before archiving.
  const verifyVerdict = ward.verdicts.find((v) => v.stage === "verify");
  if (!verifyVerdict || !isSealed(verifyVerdict.status)) {
    const found = verifyVerdict?.status ?? "no verdict";
    throw new Error(
      `closeWard: verify stage must be sealed before closing the ward ` +
        `(found: ${found})`,
    );
  }

  // Sanitise the timestamp for use in a filename (colons are problematic on
  // some filesystems and confusing in paths even where allowed).
  const safeTs = isoTs.replace(/:/g, "-");

  // ── 1. Write ledger snapshot ───────────────────────────────────────────────
  const ledgerPath = path.join(
    root,
    LEDGER_DIR_REL,
    `${ward.id}-${safeTs}.jsonl`,
  );
  const ledgerLine = `${JSON.stringify(ward)}\n`;
  await assertSafeWriteTarget(root, ledgerPath);
  await safeAtomicWriteFile(root, ledgerPath, ledgerLine);

  // ── 2. Write closed marker ─────────────────────────────────────────────────
  const markerPath = path.join(root, CLOSED_MARKER_REL);
  const marker = { wardId: ward.id, closedAt: isoTs, ledgerPath };
  const markerContent = `${JSON.stringify(marker)}\n`;
  await assertSafeWriteTarget(root, markerPath);
  await safeAtomicWriteFile(root, markerPath, markerContent);
}
