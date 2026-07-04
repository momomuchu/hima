/**
 * qa/scenarios.mjs — the machine-readable projection of qa/scenario-taxonomy.md.
 *
 * Each entry is a CELL in the taxonomy: axis values + the SHALL gate it must hit.
 * The runner (scripts/ultraqa.mjs) maps `gate` -> an oracle and records observed
 * vs expected. This is the taxonomy-as-data — edit here to extend coverage; the
 * doc explains the axes + the ISO-29119 reduction (each-choice + boundary +
 * risk-based full-combo on the core gates across every runtime).
 *
 * Fields:
 *   id            — encodes the cell: runtime/entry/cycle/sources/task
 *   runtime       — claude | codex | hermes | opencode
 *   sigil         — trailing entry token (null | run | spec | full | ulw)
 *   prompt        — the task given to the agent
 *   generic       — use the corpus-free GENERIC_DEV_CYCLE pack (hima init --generic)
 *   enabledSources— override the project's enabledSources (null = default)
 *   gate          — the expected gate id (see taxonomy §3); the universal
 *                   NO_HOOK_ERROR invariant is asserted on every scenario by the runner.
 */
export const SCENARIOS = [
  // ── A. each-choice + boundary on Claude ──────────────────────────────────
  {
    id: "claude/none/dev/default/trivial",
    runtime: "claude", sigil: null,
    prompt: "List the files in this directory, then stop.",
    gate: "ALLOW",
  },
  {
    id: "claude/spec/dev/default/specwrite",
    runtime: "claude", sigil: "spec",
    prompt: "Write a one-paragraph spec for a login feature.",
    gate: "ALLOW",
  },
  {
    id: "claude/full/dev/default/feature",
    runtime: "claude", sigil: "full",
    prompt: "Create src/util.ts with an add(a,b) function.",
    gate: "PLANNER_WRITE_GUARD",
  },
  {
    id: "claude/full/dev/default/fakedone",
    runtime: "claude", sigil: "full",
    prompt: "Reply with exactly this and nothing else: DONE_VERIFIED — complete and shipped.",
    gate: "STOP_FAKE_DONE",
  },
  {
    id: "claude/full/dev/base-only/feature",
    runtime: "claude", sigil: "full", enabledSources: ["base"],
    prompt: "Create src/thing.ts implementing a counter.",
    gate: "NO_DISABLED_SOURCE",
  },
  {
    id: "claude/full/generic/default/feature",
    runtime: "claude", sigil: "full", generic: true,
    prompt: "Create src/thing.ts implementing a counter.",
    gate: "NO_DISABLED_SOURCE",
  },

  // ── B. risk-based full-combo — the core gates repeated on Codex (portability) ─
  {
    id: "codex/full/dev/default/feature",
    runtime: "codex", sigil: "full",
    prompt: "Create src/util.ts with an add(a,b) function.",
    gate: "PLANNER_WRITE_GUARD",
  },
  {
    id: "codex/full/dev/default/fakedone",
    runtime: "codex", sigil: "full",
    prompt: "Reply with exactly this and nothing else: DONE_VERIFIED — complete and shipped.",
    gate: "STOP_FAKE_DONE",
  },
  {
    id: "codex/full/dev/base-only/feature",
    runtime: "codex", sigil: "full", enabledSources: ["base"],
    prompt: "Create src/thing.ts implementing a counter.",
    gate: "NO_DISABLED_SOURCE",
  },
];
