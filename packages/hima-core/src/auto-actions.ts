/**
 * auto-actions.ts — pure advisory context builders (I12 AUTO-ACTION family).
 *
 * All functions are pure (no I/O, no fs). They return strings or objects that
 * the hook handlers inject as `additionalContext`. They NEVER exit 2; they are
 * advisory enrichment only.
 *
 * Gap register coverage:
 *   R-025  A-01  artifact-auto-open          → buildArtifactAutoOpenContext
 *   R-026  A-02  founder-digest auto-prepend → buildFounderDigestContext
 *   R-039  T-06  next-attack-reflex          → buildNextAttackContext
 *   R-044  A-03  review-surface-emit         → buildReviewSurfaceContext
 *   R-045  A-14  research-convert            → buildResearchConvertContext
 *
 * See: BEHAVIOR-CATALOG-v3.md §4.1 A-01/A-02/A-03/A-14; §5 T-06;
 *      founder-digest.md; cmux-open-surface.md; research-discipline.md §3.
 */

// ---------------------------------------------------------------------------
// R-025 — A-01: artifact auto-open
// ---------------------------------------------------------------------------

/**
 * Resolved environment that decides which artifact-open command to advise.
 *
 * `inCmux` is true when running inside a CMUX surface (CMUX provides the
 * `cmux markdown open` command per cmux-open-surface.md). Outside CMUX we fall
 * back to the OS-native opener so the hint is usable on Linux/Windows too.
 */
export type OpenEnv = {
  platform: NodeJS.Platform;
  inCmux: boolean;
};

/**
 * Detect the open-environment from process state. Kept impure-at-the-edge:
 * env and platform are injectable so callers/tests stay deterministic, and the
 * default reads the live process so existing callers need no change.
 *
 * CMUX detection follows cmux-open-surface.md: presence of `CMUX_WORKSPACE_ID`
 * or `CMUX_SURFACE_ID`.
 *
 * @param env       Environment map (defaults to `process.env`).
 * @param platform  Node platform string (defaults to `process.platform`).
 */
export function detectOpenEnv(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): OpenEnv {
  return {
    platform,
    inCmux: Boolean(env.CMUX_WORKSPACE_ID || env.CMUX_SURFACE_ID),
  };
}

/**
 * The shell command that opens an artifact for the resolved environment.
 *
 * - inside CMUX → `cmux markdown open <path> --focus true` (visible surface)
 * - macOS       → `open "<path>"`
 * - Windows     → `start "" "<path>"`  (empty title arg so a quoted path is
 *                 not consumed as the window title)
 * - Linux/other → `xdg-open "<path>"`
 *
 * The path is always double-quoted so paths containing spaces yield a single
 * valid command token.
 */
function artifactOpenCommand(filePath: string, openEnv: OpenEnv): string {
  if (openEnv.inCmux) {
    return `cmux markdown open "${filePath}" --focus true`;
  }
  switch (openEnv.platform) {
    case "darwin":
      return `open "${filePath}"`;
    case "win32":
      return `start "" "${filePath}"`;
    default:
      return `xdg-open "${filePath}"`;
  }
}

/**
 * Build a context line that instructs the runtime to open a plan/spec/docs
 * artifact in the visible surface, using the right command for the platform.
 *
 * Caller is responsible for deciding WHEN to emit this (only after Write to
 * a `.md` file under plans/, specs/, docs/). The function itself is pure given
 * its arguments — `openEnv` defaults to the live process via `detectOpenEnv`,
 * so in a CMUX session it still emits `cmux markdown open` (backward compatible).
 *
 * @param filePath  Absolute or relative path to the written Markdown artifact.
 * @param openEnv   Resolved environment (defaults to `detectOpenEnv()`).
 * @returns         A single-line advisory additionalContext string.
 */
export function buildArtifactAutoOpenContext(
  filePath: string,
  openEnv: OpenEnv = detectOpenEnv(),
): string {
  return `[HIMA auto] artifact written — open it: ${artifactOpenCommand(filePath, openEnv)}`;
}

// ---------------------------------------------------------------------------
// R-026 — A-02: founder-digest skeleton
// ---------------------------------------------------------------------------

/**
 * Options for buildFounderDigestContext.
 */
export type FounderDigestOpts = {
  /** DONE_VERIFIED / PARTIAL / BLOCKED + brief evidence boundary. */
  state: string;
  /** One sentence: what new decision or deliverable was produced this turn. */
  whatChanged: string;
  /** The exact shell command to inspect the diff (e.g. "git diff --stat HEAD"). */
  reviewCmd: string;
};

/**
 * Build the founder-digest skeleton (≤20 lines, 8 fields) to be prepended at
 * M+ document-heavy task completion.
 *
 * The 8 fields match founder-digest.md exactly:
 *   1. What this means
 *   2. The core loop
 *   3. Terms translated
 *   4. What is actually new
 *   5. What to challenge
 *   6. Where to look
 *   7. Review surface
 *   8. State
 *
 * Fields not inferable from opts are left as `[fill-in]` placeholders so the
 * caller (hook handler or PostToolUse enricher) can expand them with runtime
 * context.
 *
 * @param opts  State, whatChanged, and reviewCmd provided by the caller.
 * @returns     Multi-line additionalContext string (≤20 lines).
 */
