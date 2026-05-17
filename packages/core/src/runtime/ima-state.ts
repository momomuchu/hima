/**
 * @file ima-state.ts
 * @module @harness/core/runtime
 *
 * IMA State Machine — deterministic structured context injection over the dev-cycle DAG.
 *
 * Design authority: state-machine.md (GOAL-3 blueprint)
 *
 * § References (state-machine.md sections cited throughout):
 *   §1  — State Shape (ImaState interface, invariants)
 *   §2  — Transition Function (enter / advance / hardSkip / unblock)
 *   §2.1 — Helper: spine index arithmetic
 *   §2.2 — enter — initialize a run
 *   §2.3 — advance — stage-complete event
 *   §2.4 — hardSkip — HARD discipline cannot be satisfied
 *   §2.5 — unblock — external resolution clears the blocker
 *   §3  — D5 State Inspector Contract
 *
 * Binding decisions (GOAL-3 §10.2, §10.4):
 *   - M0 full-bypass: no decision gates / no checkpoints / no SOFT-warn friction,
 *     BUT every HARD discipline still loads and a skipped HARD stage still BLOCKs.
 *     Honesty + HARD floor are laws, not gates.
 *   - Spine is the 14-stage linear sequence from state-machine.md §1; "END" is a
 *     terminal sentinel appended at position 13 (0-indexed).
 *
 * Pure module: no I/O, no persistence, no external deps beyond the TS stdlib.
 */

// ─── Spine ────────────────────────────────────────────────────────────────────
// state-machine.md §1 — the 14 real stages + terminal sentinel "END"

/**
 * All valid stage identifiers on the dev-cycle spine.
 * "END" is a terminal sentinel — it is never an active_stage during real work;
 * it only appears once a window is fully exhausted (state-machine.md §1 invariant).
 */
export type SpineStage =
  | "idea-pmf"
  | "strategy-positioning"
  | "analysis-discovery"
  | "specification"
  | "design-ux"
  | "architecture"
  | "ai-ml"
  | "build"
  | "quality-release"
  | "growth"
  | "sales-cs"
  | "measurement"
  | "finance"
  | "END";

/**
 * Ordered spine — position in this array IS the stage index.
 * state-machine.md §1, §2.1.
 * GOAL-3 §4a: 14 real stages (idea-pmf … finance) + terminal sentinel.
 */
export const SPINE: readonly SpineStage[] = [
  "idea-pmf",
  "strategy-positioning",
  "analysis-discovery",
  "specification",
  "design-ux",
  "architecture",
  "ai-ml",
  "build",
  "quality-release",
  "growth",
  "sales-cs",
  "measurement",
  "finance",
  "END",
] as const;

// ─── Mode ─────────────────────────────────────────────────────────────────────
// state-machine.md §1, GOAL-3 §4c

/**
 * IMA operating mode — orthogonal to the active window.
 *
 * - M0 full-bypass: agent decides; no decision gates / no checkpoints /
 *   no SOFT-warn friction. HARD floor still enforced (M0 HARD-safe, §10.2).
 * - M1 full-auto (DEFAULT): agent decides; HARD gates still enforced; no checkpoints.
 * - M2 checkpoint-gated: human holds go/no-go once per stage boundary.
 * - M3 explicit-pipeline: runs exactly the named window, no auto-extension.
 * - M4 scoped: agent decides; single scoped rule, no spine traversal.
 *
 * state-machine.md §1: decision_owner = "agent" for M0/M1/M3/M4, "human" for M2.
 * GOAL-3 §4c: the full 5-mode axis. M0/M4 HARD-bypass semantics live at the
 * gate/policy layer (evaluate-gate.ts, baseline-policy.ts); ImaState only needs
 * to carry the mode and resolve decision ownership (M2 is the sole human-owned).
 */
export type ImaMode = "M0" | "M1" | "M2" | "M3" | "M4";

// ─── Window ───────────────────────────────────────────────────────────────────
// state-machine.md §1 — contiguous spine slice [start, stop] (inclusive)

/**
 * A contiguous window on the spine.
 * - start: first stage that runs (inclusive).
 * - stop: last stage that runs (inclusive); use "finance" to run to the last real stage.
 *
 * state-machine.md §1 invariant: stageIndex(stop) >= stageIndex(start) and
 * neither start nor stop may equal "END" (validated in enter()).
 */
