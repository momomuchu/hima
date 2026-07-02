/**
 * init.ts — `hima init` onboarding module.
 *
 * Implements the SPEC-016 (question set) / SPEC-017 (apply) `hima init` command: a short,
 * ordered Q-001..Q-005 flow whose answers become a working `HimaConfig`, plus the same
 * hook-wiring + scaffold side effects `hima setup` already performs (SPEC-017 A-001, "hima
 * init is a superset of hima setup").
 *
 * Design for testability (per the founder's build brief): every question is asked through an
 * injectable `AnswerProvider` — a plain `(prompt) => Promise<string>` function. The default
 * provider (`createReadlinePrompter`) reads from stdin via `node:readline/promises`; tests
 * inject a canned provider so answers are supplied programmatically, no TTY required. A
 * `--yes` non-interactive path (A-018) skips prompting entirely and accepts every default.
 *
 * Write contract (SPEC-017 §4):
 *   - `<root>/.hima/config.json`      — populated HimaConfig (A-014, project scope only, §0.1).
 *   - `<root>/.hima/current-risk.json` — `{"risk_class": "<Q-004 answer>"}` (A-003).
 *   - `<root>/.hima/config.example.jsonc` — commented starter reference (A-017).
 *   - Q-005 = yes → `runSetup()` once per runtime selected at Q-001 (A-002), reusing the
 *     existing hook-wiring/scaffold module unchanged.
 *   - `--generic` flag (opt-in, not a Q-001..Q-005 question) → `HimaConfig.cycle =
 *     GENERIC_DEV_CYCLE`, the corpus-free base-tier pack from `@hima/core` dev-cycle-pack.ts
 *     (SPEC-PRIMITIVE INV-2). See `InitOpts.generic` below.
 *
 * Re-run / merge contract (A-015, INV-4): `runtimes` / `useDevCyclePack` / `enabledSources`
 * are the three top-level keys `hima init` owns — every run overwrites them wholesale to match
 * the current answers (never a stale merge of an old value). `stageSkills` / `roles` / `cycle`
 * are never written by `hima init` and always survive a re-run unchanged. If the existing
 * config file exists but fails to decode, `hima init` errors out naming the file rather than
 * silently overwriting a human's hand-edited data (`[ALWAYS][PRESERVE]`).
 *
 * See: docs/specs/SPEC-016-onboarding-questions.md, docs/specs/SPEC-017-onboarding-apply.md.
 */

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { decodeHimaConfigEither, GENERIC_DEV_CYCLE, type HimaConfig } from "@hima/core";
import type { RiskClass, RuntimeTarget } from "@hima/schemas";
import { safeAtomicWriteFile } from "@hima/storage-core";
import { Either } from "effect";

import { runSetup } from "./setup.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The 4 runtimes `hima init` may wire hooks for (mirrors @hima/schemas RuntimeTarget). */
const VALID_RUNTIMES: ReadonlySet<RuntimeTarget> = new Set([
  "claude",
  "codex",
  "hermes",
  "opencode",
]);

/** The 3 floors `hima init` offers at Q-004 (C is intentionally never offered — SPEC-016 §2 Q-004). */
const OFFERED_FLOORS: ReadonlySet<RiskClass> = new Set(["T", "M", "H"]);

/**
 * InitAnswers — the resolved answer set for Q-001..Q-005, independent of how each answer was
 * obtained (prompted, `--yes` default, or pre-filled from an existing config on re-run).
 */
export interface InitAnswers {
  /** Q-001 — coding-agent runtime(s) this project targets. Minimum 1 (R-002). */
  runtimes: RuntimeTarget[];
  /** Q-002 — true = use the shipped default dev-cycle pack; false = opt out (OQ-2). */
  useDevCyclePack: boolean;
  /** Q-003 — true = enable the "corpus" skill source tier. */
  enableCorpus: boolean;
  /** Q-004 — enforcement floor written to .hima/current-risk.json (A-003). */
  floor: RiskClass;
  /** Q-005 — wire runtime hooks now via runSetup(). */
  wireHooksNow: boolean;
}