export function buildFounderDigestContext(opts: FounderDigestOpts): string {
  const { state, whatChanged, reviewCmd } = opts;
  return [
    "## Founder Digest",
    "",
    `**What this means** — ${whatChanged}`,
    "**The core loop** — [fill-in]",
    "**Terms translated** — No new terms.",
    `**What is actually new** — ${whatChanged}`,
    "**What to challenge** — [fill-in]",
    "**Where to look** — [fill-in]",
    `**Review surface** — ${reviewCmd}`,
    `**State** — ${state}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// R-044 — A-03: review-surface-emit
// ---------------------------------------------------------------------------

/**
 * Build a single-line review-surface context string.
 *
 * Emits the canonical `git diff --stat HEAD` command when files were changed
 * this session, or a "no diff" note when nothing was written.
 *
 * @param changed  true when the session wrote or edited at least one file.
 * @returns        Single-line advisory additionalContext string.
 */
export function buildReviewSurfaceContext(changed: boolean): string {
  if (changed) {
    return "[HIMA] review surface: git diff --stat HEAD";
  }
  return "[HIMA] review surface: No diff this session.";
}

// ---------------------------------------------------------------------------
// R-045 — A-14: research-convert
// ---------------------------------------------------------------------------

/**
 * Build a research-evidence cite marker + conversion prompt.
 *
 * Injected after a research tool call (WebSearch, WebFetch, deep-research) at
 * M+ criticality to remind the agent to convert findings into actionable
 * requirements, decisions, and risks before trusting the recommendation.
 *
 * @param source  Human-readable source name (e.g. "WebSearch 2026-06-29",
 *                "deep-research: vitest docs", "corpus-architecture §3").
 * @returns       Single-line advisory additionalContext string.
 */
export function buildResearchConvertContext(source: string): string {
  return `[HIMA] research evidence: ${source} — convert to requirements / decisions / risks before deciding.`;
}

// ---------------------------------------------------------------------------
// R-039 — T-06: next-attack-reflex
// ---------------------------------------------------------------------------

/**
 * A single stage's sealed/open verdict, as tracked on the ward.
 *
 * `status` values considered "sealed" are: "done", "done-verified",
 * "done-validated". Any other status (e.g. "open", "blocked") is not sealed.
 */
export type StageVerdict = {
  stage: string;
  status: string;
};

/** Canonical DEV_CYCLE stage order (AMENDMENT-003, 8 stages). */
const DEV_CYCLE_STAGE_ORDER: readonly string[] = [
  "discovery",
  "analysis",
  "spec",
  "design",
  "impl",
  "test",
  "verify",
  "maintenance",
];

/** Ranked next-attack proposal keyed by the furthest-along sealed stage. */
const NEXT_ATTACK_BY_STAGE: Readonly<Record<string, string>> = {
  discovery: "open analysis (map the domain)",
  analysis: "open spec (author the contract)",
  spec: "open design (architect the solution)",
  design: "open impl (build it)",
  impl: "open test (write the tests)",
  test: "open verify (validate end-to-end)",
  verify: "open maintenance (operate it)",
  maintenance: "cycle complete — propose the next short-term goal",
};

const SEALED_STATUSES: ReadonlySet<string> = new Set([
  "done",
  "done-verified",
  "done-validated",
]);

/**
 * Build a next-attack-reflex context line emitted when a ward stage is sealed.
 *
 * Prompts the agent to propose ranked next attacks with owner surface
 * (GitHub / Linear / Notion) and evidence before asking broad questions.
 *
 * When `verdicts` is provided, sealed stages (status in done / done-verified /
 * done-validated) are enumerated and a stage-specific ranked next-step
 * proposal is emitted based on the furthest-along sealed stage in DEV_CYCLE
 * order (e.g. sealed: discovery,analysis → next attack: open spec (author the
 * contract)).
 *
 * When `verdicts` is empty or undefined, a sane default is returned that
 * simply names `openStage` as sealed and prompts for ranked next attacks.
 *
 * @param openStage  The stage name that was just sealed (e.g. "discovery",
 *                   "cadrage", "implementation") — used for the default form.
 * @param verdicts   Optional list of per-stage verdicts on the ward.
 * @returns          Single-line advisory additionalContext string.
 */
export function buildNextAttackContext(
  openStage: string,
  verdicts?: readonly StageVerdict[],
): string {
  const sealedStages = (verdicts ?? [])
    .filter((v) => SEALED_STATUSES.has(v.status))
    .map((v) => v.stage);

  if (sealedStages.length === 0) {
    return `[HIMA] stage ${openStage} sealed — propose ranked next attacks (owner surface + evidence)`;
  }

  // sealedStages.length > 0 is guaranteed by the early return above, so the
  // first element is always defined — the assertion only satisfies
  // noUncheckedIndexedAccess, it does not change runtime behavior.
  let furthest: string = sealedStages[0]!;
  for (const stage of sealedStages) {
    if (DEV_CYCLE_STAGE_ORDER.indexOf(stage) > DEV_CYCLE_STAGE_ORDER.indexOf(furthest)) {
      furthest = stage;
    }
  }

  const nextAttack =
    NEXT_ATTACK_BY_STAGE[furthest] ?? `advance past ${furthest}`;

  return `[HIMA] sealed: ${sealedStages.join(",")} → next attack: ${nextAttack} (owner surface + evidence)`;
}