export interface StageWindow {
  readonly start: SpineStage;
  readonly stop: SpineStage;
}

// ─── Forced disciplines ───────────────────────────────────────────────────────
// state-machine.md §1, GOAL-3 §4a (FORCE-INVOKE [HARD] × 353)

/**
 * A HARD or SOFT discipline identifier, as defined per stage in the spine config.
 * Kept open-ended (string) — the set is corpus-driven, not hardcoded here.
 * state-machine.md §1.
 */
export type ForcedDiscipline = string;

// ─── Decision owner ───────────────────────────────────────────────────────────
// state-machine.md §1

/**
 * Who holds go/no-go authority at each stage boundary.
 * state-machine.md §1: "agent" for M0/M1/M3/M4, "human" for M2.
 */
export type DecisionOwner = "agent" | "human";

// ─── Blocker ──────────────────────────────────────────────────────────────────
// state-machine.md §1, §2.4

/**
 * Reason record emitted when a HARD discipline cannot be satisfied.
 * state-machine.md §2.4: the only way blocked becomes true is via hardSkip().
 */
export interface Blocker {
  /** Short machine-readable code, e.g. "HARD_SKIP", "GATE_FAIL", "MISSING_EVIDENCE". */
  readonly code: string;
  /** Human-readable explanation of what failed. */
  readonly message: string;
  /** ISO-8601 wall-clock of when the block was set. */
  readonly since: string;
  /** Optional hint for the external actor who will resolve the block. */
  readonly resolution?: string;
}

// ─── SpineConfig ──────────────────────────────────────────────────────────────
// state-machine.md §2.2 — external discipline provider

/**
 * External discipline provider — maps a spine stage to its HARD-forced disciplines.
 * state-machine.md §2.2: disciplinesFor() is called at stage entry; result is
 * snapshotted into forced_disciplines and NEVER carried over between stages.
 *
 * Implementors may derive this from the corpus (GOAL-3 §4a) or from a test fixture.
 * This file makes no assumptions about the backing store.
 */
export interface SpineConfig {
  /**
   * Returns the complete list of HARD-forced disciplines for the given stage.
   * Must be a pure, synchronous read — no mutations.
   */
  disciplinesFor(stage: SpineStage): readonly ForcedDiscipline[];
}

// ─── ImaState ─────────────────────────────────────────────────────────────────
// state-machine.md §1 — single source of truth for a running IMA session

/**
 * Complete state of a running IMA session.
 *
 * Invariants (state-machine.md §1):
 * 1. active_stage is always inside [window.start, window.stop] OR equals "END".
 * 2. forced_disciplines is always re-derived at stage entry — never carried over.
 * 3. next_handoff equals the stage after active_stage when inside the window,
 *    "END" when active_stage === window.stop, and null when active_stage === "END".
 * 4. decision_owner is "agent" for M0/M1/M3/M4, "human" for M2.
 * 5. blocked and blocker are the only pair that can be set mid-stage; all other
 *    fields change only at transition boundaries.
 *
 * M0 HARD-safe binding (GOAL-3 §10.2):
 *   A skipped HARD discipline sets blocked = true regardless of mode.
 *   M0/M1/M2/M3 all respect the HARD floor — it is a law, not a gate.
 */
export interface ImaState {
  // ── Identity ────────────────────────────────────────────────────────────────
  /** Unique run identifier, e.g. "run_20260517143000". state-machine.md §1. */
  readonly run_id: string;

  // ── Position ────────────────────────────────────────────────────────────────
  /**
   * Current active stage on the spine.
   * Equals "END" only after the window is fully exhausted. state-machine.md §1.
   */
  readonly active_stage: SpineStage;

  /** The contiguous window activated at enter(). state-machine.md §1. */
  readonly window: StageWindow;

  // ── Mode ────────────────────────────────────────────────────────────────────
  /** Operating mode for this run. state-machine.md §1. */
  readonly mode: ImaMode;

  // ── Disciplines ─────────────────────────────────────────────────────────────
  /**
   * HARD disciplines for the current active_stage, injected at stage entry.
   * Empty array when active_stage === "END". state-machine.md §1.
   */
  readonly forced_disciplines: readonly ForcedDiscipline[];

