import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Schema } from "effect";
import { SkillRef, decodeSkillRef } from "@norm/schemas";
import { safeAtomicWriteFile } from "@norm/storage-core";

/**
 * skill-state — session skill register persisted at .hima/state/skill-sessions.json.
 *
 * The register is a JSON array of SkillRef objects. It tracks which skills have been
 * loaded in the current session so gate handlers can avoid re-injecting them.
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §3.1 (skill routing).
 */

const REGISTER_RELATIVE_PATH = ".hima/state/skill-sessions.json";

const SkillRefArray = Schema.Array(SkillRef);
const decodeSkillRefArray = Schema.decodeUnknownSync(SkillRefArray);

/** Resolve the absolute path to the register file for a given project root. */
function registerPath(root: string): string {
  return path.resolve(root, REGISTER_RELATIVE_PATH);
}

/**
 * Read the skill register from disk.
 * Returns an empty array if the file does not exist yet.
 */
export async function readRegister(root: string): Promise<SkillRef[]> {
  const filePath = registerPath(root);
  try {
    const raw = await readFile(filePath, "utf8");
    return [...decodeSkillRefArray(JSON.parse(raw))];
  } catch (error) {
    // ENOENT → register does not exist yet; return empty
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return [];
    }
    // JSON parse or schema decode failure — treat as corrupt, return empty
    // (non-fatal: the session will rebuild the register)
    if (error instanceof SyntaxError || isEffectParseError(error)) {
      return [];
    }
    throw error;
  }
}

/**
 * Check whether a given SkillRef is already present in the register.
 * Matching is by `source` AND `id` (both fields must match).
 */
export function isLoaded(register: SkillRef[], ref: SkillRef): boolean {
  return register.some((entry) => entry.source === ref.source && entry.id === ref.id);
}

/**
 * Mark a skill as loaded in the register.
 * Reads the current register, deduplicates, and writes atomically.
 * If the ref is already present, the file is not rewritten (no-op).
 */
export async function markLoaded(root: string, ref: SkillRef): Promise<void> {
  // Validate the incoming ref early (throws on invalid input)
  const validatedRef: SkillRef = decodeSkillRef(ref);

  const current = await readRegister(root);

  if (isLoaded(current, validatedRef)) {
    // Already present — deduplicate, nothing to write
    return;
  }

  const updated: SkillRef[] = [...current, validatedRef];
  const content = `${JSON.stringify(updated, null, 2)}\n`;

  // Ensure the parent directory exists before the atomic write
  const filePath = registerPath(root);
  await mkdir(path.dirname(filePath), { recursive: true });

  await safeAtomicWriteFile(root, filePath, content);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

function isEffectParseError(error: unknown): boolean {
  // Effect parse errors carry a _tag or message containing "ParseError"
  if (typeof error === "object" && error !== null) {
    const tag = (error as Record<string, unknown>)["_tag"];
    if (tag === "ParseError") return true;
    const name = (error as Record<string, unknown>)["name"];
    if (typeof name === "string" && name.includes("ParseError")) return true;
  }
  return false;
}
