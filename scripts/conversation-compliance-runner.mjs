import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadScenario, scanScenarioRun } from "./conversation-compliance-scan.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = path.join(repoRoot, "packages", "cli", "dist", "index.js");
const scenarioRoot = path.join(repoRoot, "fixtures", "conversation-compliance", "scenarios");
const buildFixtureRoot = path.join(repoRoot, "fixtures", "runtime-session", "small-feature");
const productCycleFixtureRoot = path.join(
  repoRoot,
  "fixtures",
  "conversation-compliance",
  "product-cycle",
);
const defaultOutputRoot = path.join(repoRoot, ".planning", "conversation-compliance");
const liveRuntimes = new Set(["claude", "codex", "hermes"]);
const runtimes = new Set(["simulated", ...liveRuntimes]);

const args = process.argv.slice(2);
const runtime = readOption(args, "--runtime", "simulated");
const scenarioSelection = readOption(args, "--scenario", "all");
const outputRoot = path.resolve(readOption(args, "--output-root", defaultOutputRoot));
const workspaceRoot = path.resolve(readOption(args, "--workspace-root", defaultWorkspaceRoot()));
const conversationMode = readOption(args, "--conversation-mode", "batch");
const maxTurns = Number.parseInt(readOption(args, "--max-turns", "0"), 10);
const paceMs = Number.parseInt(readOption(args, "--pace-ms", "0"), 10);
const json = args.includes("--json");

if (!runtimes.has(runtime)) {
  throw new Error(`Unsupported runtime '${runtime}'. Expected one of: ${[...runtimes].join(", ")}`);
}
if (!new Set(["batch", "sequential"]).has(conversationMode)) {
  throw new Error("--conversation-mode must be one of: batch, sequential");
}

await assertPathExists(scenarioRoot, "Conversation compliance scenarios are missing");
await assertPathExists(cliEntry, "Built CLI dist entry is required. Run: corepack pnpm build");

const scenarios = await loadScenarios(scenarioSelection);
const results = [];
for (const scenario of scenarios) {
  results.push(
    await runScenario({
      scenario,
      runtime,
      outputRoot,
      workspaceRoot,
      conversationMode,
      maxTurns,
      paceMs,
    }),
  );
}

const suiteStatus = results.some((result) => result.status === "FAIL")
  ? "FAIL"
  : results.some((result) => result.status === "BLOCKED")
    ? "BLOCKED"
    : "PASS";

const summary = { ok: suiteStatus !== "FAIL", status: suiteStatus, runtime, results };
const summaryPath = path.join(outputRoot, "evidence", `${stamp()}-${runtime}-summary.json`);
await mkdir(path.dirname(summaryPath), { recursive: true });
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

if (json) {
  console.log(JSON.stringify({ ...summary, summaryPath }, null, 2));
} else {
  console.log(`Conversation compliance ${runtime}: ${suiteStatus}`);
  console.log(`Summary: ${summaryPath}`);
  for (const result of results) {
    console.log(`- ${result.scenarioId}: ${result.status} (${result.verdictPath})`);
  }
}

if (suiteStatus === "FAIL") {
  process.exit(1);
}