  // ── History ─────────────────────────────────────────────────────────────────
  /**
   * Stages that have reached DONE within this run, in spine order.
   * state-machine.md §1.
   */
  readonly completed_stages: readonly SpineStage[];

  // ── Routing ─────────────────────────────────────────────────────────────────
  /**
   * Where the machine goes after the current stage completes.
   * null only when active_stage === "END" or when blocked. state-machine.md §1.
   */
  readonly next_handoff: SpineStage | null;

  /**
   * Who owns the go/no-go decision to advance.
   * state-machine.md §1: "agent" for M0/M1/M3/M4, "human" for M2.
   */
  readonly decision_owner: DecisionOwner;

  // ── Block status ────────────────────────────────────────────────────────────
  /**
   * Whether the machine is halted pending external resolution.
   * state-machine.md §1, §2.4: set only via hardSkip(), cleared via unblock().
   */
  readonly blocked: boolean;

  /**
   * Present only when blocked === true.
   * state-machine.md §1, §2.4.
   */
  readonly blocker?: Blocker;

  // ── Audit ───────────────────────────────────────────────────────────────────
  /** ISO-8601 wall-clock of last mutation. state-machine.md §1. */
  readonly updated_at: string;
}

// ─── Transition result ────────────────────────────────────────────────────────
// state-machine.md §2.3

/**
 * Discriminated union returned by advance().
 * state-machine.md §2.3.
 */
export type AdvanceResult =
  | { readonly ok: true; readonly state: ImaState }
  | { readonly ok: false; readonly state: ImaState; readonly reason: string };

// ─── Inspector output ─────────────────────────────────────────────────────────
// state-machine.md §3 — D5 inspector contract

/**
 * Output of the pure D5 state inspector.
 * state-machine.md §3: emitted on every turn — no side effects, no writes.
 */
export interface InspectorOutput {
  /**
   * One-screen human-readable summary (≤ 25 terminal lines).
   * state-machine.md §3.
   */
  readonly human: string;
  /**
   * Canonical JSON snapshot — identical shape to ImaState, serializable.
   * state-machine.md §3: callers persist this after every transition.
   */
  readonly json: ImaState;
}

// ─── §2.1 Helper: spine index arithmetic ─────────────────────────────────────
// state-machine.md §2.1

/**
 * Returns the 0-based index of stage s on SPINE.
 * Throws for unknown stage names (programming error, not a runtime branch).
 * state-machine.md §2.1.
 */
function stageIndex(s: SpineStage): number {
  const i = SPINE.indexOf(s);
  if (i === -1) {
    throw new Error(`[ima-state] Unknown stage: "${s}"`);
  }
  return i;
}

/**
 * Returns the stage immediately after s on SPINE, or "END" when s is the last
 * real stage ("finance") or already "END". state-machine.md §2.1.
 */
function nextStage(s: SpineStage): SpineStage {
  const i = stageIndex(s);
  return SPINE[i + 1] ?? "END";
}

/**
 * Returns true when stage is within [w.start, w.stop] (inclusive).
 * state-machine.md §2.1.
 */
function isInsideWindow(stage: SpineStage, w: StageWindow): boolean {
  return stageIndex(stage) >= stageIndex(w.start) && stageIndex(stage) <= stageIndex(w.stop);
}

/**
 * Derives the decision_owner from the mode.
 * state-machine.md §1: "human" for M2, "agent" for M0/M1/M3/M4.
 */
function decisionOwnerFor(mode: ImaMode): DecisionOwner {
  return mode === "M2" ? "human" : "agent";
}

// ─── Window validation ────────────────────────────────────────────────────────
// state-machine.md open design risk #2 — guard against invalid windows

/**
 * Validates that a StageWindow is structurally sound.
 * Throws if:
 * - start or stop is "END" (sentinel is not a valid stage boundary)
 * - stageIndex(stop) < stageIndex(start) (stop precedes start on spine)
 *
 * state-machine.md open design risk #2 (guard: stageIndex(stop) >= stageIndex(start),
 * neither equals "END").
 */
function assertWindowValid(w: StageWindow): void {
  if (w.start === "END" || w.stop === "END") {
    throw new Error(
      `[ima-state] Window boundary cannot be "END": start="${w.start}" stop="${w.stop}"`,
    );
  }
  if (stageIndex(w.stop) < stageIndex(w.start)) {
    throw new Error(`[ima-state] Window stop "${w.stop}" precedes start "${w.start}" on the spine`);
  }
}

