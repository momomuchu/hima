/**
 * rules-engine/index.ts — path-scoped rule discovery and injection.
 *
 * Primary API: `resolveRulesForPath(root, targetPath, opts?)`.
 *
 * Given a project root and the absolute path of a file being touched by an
 * agent tool, this function:
 *   1. Discovers rule files from sources in precedence order:
 *        .hima/rules/ (0) > .claude/rules/ (1) > .cursor/rules/ (2)
 *      Scans each directory for *.md and *.mdc files.
 *   2. Parses each rule's frontmatter.
 *   3. Includes the rule when:
 *        a. `alwaysApply: true`, OR
 *        b. `ruleMatches(globs, relPath, basename)` returns true.
 *   4. Deduplicates by realpath (same file reachable via different paths
 *      is only injected once).
 *   5. Session dedup: when `sessionId` is provided, rules already injected
 *      for that session (tracked in .hima/state/injected-rules-<sessionId>.json)
 *      are skipped; newly injected rules are recorded.
 *   6. Returns the joined body text and the list of matched file paths.
 *   7. Never throws on a missing rules directory.
 *
 * See: SPEC-006-rules-engine-injection.md [CRITICAL][BLOCKS:critical],
 *      [HIGH][BLOCKS:high] sections.
 */

import os from "node:os";
import path from "node:path";
import { access, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import { parseRuleFrontmatter } from "./frontmatter.js";
import { ruleMatches } from "./matcher.js";
import { safeAtomicWriteFile } from "@hima/storage-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResolveRulesOpts = {
  /**
   * Session identifier. When provided, rules that were already injected in
   * a previous call for this session are skipped (session dedup). Newly
   * matched rules are persisted to the session record on disk.
   */
  sessionId?: string | undefined;
  /**
   * Override the rule source directories. Mainly for testing. When omitted
   * the standard directories are used.
   */
  sources?: string[] | undefined;
};

