/**
 * setup.ts — `norm setup` onboarding module.
 *
 * Wires runtime hooks and scaffolds the .hima/ state directory for a project.
 *
 * Public surface:
 *   runSetup(opts)       — main entry point (async, file-system operations)
 *   mergeClaudeHooks(existingSettings, himaBinPath?) — pure helper; unit-testable
 *
 * Supported runtimes: "claude" | "codex" | "hermes"
 *
 * Claude hook wiring:
 *   Merges the 7 Claude hook events into <root>/.claude/settings.json.
 *   Merge is idempotent: hima-managed entries are replaced, unrelated entries
 *   and top-level keys are preserved intact.
 *
 * Scaffold:
 *   Ensures <root>/.hima/state/ exists.
 *   Creates <root>/.hima/config.json   ({})              when absent.
 *   Creates <root>/.hima/current-risk.json  ({"risk_class":"T"}) when absent.
 *
 * Fresh reset (opts.fresh):
 *   Deletes .hima/state/trace/, .hima/state/ward.json, .hima/state/events.jsonl.
 *   Does NOT delete .hima/config.json (config is user data; only state is reset).
 *   Re-runs scaffold after deletion to guarantee the base structure exists.
 */

import { access, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { safeAtomicWriteFile } from "@norm/storage-core";

// ---------------------------------------------------------------------------
// Claude hook event map
// ---------------------------------------------------------------------------

/**
 * All 9 Claude hook events: PascalCase (settings.json key) + kebab (CLI arg).
 * Stop wires the BEH-023 completion gate (reject fake DONE); SubagentStop is the
 * observe-only subagent stop event. Both were previously unwired — without the
 * Stop hook the flagship "no unverified DONE" gate never fires in a live session.
 */
const CLAUDE_HOOK_EVENTS = [
  { pascal: "SessionStart", kebab: "session-start" },
  { pascal: "UserPromptSubmit", kebab: "user-prompt-submit" },
  { pascal: "PreToolUse", kebab: "pre-tool-use" },
  { pascal: "PostToolUse", kebab: "post-tool-use" },
  { pascal: "PreCompact", kebab: "pre-compact" },
  { pascal: "PostCompact", kebab: "post-compact" },
  { pascal: "SubagentStart", kebab: "subagent-start" },
  { pascal: "Stop", kebab: "stop" },
  { pascal: "SubagentStop", kebab: "subagent-stop" },
] as const;

// ---------------------------------------------------------------------------
// Internal types for the settings.json hook shape
// ---------------------------------------------------------------------------

type HookEntry = {
  type: "command";
  command: string;
};

type HookMatcher = {
  matcher: string;
  hooks: HookEntry[];
};

// ---------------------------------------------------------------------------
// mergeClaudeHooks — pure exported helper
// ---------------------------------------------------------------------------

/**
 * mergeClaudeHooks — merge norm hook entries into a Claude settings object.
 *
 * MERGE semantics:
 *   • For each of the 7 Claude hook events, any existing entry whose command
 *     matches `hook <kebab-event> … --format claude` (a hima-managed entry) is
 *     removed, then the fresh hima entry is appended.  Non-hima entries in the
 *     same event array are preserved.
 *   • All other top-level keys in `existingSettings` are carried through intact.
 *   • Non-object `existingSettings` values are treated as {} (fresh start).
 *
 * @param existingSettings - Parsed content of an existing settings.json, or
 *   any unknown value (non-objects are normalised to {}).
 * @param himaBinPath - Absolute path to the hima CLI dist entry-point.
 *   When provided the command is:  `node <himaBinPath> hook <event> --format claude`
 *   When omitted the command is:   `norm hook <event> --format claude`
 */
export function mergeClaudeHooks(
  existingSettings: unknown,
  himaBinPath?: string,
): Record<string, unknown> {
  // Normalise: non-object values become {}
  const base: Record<string, unknown> =
    isPlainObject(existingSettings)
      ? { ...(existingSettings as Record<string, unknown>) }
      : {};

  // Normalise existing hooks block
  const existingHooksRaw = base["hooks"];
  const existingHooks: Record<string, unknown> = isPlainObject(existingHooksRaw)
    ? { ...(existingHooksRaw as Record<string, unknown>) }
    : {};

  const mergedHooks: Record<string, unknown> = { ...existingHooks };

  for (const { pascal, kebab } of CLAUDE_HOOK_EVENTS) {
    const command = himaBinPath
      ? `node ${himaBinPath} hook ${kebab} --format claude`
      : `norm hook ${kebab} --format claude`;

    // Preserve non-hima entries for this event; drop old hima entries.
    const rawMatchers = mergedHooks[pascal];
    const preserved: HookMatcher[] = Array.isArray(rawMatchers)
      ? (rawMatchers as unknown[]).flatMap((entry) =>
          isHimaHookEntry(entry, kebab) ? [] : [entry as HookMatcher],
        )
      : [];

    const newEntry: HookMatcher = {
      matcher: "",
      hooks: [{ type: "command", command }],
    };

    mergedHooks[pascal] = [...preserved, newEntry];
  }

  return { ...base, hooks: mergedHooks };
}

/**
 * Returns true when `entry` is a hima-managed hook for `kebabEvent`.
 * Identification: the command contains `hook <kebab>` AND `--format claude`.
 */
function isHimaHookEntry(entry: unknown, kebabEvent: string): boolean {
  if (!isPlainObject(entry)) return false;
  const hooksVal = (entry as Record<string, unknown>)["hooks"];
  if (!Array.isArray(hooksVal)) return false;
  return hooksVal.some((h) => {
    if (!isPlainObject(h)) return false;
    const cmd = (h as Record<string, unknown>)["command"];
    return (
      typeof cmd === "string" &&
      cmd.includes(`hook ${kebabEvent}`) &&
      cmd.includes("--format claude")
    );
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SetupOpts {
  /**
   * Path to the project root (resolved to absolute).
   */
  root: string;
  /**
   * Target runtime.  When omitted, auto-detected from the directory layout:
   *   .claude dir present  →  "claude"
   *   .codex dir or AGENTS.md present  →  "codex"
   *   otherwise  →  "claude" (default)
   */
  runtime?: "claude" | "codex" | "hermes";
  /**
   * When true, delete .hima/state/trace/, .hima/state/ward.json, and
   * .hima/state/events.jsonl before re-scaffolding.
   * .hima/config.json is intentionally preserved (user config data).
   */
  fresh?: boolean;
  /**
   * Absolute path to the hima CLI dist entry-point (e.g. dist/index.js).
   * When provided, hook commands use `node <himaBinPath> hook …`.
   * When omitted, hook commands use the global `hima` bin.
   */
  himaBinPath?: string;
}

export interface SetupResult {
  /** Resolved runtime identifier ("claude" | "codex" | "hermes"). */
  runtime: string;
  /** Absolute paths of files updated during hook wiring. */
  wired: string[];
  /** Absolute paths of files created during scaffold. */
  scaffolded: string[];
  /** Absolute paths deleted during --fresh reset. */
  reset: string[];
  /** Human-readable next-step messages. */
  messages: string[];
}

// ---------------------------------------------------------------------------
// wireCodexHooks — Codex hook wiring (config.toml)
// ---------------------------------------------------------------------------

const CODEX_MARKER =
  "# norm-codex-hooks (generated by `norm setup --runtime codex`)";

/** Codex hook events hima governs (adapter-codex: pre_tool + stop can block). */
const CODEX_EVENTS: ReadonlyArray<readonly [string, string]> = [
  ["SessionStart", "session-start"],
  ["UserPromptSubmit", "user-prompt-submit"],
  ["PreToolUse", "pre-tool-use"],
  ["PostToolUse", "post-tool-use"],
  ["Stop", "stop"],
];

/** Render the hima-owned `.codex/config.toml` content. Exported for tests. */
export function codexHookBlock(himaBinPath?: string): string {
  const cmd = (kebab: string): string =>
    himaBinPath
      ? `node "${himaBinPath}" hook ${kebab} --format codex`
      : `norm hook ${kebab} --format codex`;
  const lines: string[] = [CODEX_MARKER, "codex_hooks = true", ""];
  for (const [pascal, kebab] of CODEX_EVENTS) {
    lines.push(
      `[[hooks.${pascal}]]`,
      `[[hooks.${pascal}.hooks]]`,
      `type = "command"`,
      `command = '${cmd(kebab)}'`,
      "",
    );
  }
  return lines.join("\n");
}

/**
 * wireCodexHooks — write a hima-owned `.codex/config.toml` registering hima as
 * Codex's hook command for the governed events. Codex reads `codex_hooks = true`
 * + `[[hooks.<Event>]]` tables and invokes them (run codex with
 * `--dangerously-bypass-hook-trust` for headless automation). Non-destructive:
 * if a non-hima config.toml already exists, returns the block as a note rather
 * than clobbering the user's config.
 */
async function wireCodexHooks(
  root: string,
  himaBinPath?: string,
): Promise<{ path: string; wrote: boolean; note?: string }> {
  const codexDir = path.join(root, ".codex");
  const cfgPath = path.join(codexDir, "config.toml");
  const block = codexHookBlock(himaBinPath);
  let existing = "";
  try {
    existing = await readFile(cfgPath, "utf8");
  } catch {
    /* absent — write fresh */
  }
  if (existing && !existing.includes(CODEX_MARKER)) {
    return {
      path: cfgPath,
      wrote: false,
      note: `A non-hima .codex/config.toml exists; not clobbered. Add these hooks manually:\n${block}`,
    };
  }
  await mkdir(codexDir, { recursive: true });
  await safeAtomicWriteFile(root, cfgPath, block);
  return { path: cfgPath, wrote: true };
}

// ---------------------------------------------------------------------------
// runSetup — main entry point
// ---------------------------------------------------------------------------

/**
 * runSetup — configure a project root for use with hima.
 *
 * Steps:
 *   1. Resolve runtime (explicit > auto-detect > default "claude").
 *   2. Wire hooks into the runtime's settings file (claude), or emit a
 *      best-effort note for runtimes that require manual wiring (codex/hermes).
 *   3. Scaffold .hima/state/, .hima/config.json, .hima/current-risk.json.
 *   4. If opts.fresh: delete runtime state then re-scaffold.
 *
 * Never throws for missing optional files or a brand-new empty root.
 */
export async function runSetup(opts: SetupOpts): Promise<SetupResult> {
  const root = path.resolve(opts.root);
  const wired: string[] = [];
  const scaffolded: string[] = [];
  const reset: string[] = [];
  const messages: string[] = [];

  // ── 1. Resolve runtime ────────────────────────────────────────────────────

  const runtime = await resolveRuntime(root, opts.runtime);

  // ── 2. Wire hooks ─────────────────────────────────────────────────────────

  if (runtime === "claude") {
    const settingsPath = path.join(root, ".claude", "settings.json");
    await wireClaudeHooks(root, settingsPath, opts.himaBinPath);
    wired.push(settingsPath);
    messages.push(
      `Hooks wired: ${settingsPath}` +
        ` — re-run "norm setup" at any time to refresh.`,
    );
  } else if (runtime === "codex") {
    const res = await wireCodexHooks(root, opts.himaBinPath);
    if (res.wrote) {
      wired.push(res.path);
      messages.push(
        `Codex hooks wired: ${res.path} — run codex with ` +
          `--dangerously-bypass-hook-trust for headless automation.`,
      );
    } else if (res.note) {
      messages.push(res.note);
    }
  } else {
    messages.push(
      `runtime ${runtime}: hook wiring is best-effort/manual; see docs/hima-setup.md`,
    );
  }

  // ── 3. Initial scaffold ───────────────────────────────────────────────────

  const initialScaffolded = await scaffold(root);
  scaffolded.push(...initialScaffolded);

  // ── 4. Fresh reset ────────────────────────────────────────────────────────

  if (opts.fresh === true) {
    const resetPaths = await freshReset(root);
    reset.push(...resetPaths);

    // Re-scaffold after deletion to ensure the base structure is intact.
    const afterResetScaffolded = await scaffold(root);
    for (const p of afterResetScaffolded) {
      if (!scaffolded.includes(p)) {
        scaffolded.push(p);
      }
    }

    messages.push(
      `Fresh reset: deleted ${
        resetPaths.length > 0 ? resetPaths.join(", ") : "nothing (state was already clean)"
      }.`,
    );
  }

  // ── 5. Final guidance ─────────────────────────────────────────────────────

  messages.push(
    `Setup complete for runtime "${runtime}".` +
      ` Verify hooks with: norm trace --root ${root}`,
  );

  return { runtime, wired, scaffolded, reset, messages };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the target runtime.
 * Priority: explicit > auto-detect (.claude / .codex / AGENTS.md) > "claude".
 */
async function resolveRuntime(
  root: string,
  explicit?: "claude" | "codex" | "hermes",
): Promise<string> {
  if (explicit !== undefined) return explicit;

  const [hasClaudeDir, hasCodexDir, hasAgentsMd] = await Promise.all([
    pathExists(path.join(root, ".claude")),
    pathExists(path.join(root, ".codex")),
    pathExists(path.join(root, "AGENTS.md")),
  ]);

  if (hasClaudeDir) return "claude";
  if (hasCodexDir || hasAgentsMd) return "codex";
  return "claude";
}

/**
 * Read the existing settings.json (if any), merge norm hooks, and write back.
 */
async function wireClaudeHooks(
  root: string,
  settingsPath: string,
  himaBinPath?: string,
): Promise<void> {
  let existing: unknown = {};
  try {
    const raw = await readFile(settingsPath, "utf8");
    existing = JSON.parse(raw) as unknown;
  } catch {
    // ENOENT or JSON parse error → start from scratch
    existing = {};
  }

  const merged = mergeClaudeHooks(existing, himaBinPath);
  await safeAtomicWriteFile(
    root,
    settingsPath,
    JSON.stringify(merged, null, 2) + "\n",
  );
}

/**
 * Ensure the .hima/ scaffold exists.  Create default config/risk files only
 * when they are absent.  Returns the list of newly created file paths.
 */
async function scaffold(root: string): Promise<string[]> {
  const created: string[] = [];

  // .hima/state/ must exist for all subsequent state writes.
  await mkdir(path.join(root, ".hima", "state"), { recursive: true });

  // .hima/config.json — only when absent; config is user data.
  const configPath = path.join(root, ".hima", "config.json");
  if (!(await pathExists(configPath))) {
    await safeAtomicWriteFile(
      root,
      configPath,
      JSON.stringify({}, null, 2) + "\n",
    );
    created.push(configPath);
  }

  // .hima/current-risk.json — default risk class T (trivial) when absent.
  const riskPath = path.join(root, ".hima", "current-risk.json");
  if (!(await pathExists(riskPath))) {
    await safeAtomicWriteFile(
      root,
      riskPath,
      JSON.stringify({ risk_class: "T" }, null, 2) + "\n",
    );
    created.push(riskPath);
  }

  return created;
}

/**
 * Delete runtime state files for a --fresh reset.
 * Does NOT touch .hima/config.json (user data).
 * Returns the list of paths that were actually removed.
 */
async function freshReset(root: string): Promise<string[]> {
  const deleted: string[] = [];
  const stateDir = path.join(root, ".hima", "state");

  // .hima/state/trace/ — recursive directory removal
  const traceDir = path.join(stateDir, "trace");
  if (await pathExists(traceDir)) {
    await rm(traceDir, { recursive: true, force: true });
    deleted.push(traceDir);
  }

  // .hima/state/ward.json
  const wardPath = path.join(stateDir, "ward.json");
  if (await pathExists(wardPath)) {
    await rm(wardPath, { force: true });
    deleted.push(wardPath);
  }

  // .hima/state/events.jsonl
  const eventsPath = path.join(stateDir, "events.jsonl");
  if (await pathExists(eventsPath)) {
    await rm(eventsPath, { force: true });
    deleted.push(eventsPath);
  }

  return deleted;
}

/**
 * Returns true if the path exists (file or directory), false on ENOENT.
 */
async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