/** A single question posed to the answer provider. */
export interface PromptQuestion {
  readonly id: "runtimes" | "cycle" | "corpus" | "floor" | "hooks";
  readonly text: string;
  /** The zero-input default, rendered for display and used when the raw answer is blank. */
  readonly defaultRaw: string;
}

/**
 * AnswerProvider — injectable question-answer function.
 * Return the raw (unparsed) user input; blank/whitespace-only means "accept the default"
 * (R-002: every question has a safe zero-input default).
 */
export type AnswerProvider = (prompt: PromptQuestion) => Promise<string>;

export interface InitOpts {
  /** Project root (resolved to absolute). */
  root: string;
  /** Skip prompting entirely; accept every default (A-018). */
  yes?: boolean;
  /** Injectable answer provider. Defaults to a readline-based stdin prompter. */
  answerProvider?: AnswerProvider;
  /** Absolute path to the hima CLI dist entry-point, forwarded to runSetup(). */
  himaBinPath?: string;
  /**
   * `--generic` CLI flag — select the corpus-free `GENERIC_DEV_CYCLE` (@hima/core
   * dev-cycle-pack.ts) as this project's cycle. This is a flag, not a Q-001..Q-005
   * question: it does not extend or reorder the fixed 5-question flow (SPEC-016 R-001,
   * `InitAnswers` stays exactly 5 fields). When true, `hima init` writes
   * `HimaConfig.cycle = GENERIC_DEV_CYCLE` — the one intentional, opt-in exception to
   * the "hima init never writes stageSkills/roles/cycle" contract documented above
   * (A-015/INV-4): omit `--generic` (the default) and a re-run still leaves any
   * hand-edited `cycle` completely untouched.
   */
  generic?: boolean;
}

export interface InitResult {
  root: string;
  configPath: string;
  riskPath: string;
  examplePath: string;
  answers: InitAnswers;
  /** Absolute paths of hook-settings files updated by runSetup() (Q-005 = yes). */
  wired: string[];
  /** Human-readable next-step messages (mirrors SetupResult.messages). */
  messages: string[];
}

// ---------------------------------------------------------------------------
// runInit — main entry point
// ---------------------------------------------------------------------------

