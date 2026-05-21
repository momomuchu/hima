import { access, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenarioRoot = path.join(repoRoot, "fixtures", "conversation-compliance", "scenarios");
const evidenceRoot = path.join(repoRoot, ".planning", "conversation-compliance", "evidence");
const auditRoot = path.join(repoRoot, ".planning", "conversation-compliance");

const requiredScenarioIds = [
  "async-follow-up-after-stop",
  "business-idea-price-disruption",
  "casual-chat-no-dev",
  "external-action-denial",
  "invalid-stop-schema-regression",
  "planning-only-product-goal",
  "small-feature-build",
];

const requiredScannerAxes = [
  "route",
  "evidenceBurden",
  "toolPolicy",
  "hookSchema",
  "stopBehavior",
  "continuity",
  "runtimeSignals",
  "phaseCoverage",
  "turnBoundaries",
  "preBuildDiscipline",
  "transcriptIntegrity",
];

const checks = [];

await checkDocuments();
await checkScenarioFixtures();
await checkScannerCoverage();
await checkLatestRuntimeSummaries();
await checkTimeboxedPurityScenario();
await writeAudit();

const status = checks.some((check) => check.status === "FAIL")
  ? "FAIL"
  : checks.some((check) => check.status === "WEAK" || check.status === "BLOCKED")
    ? "BLOCKED"
    : "PASS";

console.log(JSON.stringify({ status, checks }, null, 2));
if (status === "FAIL") {
  process.exit(1);
}

async function checkDocuments() {
  const goalPath = path.join(repoRoot, "docs", "goals", "conversation-scenario-compliance-goal.md");
  const researchPath = path.join(
    repoRoot,
    "docs",
    "goals",
    "conversation-compliance-benchmark-research.md",
  );
  const goal = await readOptional(goalPath);
  const research = await readOptional(researchPath);

  record({
    id: "methodology_documents",
    requirement:
      "Goal and benchmark-research documents exist, and the goal links the methodology basis.",
    status:
      goal.includes("conversation-compliance-benchmark-research.md") &&
      research.includes("Benchmark Families Reviewed")
        ? "PASS"
        : "FAIL",
    evidence: [goalPath, researchPath],
  });
}

async function checkScenarioFixtures() {
  const scenarioFiles = await listJsonFiles(scenarioRoot);
  const scenarioIds = [];
  const scenarioMap = new Map();
  for (const filePath of scenarioFiles) {
    const scenario = JSON.parse(await readFile(filePath, "utf8"));
    scenarioIds.push(scenario.id);
    scenarioMap.set(scenario.id, { scenario, filePath });
  }

  const missingRequired = requiredScenarioIds.filter((id) => !scenarioIds.includes(id));
  const fullCycle = scenarioMap.get("full-product-cycle-real-session");
  record({
    id: "required_scenario_matrix",
    requirement: "Replayable JSON scenarios exist for the required Cycle 97 matrix.",
    status: missingRequired.length === 0 ? "PASS" : "FAIL",
    evidence: scenarioFiles,
    details: { scenarioIds, missingRequired },
  });

  record({
    id: "long_form_full_cycle_fixture",
    requirement:
      "A long-form real product-cycle scenario exists and declares the expected one-hour target profile.",
    status:
      fullCycle?.scenario?.durationProfile?.targetMinutes >= 60 &&
      fullCycle.scenario.turns?.length >= 8
        ? "PASS"
        : "FAIL",
    evidence: [fullCycle?.filePath].filter(Boolean),
    details: fullCycle?.scenario?.durationProfile ?? null,
  });

  const timeboxed = scenarioMap.get("timeboxed-agent-purity-session");
  record({
    id: "timeboxed_purity_fixture",
    requirement:
      "A 15-minute timeboxed agent-purity scenario exists for too-large work, partial completion, specialist lanes, and quality verdicts.",
    status:
      timeboxed?.scenario?.durationProfile?.targetMinutes === 15 &&
      timeboxed.scenario.expected?.allowPartialCompletion === true &&
      timeboxed.scenario.expected?.requiredEvidence?.includes("agent_purity_signal") &&
      timeboxed.scenario.expected?.requiredEvidence?.includes("completion_status_signal")
        ? "PASS"
        : "FAIL",
    evidence: [timeboxed?.filePath].filter(Boolean),
    details: timeboxed?.scenario?.durationProfile ?? null,
  });
}

async function checkScannerCoverage() {
  const scannerPath = path.join(repoRoot, "scripts", "conversation-compliance-scan.mjs");
  const scanner = await readOptional(scannerPath);
  const missingAxes = requiredScannerAxes.filter((axis) => !scanner.includes(`${axis}: check`));

  record({
    id: "deterministic_scanner_axes",
    requirement:
      "Scanner covers route, evidence burden, tool policy, hook schema, stop, continuity, runtime signals, phases, turn boundaries, pre-build discipline, and transcript integrity.",
    status: missingAxes.length === 0 ? "PASS" : "FAIL",
    evidence: [scannerPath],
    details: { missingAxes },
  });
}

async function checkLatestRuntimeSummaries() {
  const allSummaries = await readSummaries();
  const summaries = latestMatrixSummariesByRuntime(allSummaries);
  for (const runtime of ["simulated", "claude", "codex"]) {
    const summary = summaries.get(runtime);
    const runtimeStatus = summary?.payload?.status;
    const results = summary?.payload?.results ?? [];
    const missingScenarios = [...requiredScenarioIds, "full-product-cycle-real-session"].filter(
      (id) => !results.some((result) => result.scenarioId === id),
    );
    const nonPass = results.filter((result) => result.status !== "PASS");
    record({
      id: `${runtime}_full_matrix`,
      requirement: `${runtime} latest summary passes all required scenarios plus full-product-cycle-real-session.`,
      status:
        runtimeStatus === "PASS" && missingScenarios.length === 0 && nonPass.length === 0
          ? "PASS"
          : "FAIL",
      evidence: [summary?.path].filter(Boolean),
      details: { runtimeStatus, resultCount: results.length, missingScenarios, nonPass },
    });

    await checkRuntimeArtifacts({ runtime, summary });
  }

  const hermes = latestRuntimeSummary(allSummaries, "hermes");
  record({
    id: "hermes_runtime_status",
    requirement:
      "Hermes is either passing or explicitly BLOCKED with a binary/account/schema reason.",
    status:
      hermes?.payload?.status === "PASS" ||
      hermes?.payload?.results?.some((result) =>
        /binary|account|schema|PATH/iu.test(result.blockedReason ?? ""),
      )
        ? "PASS"
        : "BLOCKED",
    evidence: [hermes?.path].filter(Boolean),
    details: {
      runtimeStatus: hermes?.payload?.status ?? "missing",
      blockedReason: hermes?.payload?.results?.[0]?.blockedReason ?? null,
    },
  });

  await checkMeasuredLongRun(allSummaries);
}

async function checkTimeboxedPurityScenario() {
  const allSummaries = await readSummaries();
  const weak = [];
  for (const runtime of ["claude", "codex"]) {
    const { result } = latestScenarioResult(
      allSummaries,
      runtime,
      "timeboxed-agent-purity-session",
    );
    const events = result?.eventsPath ? parseJsonl(await readOptional(result.eventsPath)) : [];
    const measured = events.find((event) => event.type === "duration_profile");
    if (result?.status !== "PASS" || !measured || measured.elapsedMinutes < 15) {
      weak.push({
        runtime,
        status: result?.status ?? "missing",
        elapsedMinutes: measured?.elapsedMinutes ?? null,
        reason: "No PASS live 15-minute timeboxed agent-purity run is present.",
      });
    }
  }

  record({
    id: "measured_15_minute_agent_purity_sessions",
    requirement:
      "Claude and Codex have PASS live timeboxed-agent-purity-session runs with measured elapsedMinutes >= 15.",
    status: weak.length === 0 ? "PASS" : "WEAK",
    evidence: allSummaries.map((summary) => summary.path),
    details: { weak },
  });
}

async function checkRuntimeArtifacts({ runtime, summary }) {
  const results = summary?.payload?.results ?? [];
  const missingTranscript = [];
  const missingVerdict = [];
  const noCodeForbidden = [];
  for (const result of results) {
    if (!(await exists(result.transcriptPath))) {
      missingTranscript.push(result.scenarioId);
    }
    if (!(await exists(result.verdictPath))) {
      missingVerdict.push(result.scenarioId);
    }
    const transcript = result.transcriptPath ? await readOptional(result.transcriptPath) : "";
    if (
      !["build", "full-product-cycle-real-session", "small-feature-build"].includes(
        result.scenarioId,
      )
    ) {
      if (/\b(?:ci_green|sast_clean|secrets_clean|DONE_VERIFIED)\b/iu.test(transcript)) {
        noCodeForbidden.push(result.scenarioId);
      }
    }
  }

  record({
    id: `${runtime}_artifact_retention`,
    requirement:
      "Each runtime result retains transcript and verdict artifacts, and no-code transcripts avoid build completion burdens.",
    status:
      missingTranscript.length === 0 && missingVerdict.length === 0 && noCodeForbidden.length === 0
        ? "PASS"
        : "FAIL",
    evidence: [summary?.path].filter(Boolean),
    details: { missingTranscript, missingVerdict, noCodeForbidden },
  });
}

async function checkMeasuredLongRun(allSummaries) {
  const weak = [];
  for (const runtime of ["claude", "codex"]) {
    const { result } = latestScenarioResult(
      allSummaries,
      runtime,
      "full-product-cycle-real-session",
    );
    const events = result?.eventsPath ? parseJsonl(await readOptional(result.eventsPath)) : [];
    const measured = events.find((event) => event.type === "duration_profile");
    if (!measured || measured.elapsedMinutes < 60) {
      weak.push({
        runtime,
        elapsedMinutes: measured?.elapsedMinutes ?? null,
        reason: "No measured >=60 minute live duration profile is present in events.jsonl.",
      });
    }
  }

  record({
    id: "measured_one_hour_live_sessions",
    requirement:
      "Claude and Codex full-product-cycle live sessions have measured duration evidence at or above 60 minutes.",
    status: weak.length === 0 ? "PASS" : "WEAK",
    evidence: allSummaries.map((summary) => summary.path),
    details: { weak },
  });
}

async function readSummaries() {
  const entries = await listJsonFiles(evidenceRoot);
  const summaries = [];
  for (const filePath of entries.filter((entry) => /-summary\.json$/u.test(entry))) {
    const payload = JSON.parse(await readFile(filePath, "utf8"));
    if (payload.runtime) {
      summaries.push({ path: filePath, payload, modifiedMs: (await stat(filePath)).mtimeMs });
    }
  }

  return summaries.sort((left, right) => right.modifiedMs - left.modifiedMs);
}

function latestMatrixSummariesByRuntime(summaries) {
  const latest = new Map();
  const requiredIds = new Set([...requiredScenarioIds, "full-product-cycle-real-session"]);
  for (const summary of summaries) {
    if (latest.has(summary.payload.runtime)) {
      continue;
    }
    const resultIds = new Set((summary.payload.results ?? []).map((result) => result.scenarioId));
    if ([...requiredIds].every((id) => resultIds.has(id))) {
      latest.set(summary.payload.runtime, summary);
    }
  }
  return latest;
}

function latestScenarioResult(summaries, runtime, scenarioId) {
  for (const summary of summaries) {
    if (summary.payload.runtime !== runtime) {
      continue;
    }
    const result = summary.payload.results?.find((item) => item.scenarioId === scenarioId);
    if (result) {
      return { summary, result };
    }
  }
  return { summary: null, result: null };
}

function latestRuntimeSummary(summaries, runtime) {
  return summaries.find((summary) => summary.payload.runtime === runtime) ?? null;
}

async function writeAudit() {
  const outPath = path.join(auditRoot, "completion-audit.json");
  await writeFile(outPath, `${JSON.stringify({ checks }, null, 2)}\n`, "utf8");
}

function record(check) {
  checks.push(check);
}

async function listJsonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

async function exists(filePath) {
  if (!filePath) {
    return false;
  }
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function parseJsonl(text) {
  return text
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}