// ─── §2.2 enter — initialize a run ───────────────────────────────────────────
// state-machine.md §2.2

/**
 * Initializes a new IMA run at window.start.
 *
 * Preconditions (throws on violation):
 * - window.start and window.stop must be real spine stages (not "END").
 * - stageIndex(window.stop) >= stageIndex(window.start).
 *
 * Post-conditions (state-machine.md §2.2):
 * - active_stage = window.start
 * - forced_disciplines = spineConfig.disciplinesFor(window.start)
 * - next_handoff = "END" if window.start === window.stop, else nextStage(window.start)
 * - completed_stages = []
 * - blocked = false
 * - decision_owner derived from mode
 *
 * @param run_id   Unique run identifier (caller-supplied, e.g. "run_20260517143000")
 * @param window   Contiguous spine window [start, stop] (inclusive)
 * @param mode     Operating mode for this run
 * @param spineConfig  External discipline provider (pure, synchronous)
 */
export function enter(
  run_id: string,
  window: StageWindow,
  mode: ImaMode,
  spineConfig: SpineConfig,
): ImaState {
  assertWindowValid(window);

  const active_stage = window.start;
  const forced_disciplines = spineConfig.disciplinesFor(active_stage);
  const next_handoff: SpineStage = active_stage === window.stop ? "END" : nextStage(active_stage);

  return {
    run_id,
    active_stage,
    window,
    mode,
    forced_disciplines: [...forced_disciplines],
    completed_stages: [],
    next_handoff,
    decision_owner: decisionOwnerFor(mode),
    blocked: false,
    updated_at: new Date().toISOString(),
  };
}

// ─── §2.3 advance — stage-complete event ─────────────────────────────────────
// state-machine.md §2.3

/**
 * Advances the state machine after the active stage signals completion.
 *
 * Called when the active stage emits stage_complete (agent in M0/M1/M3/M4, or human
 * approves in M2). state-machine.md §2.3.
 *
 * Returns { ok: false } without mutation when:
 * - current.blocked === true ("Cannot advance: state is blocked")
 *
 * Transition rules (state-machine.md §2.3):
 * 1. Append active_stage to completed_stages.
 * 2. target = current.next_handoff ?? "END"
 * 3. If target === "END" or not inside window → finalize (active_stage = "END",
 *    forced_disciplines = [], next_handoff = null).
 * 4. Otherwise → advance: active_stage = target, reload forced_disciplines from
 *    spineConfig, next_handoff = (target === window.stop) ? "END" : nextStage(target).
 *
 * M0 HARD-safe (GOAL-3 §10.2): advance() itself does not bypass HARD gates;
 * those are enforced upstream by the caller before invoking advance(). The state
 * machine merely records the transition.
 *
 * @param current     Current IMA state (immutable — returns new object)
 * @param spineConfig External discipline provider for the next stage
 */
export function advance(current: ImaState, spineConfig: SpineConfig): AdvanceResult {
  if (current.blocked) {
    return { ok: false, state: current, reason: "Cannot advance: state is blocked" };
  }

  const completed_stages: SpineStage[] = [...current.completed_stages, current.active_stage];
  const target: SpineStage = current.next_handoff ?? "END";

  // Window exhausted or target outside window → finalize
  if (target === "END" || !isInsideWindow(target, current.window)) {
    const finalState: ImaState = {
      ...current,
      active_stage: "END",
      forced_disciplines: [],
      completed_stages,
      next_handoff: null,
      blocked: false,
      updated_at: new Date().toISOString(),
    };
    return { ok: true, state: finalState };
  }

  // Advance into next stage — reload disciplines, never carry over (state-machine.md §1 invariant 2)
  const forced_disciplines = spineConfig.disciplinesFor(target);
  const next_handoff: SpineStage = target === current.window.stop ? "END" : nextStage(target);

  const nextState: ImaState = {
    ...current,
    active_stage: target,
    forced_disciplines: [...forced_disciplines],
    completed_stages,
    next_handoff,
    blocked: false,
    updated_at: new Date().toISOString(),
  };
  return { ok: true, state: nextState };
}

// ─── §2.4 hardSkip — HARD discipline cannot be satisfied ─────────────────────
// state-machine.md §2.4, GOAL-3 §10.2