export async function runInit(opts: InitOpts): Promise<InitResult> {
  const root = path.resolve(opts.root);
  const configPath = path.join(root, ".hima", "config.json");
  const riskPath = path.join(root, ".hima", "current-risk.json");
  const examplePath = path.join(root, ".hima", "config.example.jsonc");
  const messages: string[] = [];
  const wired: string[] = [];

  // ── 0. Read pre-existing state for upgrade-path pre-fill (R-003 / OQ-6) ──────────────────

  const existing = await tryReadExistingConfig(configPath);
  const existingFloor = await tryReadExistingFloor(riskPath);
  const detectedRuntime = await detectRuntime(root);

  const defaults: InitAnswers = {
    runtimes:
      existing?.runtimes !== undefined && existing.runtimes.length > 0
        ? [...existing.runtimes]
        : [detectedRuntime],
    useDevCyclePack: existing?.useDevCyclePack !== false,
    enableCorpus: existing?.enabledSources?.includes("corpus") ?? false,
    floor: existingFloor ?? "M",
    wireHooksNow: true,
  };

  // ── 1. Ask (or accept defaults) ───────────────────────────────────────────────────────────

  let answers: InitAnswers;
  if (opts.yes === true) {
    answers = defaults;
  } else if (opts.answerProvider !== undefined) {
    answers = await askAll(opts.answerProvider, defaults);
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      answers = await askAll(
        async (q: PromptQuestion) => rl.question(`${q.text}\n> [${q.defaultRaw}] `),
        defaults,
      );
    } finally {
      rl.close();
    }
  }

  // ── 2. Build + validate the merged HimaConfig (A-014/A-015/INV-1/INV-4) ──────────────────

  const merged = buildMergedConfig(existing, answers);
  if (opts.generic === true) {
    // --generic (opt-in flag, not a Q-001..Q-005 answer): select the corpus-free
    // GENERIC_DEV_CYCLE pack as this project's cycle (SPEC-PRIMITIVE INV-2 swappability).
    merged["cycle"] = GENERIC_DEV_CYCLE;
  }
  const decoded = decodeHimaConfigEither(merged);
  if (Either.isLeft(decoded)) {
    throw new Error(
      `hima init: internal error — computed config failed to decode: ${String(decoded.left)}`,
    );
  }

  // ── 3. Write config.json + current-risk.json + config.example.jsonc ──────────────────────

  await safeAtomicWriteFile(root, configPath, JSON.stringify(decoded.right, null, 2) + "\n");
  await safeAtomicWriteFile(
    root,
    riskPath,
    JSON.stringify({ risk_class: answers.floor }, null, 2) + "\n",
  );
  await safeAtomicWriteFile(root, examplePath, CONFIG_EXAMPLE_JSONC);

  messages.push(`Config written: ${configPath}`);
  messages.push(`Enforcement floor set to "${answers.floor}": ${riskPath}`);
  messages.push(`Starter reference written: ${examplePath}`);
  messages.push(
    "Precedence: hand-edited .hima/config.json stageSkills/roles beat a custom cycle, " +
      "which beats the shipped default dev-cycle pack.",
  );
  if (opts.generic === true) {
    messages.push(
      'Cycle set to the corpus-free "generic-dev-cycle-v1" pack (--generic): ' +
        "HimaConfig.cycle = GENERIC_DEV_CYCLE, zero corpus-source skills.",
    );
  }

  // ── 4. Q-005 — wire hooks now (A-001/A-002) ───────────────────────────────────────────────

  if (answers.wireHooksNow) {
    for (const runtime of answers.runtimes) {
      if (runtime === "opencode") {
        // OQ-5 (SPEC-016 §4): runSetup does not yet support "opencode" hook-wiring.
        messages.push(
          'runtime "opencode": hook wiring is not yet supported by hima setup (SPEC-016 OQ-5)' +
            " — wire manually, or re-run hima setup once opencode support ships.",
        );
        continue;
      }
      const result = await runSetup({ root, runtime, himaBinPath: opts.himaBinPath });
      wired.push(...result.wired);
      messages.push(...result.messages);
    }
  } else {
    messages.push('Hooks not wired this run — run "hima setup" manually when ready.');
  }

  return { root, configPath, riskPath, examplePath, answers, wired, messages };
}

// ---------------------------------------------------------------------------
// askAll — pose Q-001..Q-005 in fixed order (SPEC-016 R-001) through the AnswerProvider
// ---------------------------------------------------------------------------

async function askAll(ask: AnswerProvider, defaults: InitAnswers): Promise<InitAnswers> {
  const runtimesRaw = await ask({
    id: "runtimes",
    text:
      "Q1. Which coding agent(s) do you run this project through? " +
      "(comma-separated: claude,codex,hermes,opencode)",
    defaultRaw: defaults.runtimes.join(","),
  });
  const runtimes = parseRuntimes(runtimesRaw, defaults.runtimes);

  const cycleRaw = await ask({
    id: "cycle",
    text:
      "Q2. Use hima's default dev-cycle pack (discovery -> analysis -> spec -> design -> " +
      "impl -> test -> verify -> maintenance), or bring your own cycle later? " +
      "(yes = use the default pack, no = skip its forced skills for now)",
    defaultRaw: defaults.useDevCyclePack ? "yes" : "no",
  });
  const useDevCyclePack = parseBoolean(cycleRaw, defaults.useDevCyclePack);

  const corpusRaw = await ask({
    id: "corpus",
    text:
      "Q3. Enable hima's private corpus skill source? Only say yes if you have the " +
      "founder's private corpus-* excellence-book collection installed.",
    defaultRaw: defaults.enableCorpus ? "yes" : "no",
  });
  const enableCorpus = parseBoolean(corpusRaw, defaults.enableCorpus);

  const floorRaw = await ask({
    id: "floor",
    text:
      "Q4. Set the default enforcement floor for new work: " +
      "Advisory (T — inject only, never block), Standard (M — recommended), " +
      "or Strict (H — hard-block where the runtime allows)?",
    defaultRaw: defaults.floor,
  });
  const floor = parseFloor(floorRaw, defaults.floor);

  const hooksRaw = await ask({
    id: "hooks",
    text:
      "Q5. Wire hima's hooks into the runtime(s) selected in Q1 now? " +
      "(idempotent — safe to re-run any time via hima setup)",
    defaultRaw: defaults.wireHooksNow ? "yes" : "no",
  });
  const wireHooksNow = parseBoolean(hooksRaw, defaults.wireHooksNow);

  return { runtimes, useDevCyclePack, enableCorpus, floor, wireHooksNow };
}

