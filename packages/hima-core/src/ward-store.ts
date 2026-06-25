import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  Ward,
  StageVerdict,
  decodeWard,
} from "@hima/schemas";
import {
  safeAtomicWriteFile,
  assertSafeWriteTarget,
  withFileLock,
} from "@hima/storage-core";

/**
 * ward-store — reads, creates, and advances the ward.json execution context.
 *
 * The ward is persisted at <root>/.hima/state/ward.json. All writes are
 * atomic (temp-rename) and guarded by a file lock so concurrent agents
 * do not corrupt state.
 *
 * Entry-point → initial openStage mapping (per ENTRYPOINTS-v3 + AMENDMENT-003):
 *   "full" (or its alias "ulw")  → "discovery"
 *   "run"                        → "spec"
 *   "spec"                       → "spec"
 */

/** Relative path from root to the ward state file. */
const WARD_REL = ".hima/state/ward.json";

/** Relative path for the directory lock used during writes. */
const LOCK_REL = ".hima/state/.ward-store.lock";

/** Options required to bootstrap a new ward. */
export interface CreateWardOpts {
  id: string;
  entryPoint: Ward["entryPoint"];
  floor: Ward["floor"];
}

/** Derive the initial openStage from an entryPoint. */
function initialStage(entryPoint: Ward["entryPoint"]): string {
  // full → discovery; run and spec → spec (ENTRYPOINTS-v3 floor rules)
  return entryPoint === "full" ? "discovery" : "spec";
}

/** Serialize a Ward to JSON content (pretty-printed, newline-terminated). */
function serialize(ward: Ward): string {
  return `${JSON.stringify(ward, null, 2)}\n`;
}

/**
 * createWard — bootstrap a fresh ward and persist it atomically.
 *
 * - Derives `openStage` from `entryPoint` (full→"discovery", run/spec→"spec").
 * - Starts with empty skillRegister and verdicts arrays.
 * - Validates the constructed value through the Ward decoder before writing.
 * - Writes to `<root>/.hima/state/ward.json` atomically under a file lock.
 *
 * @param root        Project root; all writes are restricted inside it.
 * @param opts        Ward identity (id, entryPoint, floor).
 * @returns           The newly created, persisted Ward.
 */
export async function createWard(root: string, opts: CreateWardOpts): Promise<Ward> {
  const wardPath = path.join(root, WARD_REL);
  const lockDir = path.join(root, LOCK_REL);

  const raw: Ward = {
    id: opts.id,
    entryPoint: opts.entryPoint,
    floor: opts.floor,
    openStage: initialStage(opts.entryPoint),
    skillRegister: [],
    verdicts: [],
  };

  // Validate through the Effect Schema decoder (throws on invalid input).
  const ward = decodeWard(raw);

  // Ensure the parent directory exists before attempting to acquire the lock.
  await mkdir(path.dirname(lockDir), { recursive: true });

  await withFileLock(lockDir, async () => {
    await assertSafeWriteTarget(root, wardPath);
    await safeAtomicWriteFile(root, wardPath, serialize(ward));
  });

  return ward;
}

/**
 * resumeWard — load an existing ward without overwriting it.
 *
 * Returns `null` if the ward file does not exist (ENOENT), indicating that
 * no run has been initialised under this root yet.
 *
 * @param root  Project root.
 * @returns     The persisted Ward, or null if none exists.
 */
export async function resumeWard(root: string): Promise<Ward | null> {
  const wardPath = path.join(root, WARD_REL);

  let raw: string;
  try {
    raw = await readFile(wardPath, "utf8");
  } catch (error: unknown) {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  }

  // Validate through the Effect Schema decoder (throws on invalid/corrupt file).
  return decodeWard(JSON.parse(raw));
}

/**
 * advanceStage — record a verdict for the current openStage and move to a
 * new stage atomically.
 *
 * The previous `openStage` verdict (with the given status and no evidence) is
 * appended to `ward.verdicts`. Then `openStage` is set to `stage`.
 *
 * @param root    Project root.
 * @param stage   The stage to advance to (becomes the new `openStage`).
 * @param status  The verdict status to record for the stage being closed.
 * @returns       The updated, persisted Ward.
 */
export async function advanceStage(
  root: string,
  stage: string,
  status: StageVerdict["status"],
): Promise<Ward> {
  const wardPath = path.join(root, WARD_REL);
  const lockDir = path.join(root, LOCK_REL);

  // Ensure the state directory exists (it should after createWard, but be defensive).
  await mkdir(path.dirname(lockDir), { recursive: true });

  return withFileLock(lockDir, async () => {
    // Re-read inside the lock to avoid lost-update.
    const raw = await readFile(wardPath, "utf8");
    const current = decodeWard(JSON.parse(raw));

    const closingVerdict: StageVerdict = {
      stage: current.openStage,
      status,
      evidence: [],
    };

    const updated: Ward = {
      ...current,
      openStage: stage,
      verdicts: [...current.verdicts, closingVerdict],
    };

    // Validate before persisting.
    const validated = decodeWard(updated);

    await assertSafeWriteTarget(root, wardPath);
    await safeAtomicWriteFile(root, wardPath, serialize(validated));

    return validated;
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "ENOENT"
  );
}
