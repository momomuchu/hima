import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const cliEntry = path.join(repoRoot, "packages", "cli", "dist", "index.js");
const args = parseArgs(process.argv.slice(2));
const iterations = Number(args.iterations ?? "60");
const timestamp = timestampForPath(new Date());
const runRoot = path.join(repoRoot, ".planning", "loop", "codex-pilot", timestamp);
const timeoutMs = Number(args.timeoutMs ?? "60000");
const hookCommandPrefix = `node "${toShellPath(cliEntry)}"`;

await main();

async function main() {
  await mkdir(runRoot, { recursive: true });
  const startedAt = new Date().toISOString();
  const iterationResults = [];

  for (let index = 1; index <= iterations; index += 1) {
    iterationResults.push(await runIteration(index));
  }

  const failures = iterationResults.flatMap((result) => result.failures);
  const report = {
    verdict: failures.length === 0 ? "PASS" : "FAIL",
    startedAt,
    completedAt: new Date().toISOString(),
    iterationsRequested: iterations,
    iterationsCompleted: iterationResults.length,
    failures: failures.length,
    runRoot,
    reports: {
      json: path.join(runRoot, "codex-pilot-report.json"),
      markdown: path.join(runRoot, "codex-pilot-report.md"),
    },
    iterationResults,
  };

  await writeFile(report.reports.json, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(report.reports.markdown, renderMarkdownReport(report), "utf8");

  console.log(
    JSON.stringify(
      {
        verdict: report.verdict,
        iterationsCompleted: report.iterationsCompleted,
        failures: report.failures,
        report: report.reports.markdown,
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

async function runIteration(iteration) {
  const iterationRoot = path.join(runRoot, `iteration-${String(iteration).padStart(3, "0")}`);
  const workspace = path.join(iterationRoot, "workspace");
  const failures = [];
  const commands = [];
  const check = (condition, name, detail) => {
    if (!condition) {
      failures.push({ iteration, name, detail });
    }
  };

  await mkdir(workspace, { recursive: true });

  const init = await runCli(["init", "--root", workspace]);
  commands.push(init.summary);
  check(init.exitCode === 0, "init exits cleanly", init);

  const lifecycle = await runCli([
    "lifecycle",
    "apply",
    "codex",
    "--root",
    workspace,
    "--kind",
    "all",
    "--apply",
    "--hookCommandPrefix",
    hookCommandPrefix,
    "--json",
  ]);
  commands.push(lifecycle.summary);
  check(lifecycle.exitCode === 0, "lifecycle apply exits cleanly", lifecycle.stderr);

  const configText = await readFile(path.join(workspace, ".codex", "config.toml"), "utf8");
  check(
    !/\[\[hooks\]\]/.test(configText),
    "Codex config uses official inline hook tables",
    configText,
  );
  check(
    (configText.match(/--format codex/g) ?? []).length === 5,
    "Codex config registers five formatted hooks",
    configText,
  );

  const probe = await runCli([
    "runtime",
    "probe",
    "codex",
    "--root",
    workspace,
    "--bind",
    "--verifyBlockingFixtures",
    "--json",
  ]);
  commands.push(probe.summary);
  const probeJson = parseJson(probe.stdout);
  check(probe.exitCode === 0, "runtime probe exits cleanly", probe.stderr);
  check(
    arraysEqual(probeJson?.registeredHooks, [
      "session_start",
      "user_prompt",
      "pre_tool",
      "post_tool",
      "stop",
    ]),
    "runtime probe registers canonical Codex hooks",
    probeJson?.registeredHooks,
  );
  check(
    arraysEqual(probeJson?.verifiedBlockingFixtures, ["user_prompt", "pre_tool", "stop"]),
    "runtime probe verifies blocking fixtures",
    probeJson?.verifiedBlockingFixtures,
  );

  const enter = await runCli([
    "enter",
    "--root",
    workspace,
    "--phase",
    "build",
    "--subPhase",
    "Execute",
    "--mode",
    "auto",
    "--riskClass",
    "M",
    "--objective",
    `Banal deterministic notes widget iteration ${iteration}`,
    "--prompt",
    "Build a tiny deterministic local notes widget with tests.",
    "--json",
  ]);
  commands.push(enter.summary);
  const enterJson = parseJson(enter.stdout);
  check(enter.exitCode === 0, "enter exits cleanly", enter.stderr);
  check(enterJson?.current?.phase === "build", "enter sets build phase", enterJson?.current);
  check(enterJson?.current?.riskClass === "M", "enter sets M risk", enterJson?.current);

  const sessionStart = await runHook(workspace, "session-start", { source: "codex-pilot" });
  commands.push(sessionStart.summary);
  check(
    sessionStart.json?.hookSpecificOutput?.hookEventName === "SessionStart",
    "SessionStart emits Codex hookSpecificOutput",
    sessionStart.json,
  );

  const userPrompt = await runHook(workspace, "user-prompt-submit", {
    promptContent: "Please build the banal deterministic notes widget now.",
  });
  commands.push(userPrompt.summary);
  check(
    userPrompt.json?.hookSpecificOutput?.hookEventName === "UserPromptSubmit",
    "UserPromptSubmit emits Codex context injection",
    userPrompt.json,
  );
  check(
    !hasInternalHookFields(userPrompt.json),
    "UserPromptSubmit hides internal HIMA fields",
    userPrompt.json,
  );

  const preTool = await runHook(workspace, "pre-tool-use", {
    toolName: "write_file",
    toolInput: { path: "app.js" },
  });
  commands.push(preTool.summary);
  check(
    preTool.exitCode === 0 && Object.keys(preTool.json ?? {}).length === 0,
    "PreToolUse allow emits empty Codex allow response",
    preTool.json,
  );

  const postTool = await runHook(workspace, "post-tool-use", {
    toolName: "write_file",
    toolInput: { path: "app.js" },
    toolResponse: { ok: true },
  });
  commands.push(postTool.summary);
  check(postTool.exitCode === 0, "PostToolUse exits cleanly", postTool.stderr);
  check(
    !hasInternalHookFields(postTool.json),
    "PostToolUse hides internal HIMA fields",
    postTool.json,
  );

  for (const [key, summary] of [
    ["ci_green", "pilot test and build checks passed"],
    ["sast_clean", "pilot static review found no unsafe dynamic execution"],
    ["secrets_clean", "pilot introduced no secrets"],
    ["integration_tests", "pilot exercised integration-level lifecycle hooks"],
    ["review_1", "pilot review checkpoint accepted the deterministic output"],
    ["sbom", "pilot has no external runtime dependencies"],
    ["product_validation", "pilot validates the banal notes-widget objective"],
  ]) {
    const evidence = await runCli([
      "evidence",
      "add",
      "--root",
      workspace,
      "--key",
      key,
      "--kind",
      "codex-pilot",
      "--status",
      "accepted",
      "--summary",
      summary,
      "--json",
    ]);
    commands.push(evidence.summary);
    check(evidence.exitCode === 0, `evidence ${key} exits cleanly`, evidence.stderr);
  }

  const stop = await runHook(workspace, "stop", {});
  commands.push(stop.summary);
  check(
    stop.exitCode === 0 && Object.keys(stop.json ?? {}).length === 0,
    "Stop allow emits empty Codex allow response",
    stop.json,
  );

  const close = await runCli(["close", "--root", workspace, "--json"]);
  commands.push(close.summary);
  const closeJson = parseJson(close.stdout);
  check(close.exitCode === 0, "close exits cleanly", close.stderr);
  check(
    closeJson?.runSet?.finalization?.state === "DONE_VERIFIED",
    "close reaches DONE_VERIFIED",
    closeJson?.runSet?.finalization,
  );

  return {
    iteration,
    workspace,
    verdict: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    commands,
  };
}

async function runHook(root, event, payload) {
  const result = await runCli(
    ["hook", event, "--root", root, "--dryRun", "--format", "codex"],
    payload,
  );
  return {
    ...result,
    json: parseJson(result.stdout),
  };
}

async function runCli(cliArgs, stdinJson) {
  const result = await runCommand({
    command: process.execPath,
    args: [cliEntry, ...cliArgs],
    cwd: repoRoot,
    stdin: stdinJson === undefined ? undefined : `${JSON.stringify(stdinJson)}\n`,
  });

  return {
    ...result,
    summary: {
      args: cliArgs,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    },
  };
}

async function runCommand({ command, args: commandArgs, cwd, stdin }) {
  const started = Date.now();
  const child = spawn(command, commandArgs, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, timeoutMs);

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });
  if (stdin !== undefined) {
    child.stdin.end(stdin);
  } else {
    child.stdin.end();
  }

  const exitCode = await new Promise((resolve) => {
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      resolve(1);
    });
    child.on("close", (code, signal) => resolve(code ?? signal ?? 1));
  });
  clearTimeout(timeout);

  return {
    exitCode,
    timedOut,
    durationMs: Date.now() - started,
    stdout,
    stderr,
  };
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = rawArgs[index + 1];
    if (next === undefined || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function arraysEqual(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((item) => actual.includes(item))
  );
}

function hasInternalHookFields(value) {
  if (value === undefined || value === null || typeof value !== "object") {
    return false;
  }
  return [
    "decision",
    "gateType",
    "failOpen",
    "contextInjection",
    "finalState",
    "violationType",
  ].some((key) => Object.hasOwn(value, key));
}

function renderMarkdownReport(report) {
  const failedIterations = report.iterationResults.filter((result) => result.failures.length > 0);
  return [
    "# Codex HIMA Pilot Report",
    "",
    `## Verdict: ${report.verdict}`,
    "",
    `- Started: ${report.startedAt}`,
    `- Completed: ${report.completedAt}`,
    `- Iterations requested: ${report.iterationsRequested}`,
    `- Iterations completed: ${report.iterationsCompleted}`,
    `- Failures: ${report.failures}`,
    `- Run root: \`${report.runRoot}\``,
    "",
    "## Scope",
    "",
    "Each iteration used an isolated workspace, installed the Codex lifecycle, verified runtime bindings, entered `build/Execute` in `auto` mode with M risk, exercised Codex hook output contracts, recorded evidence, and closed the run.",
    "",
    "## Failed Iterations",
    "",
    ...(failedIterations.length === 0
      ? ["None."]
      : failedIterations.flatMap((result) => [
          `### Iteration ${result.iteration}`,
          "",
          ...result.failures.map(
            (failure) => `- ${failure.name}: \`${stringifyDetail(failure.detail).slice(0, 500)}\``,
          ),
          "",
        ])),
    "",
    "## Iteration Summary",
    "",
    "| Iteration | Verdict | Failures | Workspace |",
    "|---:|---|---:|---|",
    ...report.iterationResults.map(
      (result) =>
        `| ${result.iteration} | ${result.verdict} | ${result.failures.length} | \`${result.workspace}\` |`,
    ),
    "",
  ].join("\n");
}

function stringifyDetail(detail) {
  if (detail === undefined) {
    return "undefined";
  }
  return JSON.stringify(detail);
}

function timestampForPath(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function toShellPath(filePath) {
  return path.resolve(filePath).replaceAll("\\", "/");
}