// ---------------------------------------------------------------------------
// Answer parsing — every parser falls back to the safe default on blank/unrecognized input
// ---------------------------------------------------------------------------

function parseRuntimes(raw: string, fallback: RuntimeTarget[]): RuntimeTarget[] {
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const parts = trimmed
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0);
  const valid: RuntimeTarget[] = [];
  for (const p of parts) {
    if (VALID_RUNTIMES.has(p as RuntimeTarget) && !valid.includes(p as RuntimeTarget)) {
      valid.push(p as RuntimeTarget);
    }
  }
  return valid.length > 0 ? valid : fallback;
}

function parseBoolean(raw: string, fallback: boolean): boolean {
  const t = raw.trim().toLowerCase();
  if (t === "") return fallback;
  if (t === "y" || t === "yes" || t === "true") return true;
  if (t === "n" || t === "no" || t === "false") return false;
  return fallback;
}

function parseFloor(raw: string, fallback: RiskClass): RiskClass {
  const t = raw.trim().toUpperCase();
  if (t === "") return fallback;
  if (t === "T" || t === "ADVISORY") return "T";
  if (t === "M" || t === "STANDARD") return "M";
  if (t === "H" || t === "STRICT") return "H";
  // Anything else (including a hand-edited "C"/"L" pre-fill re-typed verbatim, or garbage
  // input) falls back rather than silently accepting an offering Q-004 never presents.
  return OFFERED_FLOORS.has(fallback) || fallback === "T" || fallback === "M" || fallback === "H"
    ? fallback
    : "M";
}

// ---------------------------------------------------------------------------
// buildMergedConfig — SPEC-017 A-015 merge semantics
// ---------------------------------------------------------------------------

/**
 * Build the config object to write, given the (possibly undefined) existing decoded config and
 * this run's answers.
 *
 * `runtimes` / `useDevCyclePack` / `enabledSources` are the three keys `hima init` owns — they
 * are always replaced wholesale by the current run's answers (A-002/A-004/A-005), never merged
 * with a stale prior value. `stageSkills` / `roles` / `cycle` are never referenced here, so they
 * pass through from `existing` completely untouched (A-015, INV-4).
 */