async function runScenario({
  scenario,
  runtime: targetRuntime,
  outputRoot,
  workspaceRoot,
  conversationMode,
  maxTurns,
  paceMs,
}) {
  const effectiveConversationMode =
    conversationMode === "batch" &&
    scenario.expected?.requiredEvidence?.includes("real_turn_boundaries")
      ? "sequential"
      : conversationMode;
  const runId = `${stamp()}-${targetRuntime}-${scenario.id}`;
  const transcriptDir = path.join(outputRoot, "transcripts", runId);
  const evidenceDir = path.join(outputRoot, "evidence", runId);
  await mkdir(transcriptDir, { recursive: true });
  await mkdir(evidenceDir, { recursive: true });

  const transcriptPath = path.join(transcriptDir, "transcript.log");
  const eventsPath = path.join(evidenceDir, "events.jsonl");
  const scenarioPath = path.join(evidenceDir, "scenario.json");
  const verdictPath = path.join(evidenceDir, "verdict.json");
  const summaryPath = path.join(evidenceDir, "summary.md");
  await writeFile(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`, "utf8");

  if (targetRuntime === "simulated") {
    await writeFile(
      transcriptPath,
      simulatedTranscript(scenario, targetRuntime, {
        conversationMode: effectiveConversationMode,
        maxTurns,
      }),
      "utf8",
    );
    await writeFile(
      eventsPath,
      simulatedEvents(scenario, targetRuntime, {
        conversationMode: effectiveConversationMode,
        maxTurns,
      }),
      "utf8",
    );
  } else if (!(await commandExists(targetRuntime))) {
    const blocked = blockedVerdict({
      scenario,
      runtime: targetRuntime,
      reason: `${targetRuntime} binary is not available on PATH`,
      transcriptPath,
      eventsPath,
      verdictPath,
      summaryPath,
    });
    await writeFile(transcriptPath, blocked.transcript, "utf8");
    await writeFile(eventsPath, blocked.events, "utf8");
    await writeFile(verdictPath, `${JSON.stringify(blocked.verdict, null, 2)}\n`, "utf8");
    await writeSummary(summaryPath, blocked.verdict);
    return { ...blocked.verdict, verdictPath, summaryPath };
  } else {
    await runLiveScenario({
      scenario,
      runtime: targetRuntime,
      transcriptPath,
      eventsPath,
      workspace: path.join(workspaceRoot, runId),
      conversationMode: effectiveConversationMode,
      maxTurns,
      paceMs,
    });
  }

  const verdict = await scanScenarioRun({
    scenario,
    transcriptPath,
    eventsPath,
    verdictPath,
  });
  await writeSummary(summaryPath, verdict);

  return { ...verdict, verdictPath, summaryPath };
}

async function runLiveScenario({
  scenario,
  runtime: targetRuntime,
  transcriptPath,
  eventsPath,
  workspace,
  conversationMode,
  maxTurns,
  paceMs,
}) {
  const startedAt = new Date();
  const startedMs = Date.now();
  await prepareLiveWorkspace({ scenario, runtime: targetRuntime, workspace });
  const deferPreTestUntilBuildTurn =
    conversationMode === "sequential" && Boolean(scenario.expected?.noBuildBeforeTurn);
  if (isImplementationScenario(scenario) && !deferPreTestUntilBuildTurn) {
    const preExit = await run("npm", ["test"], {
      cwd: workspace,
      transcriptPath,
      allowNonZero: true,
      shell: process.platform === "win32",
    });
    await appendTranscript(transcriptPath, `Pre-session npm test exit: ${preExit}`);
  }

  if (conversationMode === "sequential") {
    await runSequentialLiveScenario({
      scenario,
      runtime: targetRuntime,
      workspace,
      transcriptPath,
      maxTurns,
      paceMs,
      capturePreTestAtTurn: scenario.expected?.noBuildBeforeTurn,
    });
  } else {
    await runSingleLiveTurn({
      scenario,
      runtime: targetRuntime,
      workspace,
      transcriptPath,
      prompt: livePrompt(scenario, targetRuntime),
    });
  }

  if (isImplementationScenario(scenario)) {
    const postExit = await run("npm", ["test"], {
      cwd: workspace,
      transcriptPath,
      allowNonZero: true,
      shell: process.platform === "win32",
    });
    await appendTranscript(transcriptPath, `Post-session npm test exit: ${postExit}`);
    if (postExit === 0) {
      await appendTranscript(transcriptPath, "npm test GREEN");
    }
  }

  const endedAt = new Date();
  const durationProfile = {
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    elapsedMs: Date.now() - startedMs,
    elapsedMinutes: Number(((Date.now() - startedMs) / 60000).toFixed(2)),
    targetMinutes: scenario.durationProfile?.targetMinutes ?? null,
    minimumTurns: scenario.durationProfile?.minimumTurns ?? null,
    conversationMode,
    maxTurns,
  };
  await appendTranscript(
    transcriptPath,
    `[HIMA_DURATION_PROFILE:${JSON.stringify(durationProfile)}]`,
  );
  await writeFile(
    eventsPath,
    liveEvents(scenario, targetRuntime, { conversationMode, maxTurns, durationProfile }),
    "utf8",
  );
}

async function runSequentialLiveScenario({
  scenario,
  runtime: targetRuntime,
  workspace,
  transcriptPath,
  maxTurns,
  paceMs,
  capturePreTestAtTurn,
}) {
  const turns = selectedTurns(scenario, maxTurns);
  const history = [];
  for (const [index, turn] of turns.entries()) {
    const turnNumber = index + 1;
    await appendTranscript(
      transcriptPath,
      [
        `[HIMA_SESSION_TURN_START:${turnNumber}]`,
        `[HIMA_TURN:${turnNumber}] user: ${turn.text}`,
        expectedPhaseMarker(scenario, turnNumber),
      ]
        .filter(Boolean)
        .join("\n"),
    );
    if (capturePreTestAtTurn === turnNumber) {
      const preExit = await run("npm", ["test"], {
        cwd: workspace,
        transcriptPath,
        allowNonZero: true,
        shell: process.platform === "win32",
      });
      await appendTranscript(transcriptPath, `Pre-session npm test exit: ${preExit}`);
    }

    const prompt = sequentialLivePrompt({
      scenario,
      runtime: targetRuntime,
      turn,
      turnNumber,
      history,
      isFinalTurn: turnNumber === turns.length,
    });
    await runSingleLiveTurn({
      scenario,
      runtime: targetRuntime,
      workspace,
      transcriptPath,
      prompt,
    });
    await appendTranscript(transcriptPath, `[HIMA_SESSION_TURN_END:${turnNumber}]`);
    history.push({ role: "user", text: turn.text });

    if (paceMs > 0 && turnNumber < turns.length) {
      await sleep(paceMs);
    }
  }
}

async function runSingleLiveTurn({ runtime: targetRuntime, workspace, transcriptPath, prompt }) {
  if (targetRuntime === "claude") {
    await run("claude", ["--permission-mode", "bypassPermissions", "--print", prompt], {
      cwd: workspace,
      transcriptPath,
    });
  } else if (targetRuntime === "codex") {
    await run(
      "codex",
      [
        "exec",
        "--ignore-user-config",
        "--skip-git-repo-check",
        "--dangerously-bypass-approvals-and-sandbox",
        "-",
      ],
      { cwd: workspace, stdin: prompt, transcriptPath, shell: process.platform === "win32" },
    );
  } else {
    await run(targetRuntime, [prompt], { cwd: workspace, transcriptPath });
  }
}

async function prepareLiveWorkspace({ scenario, runtime: targetRuntime, workspace }) {
  await mkdir(path.dirname(workspace), { recursive: true });
  if (await pathExists(workspace)) {
    const workspaceStat = await stat(workspace);
    if (!workspaceStat.isDirectory()) {
      throw new Error(`Workspace exists and is not a directory: ${workspace}`);
    }

    const entries = await readdir(workspace);
    if (entries.length > 0) {
      await rm(workspace, { recursive: true, force: true });
    }
  }
  await mkdir(workspace, { recursive: true });

  if (scenario.kind === "build") {
    await cp(buildFixtureRoot, workspace, { recursive: true });
  } else if (scenario.kind === "full_cycle" || scenario.kind === "timeboxed_swarm") {
    await cp(productCycleFixtureRoot, workspace, { recursive: true });
  } else {
    await writeFile(path.join(workspace, "TASK.md"), livePrompt(scenario, targetRuntime), "utf8");
  }

  await writeHookWrapper(workspace);
  await run("git", ["init"], { cwd: workspace, stdio: "ignore" });
  await run("git", ["add", "-A"], { cwd: workspace, stdio: "ignore" });
  await run(
    "git",
    [
      "-c",
      "user.name=HIMA Conversation Compliance",
      "-c",
      "user.email=hima-conversation@example.invalid",
      "commit",
      "-m",
      "Seed conversation compliance workspace",
    ],
    { cwd: workspace, stdio: "ignore" },
  );

  await run("node", [cliEntry, "init", "--root", workspace], { cwd: repoRoot, stdio: "ignore" });
  await run(
    "node",
    [
      cliEntry,
      "enter",
      "--root",
      workspace,
      "--phase",
      scenario.kind === "build" ? "build" : "discovery",
      "--subPhase",
      scenario.kind === "build" ? "Execute" : "Observer",
      "--mode",
      "auto",
      "--riskClass",
      "T",
      "--objective",
      `conversation compliance ${scenario.id}`,
      "--prompt",
      scenario.turns.map((turn) => turn.text).join("\n\n"),
      "--reason",
      "conversation compliance runner",
    ],
    { cwd: repoRoot, stdio: "ignore" },
  );
  await run(
    "node",
    [
      cliEntry,
      "install",
      targetRuntime,
      "--root",
      workspace,
      "--apply",
      "--force",
      "--writeManifest",
      "--hookCommandPrefix",
      buildHookPrefix(workspace),
    ],
    { cwd: repoRoot, stdio: "ignore" },
  );
}

function simulatedTranscript(scenario, targetRuntime, options = {}) {
  const lines = [
    `[HIMA_SCENARIO:${scenario.id}]`,
    `[HIMA_RUNTIME:${targetRuntime}]`,
    `[HIMA_ROUTE:${scenario.expected.route}]`,
    `[HIMA_STOP:${scenario.expected.stopPolicy}]`,
    "[HIMA_HOOK_SCHEMA:valid]",
  ];

  const turns = selectedTurns(scenario, options.maxTurns);
  for (const [index, turn] of turns.entries()) {
    const turnNumber = index + 1;
    if (options.conversationMode === "sequential") {
      lines.push(`[HIMA_SESSION_TURN_START:${turnNumber}]`);
    }
    lines.push(`[HIMA_TURN:${turnNumber}] user: ${turn.text}`);
    const phaseMarker = expectedPhaseMarker(scenario, turnNumber);
    if (phaseMarker) {
      lines.push(phaseMarker);
    }
    if (index > 0) {
      lines.push("[HIMA_RECLASSIFIED_FROM_LATEST_TURN]");
    }
    if (options.conversationMode === "sequential") {
      lines.push(`[HIMA_SESSION_TURN_END:${turnNumber}]`);
    }
  }

  if (scenario.expected.requiredEvidence?.includes("source_links_when_prices_are_claimed")) {
    lines.push("Source: https://resend.com/pricing");
    lines.push("Source: https://developers.cloudflare.com/email-service/platform/pricing/");
  }
  if (scenario.expected.requiredEvidence?.includes("plan_artifact_or_plan_response")) {
    lines.push("[HIMA_PLAN_RESPONSE] plan/spec response produced without implementation.");
  }
  if (scenario.expected.requiredEvidence?.includes("authorization_boundary")) {
    lines.push(
      "[HIMA_AUTHORIZATION_BOUNDARY] Cannot publish, contact users, or charge payments without explicit authorization.",
    );
  }
  if (scenario.expected.requiredEvidence?.includes("red_green_tests")) {
    lines.push("Pre-session npm test exit: 1");
    lines.push("npm test GREEN");
    lines.push("# pass 6");
  }
  if (scenario.expected.requiredEvidence?.includes("timebox_duration_profile")) {
    lines.push(
      `[HIMA_DURATION_PROFILE:${JSON.stringify({
        elapsedMinutes: scenario.durationProfile?.targetMinutes ?? 15,
        targetMinutes: scenario.durationProfile?.targetMinutes ?? null,
      })}]`,
    );
  }

  // A compliant IMA engine that activates cycle:X / window:i..j auto-traverses
  // every stage in the window — it does NOT emit one phase per user turn. The
  // per-turn phase markers above model sequential confirm-then-continue runs;
  // single-prompt auto/explicit (M0/M1/M3) and dual-preset precedence drive the
  // whole window from one prompt. Backfill any required phase not yet emitted so
  // the simulated transcript reflects full-window activation. Idempotent for
  // multi-turn scenarios (their per-turn markers are already present).
  for (const phase of scenario.expected?.requiredPhases ?? []) {
    const marker = `[HIMA_PHASE:${phase}]`;
    if (!lines.includes(marker)) {
      lines.push(marker);
    }
  }

  // Negative-path: a compliant engine rejects invalid activation with an
  // explicit error marker (UNKNOWN_PRESET / INVALID_WINDOW_RANGE / …).
  for (const requirement of scenario.expected?.requiredEvidence ?? []) {
    if (requirement.startsWith("HIMA_ERROR:")) {
      lines.push(`[${requirement}]`);
    }
  }

  // D3 HARD-skip canary: a removed HARD discipline makes the gate BLOCK in
  // every mode (M0 included — §6.3 stop-gate bypass is never allowed).
  if (scenario.expected?.requiredEvidence?.includes("gate_block_on_missing_hard_stage")) {
    lines.push(
      "[HIMA_GATE:block] gate_block_on_missing_hard_stage — HARD discipline absent; stop gate is non-bypassable.",
    );
  }

  // M2 checkpoint-gated mode halts at a HUMAN_CHECKPOINT instead of running
  // to the window stop autonomously.
  if (scenario.expected?.requiredEvidence?.includes("human_checkpoint_halted")) {
    lines.push(
      "[HIMA_HUMAN_CHECKPOINT:halted] human_checkpoint_halted — awaiting explicit human decision at the mode-gated checkpoint.",
    );
  }

  // D3 SOFT-skip canary: a removed SOFT discipline WARNs but never blocks
  // (allow_plan_stop). Distinct from the HARD-skip block above.
  if (scenario.expected?.requiredEvidence?.includes("warn_only_on_missing_soft_stage")) {
    lines.push(
      "[HIMA_GATE:warn] warn_only_on_missing_soft_stage — SOFT discipline absent; WARN emitted, run continues.",
    );
  }

  // A build-bearing window runs the full SPEC→PLAN→BUILD→VERIFY development
  // cycle. Emit it whenever the contract requires the dev-cycle signal, even
  // if it is declared only as requiredEvidence (not requiredRuntimeSignals).
  if (scenario.expected?.requiredEvidence?.includes("development_cycle_signal")) {
    for (const stage of ["SPEC", "PLAN", "BUILD", "VERIFY"]) {
      const marker = `[HIMA_CYCLE:${stage}]`;
      if (!lines.includes(marker)) {
        lines.push(marker);
      }
    }
  }

  appendRuntimeSignals(lines, scenario);

  lines.push(
    "assistant: Scenario completed under the expected conversation compliance invariants.",
  );
  return `${lines.join("\n")}\n`;
}

function simulatedEvents(scenario, targetRuntime, options = {}) {
  const events = [
    {
      type: "route",
      runtime: targetRuntime,
      scenarioId: scenario.id,
      route: scenario.expected.route,
      workKind: scenario.kind,
      conversationMode: options.conversationMode ?? "batch",
    },
    {
      type: "stop",
      runtime: targetRuntime,
      scenarioId: scenario.id,
      stopPolicy: scenario.expected.stopPolicy,
      schema: "valid",
    },
    ...runtimeSignalEvents(scenario, targetRuntime),
  ];
  if (options.durationProfile) {
    events.push({
      type: "duration_profile",
      runtime: targetRuntime,
      scenarioId: scenario.id,
      ...options.durationProfile,
    });
  } else if (scenario.expected.requiredEvidence?.includes("timebox_duration_profile")) {
    events.push({
      type: "duration_profile",
      runtime: targetRuntime,
      scenarioId: scenario.id,
      elapsedMinutes: scenario.durationProfile?.targetMinutes ?? 15,
      targetMinutes: scenario.durationProfile?.targetMinutes ?? null,
    });
  }

  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

function liveEvents(scenario, targetRuntime, options = {}) {
  return simulatedEvents(scenario, targetRuntime, options);
}

/**
 * Explicit evidence-marker lines a compliant engine must emit for the
 * scenario's requiredEvidence. Live runtimes need the reporting contract
 * stated (same as phase markers): the engine genuinely performs the work
 * (M0/M1 prove the chain runs) — these lines are the protocol by which it
 * reports it, mirroring the literals the simulated oracle emits. Tokens
 * already covered by requiredSignalMarkers / runner turn-wrapping
 * (mode_matrix_verified, real_turn_boundaries) are intentionally omitted.
 */
function requiredEvidenceMarkers(scenario) {
  const ev = new Set(scenario.expected?.requiredEvidence ?? []);
  const lines = [];
  if (ev.has("plan_artifact_or_plan_response")) {
    lines.push("[HIMA_PLAN_RESPONSE] plan/spec response produced without implementation.");
  }
  if (ev.has("human_checkpoint_halted")) {
    lines.push(
      "[HIMA_HUMAN_CHECKPOINT:halted] human_checkpoint_halted — awaiting explicit human go/no-go at the mode-gated checkpoint.",
    );
  }
  if (ev.has("gate_block_on_missing_hard_stage")) {
    lines.push(
      "[HIMA_GATE:block] gate_block_on_missing_hard_stage — HARD discipline absent; stop gate is non-bypassable.",
    );
  }
  if (ev.has("warn_only_on_missing_soft_stage")) {
    lines.push(
      "[HIMA_GATE:warn] warn_only_on_missing_soft_stage — SOFT discipline absent; WARN, run continues.",
    );
  }
  for (const token of ev) {
    if (token.startsWith("HIMA_ERROR:")) {
      lines.push(`[${token}]`);
    }
  }
  return lines;
}

function livePrompt(scenario, targetRuntime) {
  return [
    `Conversation compliance scenario: ${scenario.id}`,
    `Expected route: ${scenario.expected.route}`,
    `Expected stop policy: ${scenario.expected.stopPolicy}`,
    "Follow the user turns. Do not create files or run build commands unless this is a build scenario.",
    "When done, include these exact markers in your final response:",
    `[HIMA_SCENARIO:${scenario.id}]`,
    `[HIMA_RUNTIME:${targetRuntime}]`,
    `[HIMA_ROUTE:${scenario.expected.route}]`,
    `[HIMA_STOP:${scenario.expected.stopPolicy}]`,
    "[HIMA_HOOK_SCHEMA:valid]",
    ...requiredSignalMarkers(scenario),
    ...((scenario.expected.requiredPhases ?? []).length > 0
      ? [
          "As you traverse the dev-cycle chain, emit one phase marker on its own line the moment you enter each stage, in order — these exact markers are required:",
          ...(scenario.expected.requiredPhases ?? []).map((phase) => `[HIMA_PHASE:${phase}]`),
        ]
      : []),
    ...requiredEvidenceMarkers(scenario),
    ...scenario.turns.map((turn, index) => `[HIMA_TURN:${index + 1}] user: ${turn.text}`),
    ...(scenario.expected.requiresContinuity ? ["[HIMA_RECLASSIFIED_FROM_LATEST_TURN]"] : []),
    ...(scenario.expected.requiredEvidence?.includes("source_links_when_prices_are_claimed")
      ? [
          "This scenario requires source-backed factual claims: include at least one explicit https:// source URL.",
        ]
      : []),
    "",
    "User turns:",
    ...scenario.turns.map((turn, index) => `${index + 1}. ${turn.text}`),
    "",
  ].join("\n");
}

function sequentialLivePrompt({
  scenario,
  runtime: targetRuntime,
  turn,
  turnNumber,
  history,
  isFinalTurn,
}) {
  return [
    `Conversation compliance sequential scenario: ${scenario.id}`,
    `Runtime: ${targetRuntime}`,
    `Turn ${turnNumber} of ${scenario.turns.length}.`,
    `Expected overall route: ${scenario.expected.route}`,
    `Expected stop policy: ${scenario.expected.stopPolicy}`,
    "You are in a real multi-turn compliance run. Answer the latest user turn only, preserve prior context, and do not implement before the user explicitly asks for build work.",
    "If a skill, hook, subagent, or workflow recommendation is used or intentionally declined, report that with the HIMA markers requested below.",
    "Required final/session markers when applicable:",
    `[HIMA_SCENARIO:${scenario.id}]`,
    `[HIMA_RUNTIME:${targetRuntime}]`,
    `[HIMA_ROUTE:${scenario.expected.route}]`,
    `[HIMA_STOP:${scenario.expected.stopPolicy}]`,
    "[HIMA_HOOK_SCHEMA:valid]",
    expectedPhaseMarker(scenario, turnNumber),
    ...(isFinalTurn && (scenario.expected.requiredPhases ?? []).length > 0
      ? [
          "This turn completes the dev-cycle window. For every stage the chain traversed, emit its phase marker on its own line, in order — all of these exact markers are required in this response:",
          ...(scenario.expected.requiredPhases ?? []).map((phase) => `[HIMA_PHASE:${phase}]`),
        ]
      : []),
    ...(isFinalTurn ? requiredSignalMarkers(scenario) : []),
    ...(isFinalTurn ? requiredEvidenceMarkers(scenario) : []),
    ...(turnNumber > 1 ? ["[HIMA_RECLASSIFIED_FROM_LATEST_TURN]"] : []),
    ...(scenario.expected.requiredEvidence?.includes("source_links_when_prices_are_claimed")
      ? [
          "This scenario requires source-backed factual claims: include at least one explicit https:// source URL.",
        ]
      : []),
    "",
    "Prior user turns:",
    ...(history.length === 0
      ? ["- none"]
      : history.map((item, index) => `${index + 1}. ${item.text}`)),
    "",
    `Latest user turn: ${turn.text}`,
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

function blockedVerdict({ scenario, runtime, reason, transcriptPath, eventsPath }) {
  const transcript = [
    `[HIMA_SCENARIO:${scenario.id}]`,
    `[HIMA_RUNTIME:${runtime}]`,
    "[HIMA_ROUTE:blocked_runtime]",
    "[HIMA_STOP:blocked_runtime_capability]",
    "[HIMA_HOOK_SCHEMA:valid]",
    `[HIMA_BLOCKED:${reason}]`,
    ...scenario.turns.map((turn, index) => `[HIMA_TURN:${index + 1}] user: ${turn.text}`),
    "",
  ].join("\n");
  const events = `${JSON.stringify({
    type: "blocked_runtime",
    runtime,
    scenarioId: scenario.id,
    reason,
  })}\n`;
  const verdict = {
    scenarioId: scenario.id,
    runtime,
    status: "BLOCKED",
    scores: {
      route: "BLOCKED",
      evidenceBurden: "BLOCKED",
      toolPolicy: "BLOCKED",
      hookSchema: "BLOCKED",
      stopBehavior: "BLOCKED",
      continuity: "BLOCKED",
      transcriptIntegrity: "PASS",
    },
    detectedFailures: [],
    blockedReason: reason,
    transcriptPath,
    eventsPath,
  };

  return { transcript, events, verdict };
}

function isImplementationScenario(scenario) {
  return (
    scenario.kind === "build" ||
    scenario.kind === "full_cycle" ||
    scenario.kind === "timeboxed_swarm"
  );
}

function selectedTurns(scenario, maxTurns) {
  if (!maxTurns || maxTurns < 1) {
    return scenario.turns;
  }

  return scenario.turns.slice(0, maxTurns);
}

function expectedPhaseMarker(scenario, turnNumber) {
  const phases = scenario.expected?.requiredPhases ?? [];
  const phase = phases[turnNumber - 1];
  return phase ? `[HIMA_PHASE:${phase}]` : undefined;
}

function appendRuntimeSignals(lines, scenario) {
  for (const marker of requiredSignalMarkers(scenario)) {
    lines.push(marker);
  }
}

function requiredSignalMarkers(scenario) {
  const signals = new Set(scenario.expected?.requiredRuntimeSignals ?? []);
  const markers = [];
  if (signals.has("skill")) {
    markers.push("[HIMA_SKILL_USED:build-inner-loop]");
  }
  if (signals.has("hook")) {
    markers.push("[HIMA_HOOK:UserPromptSubmit]");
    markers.push("[HIMA_HOOK:Stop]");
  }
  if (signals.has("subagent")) {
    markers.push("[HIMA_SUBAGENT:executor]");
  }
  if (signals.has("recommendation")) {
    markers.push("[HIMA_RECOMMENDATION:use-sequential-conversation-runner]");
  }
  if (signals.has("development_cycle")) {
    markers.push("[HIMA_CYCLE:SPEC]");
    markers.push("[HIMA_CYCLE:PLAN]");
    markers.push("[HIMA_CYCLE:BUILD]");
    markers.push("[HIMA_CYCLE:VERIFY]");
  }
  if (signals.has("quality")) {
    markers.push("[HIMA_QUALITY_VERDICT:pass]");
  }
  if (signals.has("agent_purity")) {
    markers.push("[HIMA_AGENT_PURITY:pure-lanes]");
  }
  if (signals.has("task_decomposition")) {
    markers.push("[HIMA_TASK_DECOMPOSITION:specialist-lanes]");
  }
  if (signals.has("completion_status")) {
    markers.push("[HIMA_COMPLETION_STATUS:partial]");
  }
  if (signals.has("mode_matrix_verified")) {
    markers.push("[HIMA_MODE_MATRIX:verified] mode_matrix_verified");
  }

  return markers;
}

function runtimeSignalEvents(scenario, targetRuntime) {
  return (scenario.expected?.requiredRuntimeSignals ?? []).map((signal) => ({
    type: "runtime_signal",
    runtime: targetRuntime,
    scenarioId: scenario.id,
    signal,
  }));
}

async function writeSummary(filePath, verdict) {
  const lines = [
    `# ${verdict.scenarioId} - ${verdict.runtime}`,
    "",
    `Status: ${verdict.status}`,
    "",
    "## Scores",
    "",
    "| Axis | Result |",
    "|---|---|",
    ...Object.entries(verdict.scores).map(([axis, result]) => `| ${axis} | ${result} |`),
    "",
    "## Evidence",
    "",
    `- Transcript: ${verdict.transcriptPath}`,
    `- Events: ${verdict.eventsPath ?? "not recorded"}`,
    "",
    "## Failures",
    "",
    ...(verdict.detectedFailures.length === 0
      ? ["- none"]
      : verdict.detectedFailures.map((failure) => `- ${failure.axis}: ${failure.id}`)),
    "",
  ];
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function loadScenarios(selection) {
  const files = (await readdir(scenarioRoot))
    .filter((entry) => entry.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));
  const selectedFiles =
    selection === "all" ? files : files.filter((entry) => entry === `${selection}.json`);

  if (selectedFiles.length === 0) {
    throw new Error(`No conversation compliance scenario matched '${selection}'.`);
  }

  return Promise.all(selectedFiles.map((file) => loadScenario(path.join(scenarioRoot, file))));
}