/**
 * Blocks the state machine because a HARD discipline cannot be satisfied.
 *
 * This is the ONLY way blocked becomes true (state-machine.md §1 invariant 5,
 * §2.4). The machine halts at the current active_stage; all other fields are
 * preserved. External resolution (unblock()) is required before advance() may
 * proceed.
 *
 * M0 HARD-safe binding (GOAL-3 §10.2): hardSkip() is mode-independent.
 * A skipped HARD discipline BLOCKs in every mode including M0 full-bypass.
 * Honesty and the HARD floor are laws, not gates — they cannot be bypassed.
 *
 * @param current     Current IMA state
 * @param code        Machine-readable blocker code (e.g. "HARD_SKIP", "GATE_FAIL")
 * @param message     Human-readable explanation of what failed
 * @param resolution  Optional hint for unblocking (state-machine.md §2.4)
 */
export function hardSkip(
  current: ImaState,
  code: string,
  message: string,
  resolution?: string,
): ImaState {
  return {
    ...current,
    blocked: true,
    blocker: {
      code,
      message,
      since: new Date().toISOString(),
      ...(resolution !== undefined ? { resolution } : {}),
    },
    updated_at: new Date().toISOString(),
  };
}

// ─── §2.5 unblock — external resolution clears the blocker ───────────────────
// state-machine.md §2.5

/**
 * Clears the blocked state after external resolution.
 *
 * Returns the same state (identity) if not currently blocked — idempotent.
 * state-machine.md §2.5: unblock() resumes the machine at the same active_stage;
 * no stage is skipped; forced_disciplines are preserved unchanged.
 *
 * @param current Current IMA state
 */
export function unblock(current: ImaState): ImaState {
  if (!current.blocked) {
    return current;
  }

  // Destructure blocker out without carrying it forward (state-machine.md §2.5)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { blocker: _dropped, ...rest } = current;
  return {
    ...rest,
    blocked: false,
    updated_at: new Date().toISOString(),
  };
}

// ─── §3 D5 State Inspector ────────────────────────────────────────────────────
// state-machine.md §3 — pure function, no side effects, no writes

/**
 * D5 State Inspector — pure function emitted on every turn.
 *
 * Produces:
 * - human: one-screen summary (≤ 25 lines) suitable for stdout / HUD display.
 * - json: canonical JSON snapshot of the state, identical shape to ImaState,
 *   serializable without loss.
 *
 * state-machine.md §3: the caller emits inspect(state).human to stdout and
 * persists inspect(state).json to the state file after every transition.
 *
 * @param state The current IMA state (not mutated)
 */
export function inspectState(state: ImaState): InspectorOutput {
  const progress: string = (() => {
    if (state.active_stage === "END") {
      return "FINALIZED";
    }
    const total = stageIndex(state.window.stop) - stageIndex(state.window.start) + 1;
    const done = state.completed_stages.filter((s) => isInsideWindow(s, state.window)).length;
    return `${done}/${total} stages done`;
  })();

  const statusLine: string = state.blocked
    ? `BLOCKED [${state.blocker?.code ?? "UNKNOWN"}] — ${state.blocker?.message ?? ""}`
    : state.active_stage === "END"
      ? "FINALIZED"
      : "ACTIVE";

  const disciplinesStr =
    state.forced_disciplines.length > 0 ? state.forced_disciplines.join(", ") : "—";

  const completedStr = state.completed_stages.length > 0 ? state.completed_stages.join(" → ") : "—";

  const nextHandoffStr = state.next_handoff ?? "—";

  const human = [
    "┌─ IMA State ─────────────────────────────────────",
    `│  run_id        : ${state.run_id}`,
    `│  active_stage  : ${state.active_stage}`,
    `│  window        : [${state.window.start} → ${state.window.stop}]`,
    `│  mode          : ${state.mode}`,
    `│  progress      : ${progress}`,
    `│  next_handoff  : ${nextHandoffStr}`,
    `│  decision_owner: ${state.decision_owner}`,
    `│  status        : ${statusLine}`,
    `│  disciplines   : ${disciplinesStr}`,
    `│  completed     : ${completedStr}`,
    "└─────────────────────────────────────────────────",
  ].join("\n");

  return { human, json: state };
}