export type ResolveRulesResult = {
  /** Joined bodies of all injected rules (each separated by `\n---\n`). */
  injected: string[];
  /** Absolute paths of all matched rule files. */
  matchedFiles: string[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default rule source directories in descending priority order.
 *
 * Precedence (highest first):
 *   0. .hima/rules    — project-local hima rules (highest)
 *   1. .claude/rules  — project-local Claude rules
 *   2. .cursor/rules  — project-local Cursor rules
 *   3. ~/.hima/rules  — global user rules (lowest; absolute path, not project-relative)
 *
 * Entries 0-2 are resolved relative to the project root via path.resolve(root, src).
 * Entry 3 is an absolute path; path.resolve treats it correctly when root is prepended
 * (path.resolve ignores earlier segments when it encounters an absolute segment).
 *
 * Tests override this via opts.sources to stay hermetic.
 */
const DEFAULT_SOURCES = [
  ".hima/rules",
  ".claude/rules",
  ".cursor/rules",
  path.join(os.homedir(), ".hima", "rules"),
];

/** Valid rule file extensions. */
const VALID_EXTS = new Set([".md", ".mdc"]);

/** Relative path pattern for the per-session injection record. */
const SESSION_RECORD_REL = (sessionId: string) =>
  `.hima/state/injected-rules-${sessionId}.json`;

// ---------------------------------------------------------------------------
// resolveRulesForPath
// ---------------------------------------------------------------------------

/**
 * Discover, filter, deduplicate, and return rule files applicable to the
 * given `targetPath` within project `root`.
 *
 * @param root        Absolute project root directory.
 * @param targetPath  Absolute path of the file being touched by a tool.
 * @param opts        Optional session dedup + source override.
 */
export async function resolveRulesForPath(
  root: string,
  targetPath: string,
  opts?: ResolveRulesOpts,
): Promise<ResolveRulesResult> {
  const sources = opts?.sources ?? DEFAULT_SOURCES;
  const sessionId = opts?.sessionId;

  // Compute relative path and basename for glob matching
  const relPath = path.relative(root, targetPath).replace(/\\/g, "/");
  const basename = path.basename(targetPath);

  // Collect candidate rule files from all sources (in priority order)
  const candidates = await collectCandidates(root, sources);

  // Load session dedup set
  const sessionSeen = sessionId
    ? await loadSessionRecord(root, sessionId)
    : new Set<string>();

  const injected: string[] = [];
  const matchedFiles: string[] = [];
  const seenRealPaths = new Set<string>();
  const newlyInjectedRealPaths: string[] = [];

  for (const candidatePath of candidates) {
    // Resolve to canonical path for dedup
    let real: string;
    try {
      real = await realpath(candidatePath);
    } catch {
      // File disappeared between listing and realpath — skip
      continue;
    }

    // Dedup by realpath (across different source dirs)
    if (seenRealPaths.has(real)) continue;
    seenRealPaths.add(real);

    // Session dedup: skip rules already injected this session
    if (sessionId && sessionSeen.has(real)) continue;

    // Read and parse the rule file
    let content: string;
    try {
      content = await readFile(candidatePath, "utf8");
    } catch {
      continue;
    }

    const parsed = parseRuleFrontmatter(content);

    // Determine inclusion
    const included =
      parsed.alwaysApply || ruleMatches(parsed.globs, relPath, basename);

    if (!included) continue;

    injected.push(parsed.body);
    matchedFiles.push(candidatePath);

    if (sessionId) {
      newlyInjectedRealPaths.push(real);
    }
  }

  // Persist newly injected rules to session record
  if (sessionId && newlyInjectedRealPaths.length > 0) {
    const updated = new Set([...sessionSeen, ...newlyInjectedRealPaths]);
    await saveSessionRecord(root, sessionId, updated);
  }

  // ── AGENTS.md walk-up (R-029) ────────────────────────────────────────────
  // Collect AGENTS.md files from the project root down to the target file's
  // directory (root-to-leaf). Their bodies are appended as always-applicable
  // context — not subject to frontmatter parsing, glob matching, or session
  // dedup (they are scoped directory conventions, not injected rules).
  const agentsMdPaths = await discoverAgentsMd(root, targetPath);
  for (const agentsMdPath of agentsMdPaths) {
    try {
      const body = await readFile(agentsMdPath, "utf8");
      injected.push(body);
      matchedFiles.push(agentsMdPath);
    } catch {
      // File disappeared between discoverAgentsMd and read — skip silently.
    }
  }

  return { injected, matchedFiles };
}

// ---------------------------------------------------------------------------
// discoverAgentsMd (R-029)
// ---------------------------------------------------------------------------

/**
 * Collect the absolute paths of AGENTS.md files that exist on the directory
 * chain from the project root down to the directory that contains `targetPath`
 * (inclusive, root-to-leaf order).
 *
 * Scoping rule (from CLAUDE.md §SCOPED-CONTEXT):
 *   "Read applicable root/subdir AGENTS.md files root-to-leaf; more-specific
 *   directory context wins for files in scope."
 *
 * Only AGENTS.md files that are under `root` (or exactly at `root`) are
 * considered. If `targetPath` is outside `root`, only root-level AGENTS.md
 * is checked.
 *
 * Never throws: a missing AGENTS.md at any level is simply skipped.
 *
 * @param root        Absolute project root directory.
 * @param targetPath  Absolute path of the file being processed by a tool.
 * @returns           Absolute paths of found AGENTS.md files in root-to-leaf order.
 */
export async function discoverAgentsMd(
  root: string,
  targetPath: string,
): Promise<string[]> {
  const targetDir = path.dirname(targetPath);
  const relDir = path.relative(root, targetDir);

  // Build the directory chain: root, root/a, root/a/b, ... root/a/b/c
  const dirs: string[] = [root];

  // Only walk into the project tree. If relDir starts with ".." the target is
  // outside root — we still check root itself but stop there.
  if (relDir && relDir !== "." && !relDir.startsWith("..")) {
    const parts = relDir.split(path.sep);
    let current = root;
    for (const part of parts) {
      current = path.join(current, part);
      dirs.push(current);
    }
  }

  const found: string[] = [];
  for (const dir of dirs) {
    const agentsMdPath = path.join(dir, "AGENTS.md");
    try {
      // access() is cheaper than readFile() — we only need existence here;
      // the body is read by the caller (resolveRulesForPath).
      await access(agentsMdPath);
      found.push(agentsMdPath);
    } catch {
      // Missing or unreadable AGENTS.md at this level — not an error.
    }
  }

  return found;
}

// ---------------------------------------------------------------------------
// Internal: candidate collection
// ---------------------------------------------------------------------------

/**
 * Walk each source directory under `root` and collect all .md/.mdc files.
 * Returns them in source-priority order (first source = highest priority).
 * Never throws on a missing directory.
 */
async function collectCandidates(
  root: string,
  sources: string[],
): Promise<string[]> {
  const result: string[] = [];

  for (const src of sources) {
    const dir = path.resolve(root, src);
    let entries: string[];
    try {
      const dirents = await readdir(dir, { withFileTypes: true });
      entries = dirents
        .filter((d) => d.isFile() && VALID_EXTS.has(path.extname(d.name)))
        .map((d) => path.join(dir, d.name));
    } catch {
      // Directory missing or unreadable — not an error
      continue;
    }
    result.push(...entries);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal: session dedup persistence
// ---------------------------------------------------------------------------

function sessionRecordPath(root: string, sessionId: string): string {
  return path.resolve(root, SESSION_RECORD_REL(sessionId));
}

async function loadSessionRecord(
  root: string,
  sessionId: string,
): Promise<Set<string>> {
  const filePath = sessionRecordPath(root, sessionId);
  try {
    const raw = await readFile(filePath, "utf8");
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) {
      return new Set(arr.filter((x): x is string => typeof x === "string"));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

async function saveSessionRecord(
  root: string,
  sessionId: string,
  realpaths: Set<string>,
): Promise<void> {
  const filePath = sessionRecordPath(root, sessionId);
  const content = `${JSON.stringify([...realpaths], null, 2)}\n`;
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await safeAtomicWriteFile(root, filePath, content);
  } catch {
    // Best-effort: if we can't persist the record, session dedup is degraded
    // but the resolver still returns the correct results for this call.
  }
}