function buildMergedConfig(
  existing: HimaConfig | undefined,
  answers: InitAnswers,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(existing ?? {}) };

  delete merged["runtimes"];
  delete merged["useDevCyclePack"];
  delete merged["enabledSources"];

  merged["runtimes"] = answers.runtimes;
  merged["enabledSources"] = answers.enableCorpus
    ? ["base", "corpus", "user", "project"]
    : ["base", "user", "project"];

  // A-004 / INV-3: "use the default pack" omits the key entirely rather than writing `true` —
  // omission is what keeps the cycle swappable without a kernel change.
  if (!answers.useDevCyclePack) {
    merged["useDevCyclePack"] = false;
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Existing-state readers (upgrade path — R-003/OQ-6 best-effort pre-fill)
// ---------------------------------------------------------------------------

/**
 * Read + decode the existing .hima/config.json, if any.
 * Returns undefined when the file does not exist.
 * Throws when the file exists but is not valid JSON or fails HimaConfig decode — hima init
 * must never silently overwrite a hand-edited config it cannot understand (A-015).
 */
async function tryReadExistingConfig(configPath: string): Promise<HimaConfig | undefined> {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (e: unknown) {
    if (isEnoent(e)) return undefined;
    throw e;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(
      `hima init: ${configPath} exists but is not valid JSON — fix or delete it before re-running hima init.`,
    );
  }

  const result = decodeHimaConfigEither(parsed);
  if (Either.isLeft(result)) {
    throw new Error(
      `hima init: ${configPath} exists but does not decode as a valid HimaConfig — fix or delete it before re-running hima init.`,
    );
  }
  return result.right;
}

/** Read the risk_class from an existing current-risk.json, if present and well-formed. */
async function tryReadExistingFloor(riskPath: string): Promise<RiskClass | undefined> {
  try {
    const raw = await readFile(riskPath, "utf8");
    const parsed = JSON.parse(raw) as { risk_class?: unknown };
    const rc = parsed.risk_class;
    if (rc === "T" || rc === "L" || rc === "M" || rc === "H" || rc === "C") return rc;
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Auto-detect the default runtime for Q-001's pre-checked selection.
 * Mirrors setup.ts's resolveRuntime() detection order exactly (duplicated locally so init.ts
 * does not depend on setup.ts's private helper): .claude dir -> claude; .codex dir or
 * AGENTS.md -> codex; otherwise -> claude.
 */
async function detectRuntime(root: string): Promise<RuntimeTarget> {
  const [hasClaudeDir, hasCodexDir, hasAgentsMd] = await Promise.all([
    pathExists(path.join(root, ".claude")),
    pathExists(path.join(root, ".codex")),
    pathExists(path.join(root, "AGENTS.md")),
  ]);
  if (hasClaudeDir) return "claude";
  if (hasCodexDir || hasAgentsMd) return "codex";
  return "claude";
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT"
  );
}

// ---------------------------------------------------------------------------
// config.example.jsonc — A-017 commented starter reference (never read by loadConfig)
// ---------------------------------------------------------------------------

const CONFIG_EXAMPLE_JSONC = `// .hima/config.example.jsonc — starter reference for hand-editing .hima/config.json.
//
// This file is NOT read by hima (loadConfig only globs *.json, never *.jsonc) — it exists
// purely as a copy-paste reference. The live .hima/config.json must stay strict JSON (no
// comments): decodeHimaConfigEither silently drops unknown keys, so an inline "//" pseudo-key
// would decode-succeed yet persist as confusing dead data rather than documentation.
//
// Precedence (highest wins): stageSkills/roles hand-edits > a custom "cycle" > the shipped
// default dev-cycle pack (DEV_CYCLE). hima init v1 never writes stageSkills/roles/cycle itself
// (SPEC-017 §0.1) — those remain hand-edit-only.
{
  // Per-stage force/inject overrides (hand-edit only; hima init never writes this).
  "stageSkills": {
    "discovery": {
      "force": [{ "source": "base", "id": "hima-survey" }],
      "inject": []
    }
  },

  // Full cycle replacement (hand-edit only). Supersedes the shipped DEV_CYCLE entirely when
  // present. Omit this key to keep using the shipped default dev-cycle pack (swappable,
  // SPEC-PRIMITIVE INV-2).
  // "cycle": { "id": "my-cycle", "name": "My Cycle", "stages": [] },

  // Per-role subagent overrides (hand-edit only; hima init never writes this).
  "roles": {
    "executor": {
      "model": "sonnet"
    }
  },

  // Written by \`hima init\` Q-001 — which coding-agent runtime(s) this project targets.
  // Bookkeeping only for hima init's own hook-wiring loop; a live gate event's runtime always
  // comes from the hook invocation context, never from this field.
  "runtimes": ["claude"],

  // Written by \`hima init\` Q-002. Present + false = opt out of the shipped default dev-cycle
  // pack's forced skills. Omitted (the default) = use the shipped pack.
  // "useDevCyclePack": false,

  // Written by \`hima init\` Q-003. Allowlist of SkillRef.source tiers this project has declared
  // available. base/user/project are always safe; "corpus" requires the founder's private
  // excellence-book collection to be installed.
  "enabledSources": ["base", "user", "project"]
}
`;