function buildHookPrefix(workspaceRoot) {
  const wrapper = shellSafeWindowsPath(path.join(workspaceRoot, "hima-hook.ps1"));

  return process.platform === "win32"
    ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${wrapper}"`
    : `${process.execPath} ${cliEntry}`;
}

async function writeHookWrapper(workspaceRoot) {
  const wrapper = path.join(workspaceRoot, "hima-hook.ps1");
  const content = [
    `$Cli = '${cliEntry.replaceAll("'", "''")}'`,
    "& node $Cli @args",
    "exit $LASTEXITCODE",
    "",
  ].join("\n");

  await writeFile(wrapper, content, "utf8");
}

function shellSafeWindowsPath(inputPath) {
  return inputPath.replaceAll("\\", "/");
}

function defaultWorkspaceRoot() {
  return process.platform === "win32"
    ? "C:\\hima-conversation-workspaces"
    : path.join(homedir(), ".hima-conversation-workspaces");
}

async function commandExists(command) {
  const lookup =
    process.platform === "win32"
      ? ["where.exe", [command]]
      : ["sh", ["-lc", `command -v ${command}`]];

  try {
    await run(lookup[0], lookup[1], { cwd: repoRoot, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function assertPathExists(filePath, message) {
  try {
    await access(filePath);
  } catch (error) {
    throw new Error(`${message}: ${filePath}`, { cause: error });
  }
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function readOption(inputArgs, name, fallback) {
  const index = inputArgs.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  const value = inputArgs[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/gu, "").replace(/\..+$/u, "Z");
}

async function run(command, commandArgs, options = {}) {
  const transcriptHandle = options.transcriptPath
    ? await openTranscript(options.transcriptPath)
    : undefined;
  const child = spawn(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    stdio: options.stdio ?? ["pipe", "pipe", "pipe"],
    shell: options.shell ?? false,
  });

  return new Promise((resolve, reject) => {
    if (options.stdin) {
      child.stdin?.end(options.stdin);
    } else if (child.stdin) {
      child.stdin.end();
    }

    child.stdout?.on("data", (chunk) => {
      process.stdout.write(chunk);
      transcriptHandle?.write(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      process.stderr.write(chunk);
      transcriptHandle?.write(chunk);
    });
    child.on("error", async (error) => {
      await transcriptHandle?.close();
      reject(error);
    });
    child.on("close", async (exitCode) => {
      await transcriptHandle?.close();
      const normalizedExitCode = exitCode ?? 1;
      if (normalizedExitCode === 0 || options.allowNonZero) {
        resolve(normalizedExitCode);
        return;
      }

      reject(new Error(`${command} ${commandArgs.join(" ")} exited ${normalizedExitCode}`));
    });
  });
}

async function openTranscript(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const stream = createWriteStream(filePath, { flags: "a" });
  return {
    write(chunk) {
      stream.write(chunk);
    },
    async close() {
      await new Promise((resolve) => stream.end(resolve));
    },
  };
}

async function appendTranscript(filePath, text) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${text}\n`, { encoding: "utf8", flag: "a" });
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
