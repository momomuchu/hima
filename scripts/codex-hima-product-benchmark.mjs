import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const iteration = Number(args.iteration ?? "1");
const timeoutSeconds = Number(args.timeoutSeconds ?? "1800");
const timestamp = timestampForPath(new Date());
const benchmarkRoot = path.join(
  repoRoot,
  ".planning",
  "loop",
  "codex-product-benchmark",
  `${timestamp}-iteration-${String(iteration).padStart(3, "0")}`,
);
const workspace = path.join(benchmarkRoot, "workspace");
const logsRoot = path.join(benchmarkRoot, "logs");
const artifactsRoot = path.join(repoRoot, ".omx", "artifacts");
const cliEntry = path.join(repoRoot, "packages", "cli", "dist", "index.js");
const hookCommandPrefix = `node "${toShellPath(cliEntry)}"`;
const promptFile = path.join(benchmarkRoot, "prompt.md");
const jsonlLog = path.join(logsRoot, "codex.events.jsonl");
const stderrLog = path.join(logsRoot, "codex.stderr.log");
const finalMessageFile = path.join(logsRoot, "codex.final-message.md");
const summaryFile = path.join(benchmarkRoot, "summary.md");
const artifactFile = path.join(
  artifactsRoot,
  `codex-product-benchmark-${timestamp}-iteration-${String(iteration).padStart(3, "0")}.md`,
);

await main();

async function main() {
  await assertFile(cliEntry, "CLI dist entry");
  await mkdir(workspace, { recursive: true });
  await mkdir(logsRoot, { recursive: true });
  await mkdir(artifactsRoot, { recursive: true });

  const prompt = buildPrompt(iteration);
  await writeFile(promptFile, prompt, "utf8");

  const preflight = {
    benchmarkRoot,
    workspace,
    cliEntry,
    hookCommandPrefix,
    timeoutSeconds,
    startedAt: new Date().toISOString(),
  };
  await writeFile(
    path.join(benchmarkRoot, "preflight.json"),
    `${JSON.stringify(preflight, null, 2)}\n`,
  );

  const codexVersion = await runCommand({
    name: "codex-version",
    command: bin("codex"),
    args: ["--version"],
    cwd: workspace,
    timeoutMs: 30_000,
  });

  const init = await runHarness({
    name: "harness-init",
    args: ["init", "--root", workspace],
    timeoutMs: 30_000,
  });

  const lifecycle = await runHarness({
    name: "harness-lifecycle-apply-codex",
    args: [
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
    ],
    timeoutMs: 120_000,
  });

  const probeBefore = await runHarness({
    name: "harness-runtime-probe-before",
    args: [
      "runtime",
      "probe",
      "codex",
      "--root",
      workspace,
      "--bind",
      "--verifyBlockingFixtures",
      "--json",
    ],
    timeoutMs: 60_000,
  });

  const codex =
    codexVersion.exitCode === 0 && init.exitCode === 0 && lifecycle.exitCode === 0
      ? await runCodex(prompt)
      : undefined;

  const packageChecks = await runPackageChecks();
  const probeAfter = await runHarness({
    name: "harness-runtime-probe-after",
    args: [
      "runtime",
      "probe",
      "codex",
      "--root",
      workspace,
      "--bind",
      "--verifyBlockingFixtures",
      "--json",
    ],
    timeoutMs: 60_000,
  });
  const statusAfter = await runHarness({
    name: "harness-status-after",
    args: ["status", "--root", workspace, "--json"],
    timeoutMs: 30_000,
  });

  const summary = await buildSummary({
    codexVersion,
    init,
    lifecycle,
    probeBefore,
    codex,
    packageChecks,
    probeAfter,
    statusAfter,
  });

  await writeFile(summaryFile, summary.markdown, "utf8");
  await writeFile(artifactFile, summary.artifactMarkdown, "utf8");
  await writeFile(
    path.join(benchmarkRoot, "summary.json"),
    `${JSON.stringify(summary.json, null, 2)}\n`,
  );

  console.log(
    JSON.stringify(
      {
        verdict: summary.json.verdict,
        qualityScore: summary.json.quality.score,
        benchmarkRoot,
        summary: summaryFile,
        artifact: artifactFile,
      },
      null,
      2,
    ),
  );

  if (summary.json.verdict === "FAIL") {
    process.exitCode = 1;
  }
}

async function runCodex(prompt) {
  const stdout = createWriteStream(jsonlLog, { flags: "w" });
  const stderr = createWriteStream(stderrLog, { flags: "w" });
  let timedOut = false;
  const start = Date.now();

  const child = spawnCommand(
    bin("codex"),
    [
      "exec",
      "--cd",
      workspace,
      "--skip-git-repo-check",
      "--dangerously-bypass-approvals-and-sandbox",
      "--ignore-user-config",
      "--enable",
      "hooks",
      "--json",
      "--output-last-message",
      finalMessageFile,
      "-",
    ],
    {
      cwd: workspace,
      env: {
        ...process.env,
        HIMA_BENCHMARK_ROOT: benchmarkRoot,
        HIMA_BENCHMARK_ITERATION: String(iteration),
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  child.stdin.end(prompt);

  const timeout = setTimeout(() => {
    timedOut = true;
    killProcessTree(child.pid);
  }, timeoutSeconds * 1000);
  timeout.unref();

  const exitCode = await new Promise((resolve) => {
    child.on("close", (code, signal) => resolve(code ?? signal ?? 1));
  });
  clearTimeout(timeout);
  stdout.end();
  stderr.end();
  const finalMessage = (await readTextIfExists(finalMessageFile)) ?? "";
  const completedSentinel = finalMessage.includes("CODEX_HIMA_PRODUCT_DONE");
  if (exitCode === 0 && completedSentinel) {
    timedOut = false;
  }

  return {
    name: "codex",
    exitCode,
    timedOut,
    completedSentinel,
    durationMs: Date.now() - start,
    stdoutFile: jsonlLog,
    stderrFile: stderrLog,
    finalMessageFile,
  };
}

async function runPackageChecks() {
  const checks = [];
  const packageJson = path.join(workspace, "package.json");
  if (!(await exists(packageJson))) {
    return [
      {
        name: "package-json-present",
        exitCode: 1,
        timedOut: false,
        durationMs: 0,
        stdoutText: "",
        stderrText: "package.json missing",
      },
    ];
  }

  checks.push(
    await runCommand({
      name: "npm-test-if-present",
      command: bin("npm"),
      args: ["test", "--if-present"],
      cwd: workspace,
      timeoutMs: 120_000,
    }),
  );
  checks.push(
    await runCommand({
      name: "npm-run-build-if-present",
      command: bin("npm"),
      args: ["run", "build", "--if-present"],
      cwd: workspace,
      timeoutMs: 120_000,
    }),
  );

  for (const file of await listWorkspaceFiles()) {
    if (!file.endsWith(".js") || file.includes("node_modules/")) {
      continue;
    }
    checks.push(
      await runCommand({
        name: `node-check-${file}`,
        command: process.execPath,
        args: ["--check", path.join(workspace, file)],
        cwd: workspace,
        timeoutMs: 30_000,
      }),
    );
  }

  return checks;
}

async function buildSummary({
  codexVersion,
  init,
  lifecycle,
  probeBefore,
  codex,
  packageChecks,
  probeAfter,
  statusAfter,
}) {
  const workspaceFiles = await listWorkspaceFiles();
  const runSet = await readJsonIfExists(path.join(workspace, ".planning", "run-set.json"));
  const events = Array.isArray(runSet?.events) ? runSet.events : [];
  const evidence = Array.isArray(runSet?.evidence) ? runSet.evidence : [];
  const finalMessage = (await readTextIfExists(finalMessageFile)) ?? "";
  const transcript = (await readTextIfExists(jsonlLog)) ?? "";
  const stderr = (await readTextIfExists(stderrLog)) ?? "";
  const quality = await scoreQuality({ workspaceFiles, packageChecks, finalMessage });
  const hookSignals = {
    jsonlHookMentions: countRegex(transcript, /hook/i),
    jsonlHimaMentions: countRegex(transcript, /hima/i),
    stderrHookValidationFailures: countRegex(
      stderr,
      /Hook JSON output validation failed|Expected schema|\(root\): Invalid input/g,
    ),
    runSetEvents: events.length,
    gateEvents: events.filter((event) => event.gateType !== undefined).length,
    developmentEntries: events.filter((event) => event.type === "DEVELOPMENT_MODE_ENTERED").length,
    acceptedEvidence: evidence.filter((entry) => entry.status === "accepted").length,
    finalizationState: runSet?.finalization?.state,
  };
  const commandResults = [
    codexVersion,
    init,
    lifecycle,
    probeBefore,
    ...(codex ? [codex] : []),
    ...packageChecks,
    probeAfter,
    statusAfter,
  ];
  const packageFailures = packageChecks.filter((check) => check.exitCode !== 0).length;
  const hardFailures = commandResults.filter((result) => result.exitCode !== 0).length;
  const verdict =
    codex?.exitCode === 0 &&
    !codex.timedOut &&
    codex.completedSentinel &&
    packageFailures === 0 &&
    quality.score >= 75 &&
    hookSignals.acceptedEvidence > 0 &&
    hookSignals.finalizationState === "DONE_VERIFIED" &&
    hookSignals.stderrHookValidationFailures === 0
      ? "PASS"
      : "FAIL";

  const json = {
    verdict,
    benchmarkRoot,
    workspace,
    codexExit: codex?.exitCode ?? "not-run",
    codexTimedOut: codex?.timedOut ?? false,
    hardFailures,
    packageFailures,
    quality,
    hookSignals,
    workspaceFiles,
    commands: commandResults.map(compactCommandResult),
  };

  const markdown = [
    `# Codex HIMA Product Benchmark Iteration ${iteration}`,
    "",
    `## Verdict: ${verdict}`,
    "",
    `- Benchmark root: \`${benchmarkRoot}\``,
    `- Workspace: \`${workspace}\``,
    `- Codex exit: ${codex?.exitCode ?? "not-run"}`,
    `- Codex timed out: ${codex?.timedOut ? "yes" : "no"}`,
    `- Quality score: ${quality.score}/100`,
    `- Package check failures: ${packageFailures}`,
    `- Hook validation failures: ${hookSignals.stderrHookValidationFailures}`,
    `- HIMA run-set events: ${hookSignals.runSetEvents}`,
    `- HIMA gate events: ${hookSignals.gateEvents}`,
    `- HIMA development entries: ${hookSignals.developmentEntries}`,
    `- Accepted evidence events: ${hookSignals.acceptedEvidence}`,
    `- HIMA finalization: ${hookSignals.finalizationState ?? "unknown"}`,
    "",
    "## Quality Rubric",
    ...quality.items.map(
      (item) => `- ${item.name}: ${item.passed ? "PASS" : "FAIL"} (${item.points}/${item.max})`,
    ),
    "",
    "## Pinpoint Findings",
    ...pinpointFindings({ verdict, quality, hookSignals, codex, packageFailures }),
    "",
    "## Commands",
    ...commandResults.map(commandSummary),
    "",
    "## Workspace Files",
    ...workspaceFiles.map((file) => `- ${file}`),
    "",
    "## Logs",
    `- Prompt: \`${promptFile}\``,
    `- Codex JSONL: \`${jsonlLog}\``,
    `- Codex stderr: \`${stderrLog}\``,
    `- Codex final message: \`${finalMessageFile}\``,
    `- Run-set: \`${path.join(workspace, ".planning", "run-set.json")}\``,
    "",
  ].join("\n");

  const artifactMarkdown = [
    "# Codex HIMA Product Benchmark Artifact",
    "",
    "## User Task",
    "Benchmark Codex under HIMA from a banal idea to a complete product and identify precise gaps.",
    "",
    "## Prompt Sent To Codex",
    "",
    await readFile(promptFile, "utf8"),
    "",
    "## Summary",
    markdown,
  ].join("\n");

  return { json, markdown, artifactMarkdown };
}

async function scoreQuality({ workspaceFiles, packageChecks, finalMessage }) {
  const textByFile = new Map();
  for (const file of workspaceFiles) {
    if (!/\.(html|css|js|json|md)$/i.test(file)) {
      continue;
    }
    textByFile.set(file, await readFile(path.join(workspace, file), "utf8"));
  }

  const allText = [...textByFile.values(), finalMessage].join("\n").toLowerCase();
  const hasFile = (fileName) =>
    workspaceFiles.some((file) => file.toLowerCase().endsWith(fileName));
  const hasPattern = (pattern) => pattern.test(allText);
  const packageChecksPass =
    packageChecks.length > 0 && packageChecks.every((check) => check.exitCode === 0);
  const items = [
    rubric("index.html present", hasFile("index.html"), 10),
    rubric(
      "CSS present",
      hasFile("styles.css") || workspaceFiles.some((file) => file.endsWith(".css")),
      8,
    ),
    rubric(
      "JavaScript present",
      hasFile("app.js") || workspaceFiles.some((file) => file.endsWith(".js")),
      10,
    ),
    rubric("README present", hasFile("readme.md"), 8),
    rubric("package.json present", hasFile("package.json"), 8),
    rubric(
      "test artifact present",
      workspaceFiles.some((file) => /test|spec/i.test(file)),
      8,
    ),
    rubric("tests and build pass", packageChecksPass, 18),
    rubric("localStorage persistence", hasPattern(/localstorage/), 8),
    rubric("focus and interruption workflow", hasPattern(/focus/) && hasPattern(/interruption/), 6),
    rubric(
      "convergence concept implemented",
      hasPattern(/convergence|iteration|stop condition/),
      8,
    ),
    rubric(
      "offline/no external dependency posture",
      !hasPattern(/https?:\/\/|cdn\.|unpkg|jsdelivr/),
      8,
    ),
  ];

  return {
    score: items.reduce((sum, item) => sum + item.points, 0),
    maxScore: items.reduce((sum, item) => sum + item.max, 0),
    items,
  };
}

function rubric(name, passed, max) {
  return {
    name,
    passed,
    points: passed ? max : 0,
    max,
  };
}

function pinpointFindings({ verdict, quality, hookSignals, codex, packageFailures }) {
  const findings = [];
  if (codex === undefined) {
    findings.push("- Codex did not run because preflight failed.");
  } else if (codex.timedOut) {
    findings.push("- Codex timed out before completing the product loop.");
  } else if (codex.exitCode !== 0) {
    findings.push(`- Codex exited non-zero: ${codex.exitCode}.`);
  }
  if (packageFailures > 0) {
    findings.push(`- Generated product has ${packageFailures} failing package/static checks.`);
  }
  for (const item of quality.items.filter((entry) => !entry.passed)) {
    findings.push(`- Product quality gap: ${item.name}.`);
  }
  if (hookSignals.runSetEvents === 0) {
    findings.push("- HIMA gap: no run-set events were recorded during real Codex execution.");
  }
  if (hookSignals.developmentEntries === 0) {
    findings.push(
      "- HIMA gap: Codex did not enter development mode through the canonical run-set.",
    );
  }
  if (hookSignals.acceptedEvidence === 0) {
    findings.push("- HIMA gap: Codex did not record accepted evidence.");
  }
  if (hookSignals.finalizationState !== "DONE_VERIFIED") {
    findings.push(
      `- HIMA gap: finalization is ${hookSignals.finalizationState ?? "missing"}, not DONE_VERIFIED.`,
    );
  }
  if (hookSignals.stderrHookValidationFailures > 0) {
    findings.push("- Hook contract gap: Codex stderr contains hook JSON validation failures.");
  }
  if (verdict === "PASS" && findings.length === 0) {
    findings.push("- No benchmark failure found in this iteration.");
  }
  return findings;
}

async function runHarness({ name, args: commandArgs, timeoutMs }) {
  return runCommand({
    name,
    command: process.execPath,
    args: [cliEntry, ...commandArgs],
    cwd: repoRoot,
    timeoutMs,
  });
}

async function runCommand({ name, command, args: commandArgs, cwd, timeoutMs }) {
  await mkdir(path.join(logsRoot, "commands"), { recursive: true });
  const stdoutFile = path.join(logsRoot, "commands", `${sanitizeFileName(name)}.stdout.log`);
  const stderrFile = path.join(logsRoot, "commands", `${sanitizeFileName(name)}.stderr.log`);
  const stdout = createWriteStream(stdoutFile, { flags: "w" });
  const stderr = createWriteStream(stderrFile, { flags: "w" });
  const start = Date.now();
  let timedOut = false;

  const child = spawnCommand(command, commandArgs, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);

  const timeout = setTimeout(() => {
    timedOut = true;
    killProcessTree(child.pid);
  }, timeoutMs);
  timeout.unref();

  const exitCode = await new Promise((resolve) => {
    child.on("close", (code, signal) => resolve(code ?? signal ?? 1));
  });
  clearTimeout(timeout);
  stdout.end();
  stderr.end();

  return {
    name,
    command,
    args: commandArgs,
    cwd,
    exitCode,
    timedOut,
    durationMs: Date.now() - start,
    stdoutFile,
    stderrFile,
  };
}

function commandSummary(result) {
  return [
    `- ${result.name}: exit=${result.exitCode ?? "n/a"}, timeout=${result.timedOut ? "yes" : "no"}, durationMs=${result.durationMs ?? "n/a"}`,
    result.stdoutFile ? `  - stdout: \`${result.stdoutFile}\`` : "",
    result.stderrFile ? `  - stderr: \`${result.stderrFile}\`` : "",
    result.finalMessageFile ? `  - final: \`${result.finalMessageFile}\`` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function compactCommandResult(result) {
  return {
    name: result.name,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    completedSentinel: result.completedSentinel,
    durationMs: result.durationMs,
    stdoutFile: result.stdoutFile,
    stderrFile: result.stderrFile,
  };
}

async function listWorkspaceFiles() {
  if (!(await exists(workspace))) {
    return [];
  }
  const files = [];
  await walk(workspace, files);
  return files
    .map((file) => path.relative(workspace, file).replaceAll(path.sep, "/"))
    .filter(
      (file) =>
        !file.startsWith(".planning/") &&
        !file.startsWith(".codex/") &&
        !file.startsWith("node_modules/"),
    )
    .sort();
}

async function walk(directory, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

async function readJsonIfExists(filePath) {
  const text = await readTextIfExists(filePath);
  return text === undefined ? undefined : JSON.parse(text);
}

async function readTextIfExists(filePath) {
  if (!(await exists(filePath))) {
    return undefined;
  }
  return readFile(filePath, "utf8");
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertFile(filePath, label) {
  if (!(await exists(filePath))) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function buildPrompt(currentIteration) {
  const harnessCommand = `node "${toShellPath(cliEntry)}"`;

  return [
    "You are running inside an isolated Codex benchmark workspace with HIMA hooks, skills, and subagent prompts installed under .codex.",
    "",
    `Benchmark iteration: ${currentIteration}.`,
    "",
    "Start from this banal product idea and turn it into a complete product:",
    "",
    'Idea: "A small offline browser app for freelancers to plan focus sessions, log interruptions, and see whether the day is converging or drifting."',
    "",
    "Use the local HIMA/Codex setup when it is visible. Work autonomously. Do not ask questions.",
    "",
    "Expected product qualities:",
    "- It must be usable by opening index.html.",
    "- It must not require network access or external dependencies.",
    "- It should feel like a complete small utility, not a throwaway demo.",
    "- It should persist data locally.",
    "- It should include its own README and benchmark/product report.",
    "- It should include package.json scripts for test and build using only Node built-ins.",
    "- It should include meaningful tests for the app logic.",
    "",
    "HIMA expectations:",
    "- If the HIMA CLI is available, enter development mode before implementation.",
    `- HIMA CLI command prefix: ${harnessCommand}`,
    "- Prefer risk class M and mode auto unless evidence suggests another route.",
    "- Before finishing, record accepted evidence for ci_green, sast_clean, secrets_clean, integration_tests, review_1, sbom, and product_validation when true.",
    "- Use the installed .codex skills/subagent prompts when useful, especially testing, review, accessibility, and security.",
    "",
    "Finish only after tests and build pass. Print CODEX_HIMA_PRODUCT_DONE when complete.",
  ].join("\n");
}

function countRegex(text, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...text.matchAll(new RegExp(pattern.source, flags))].length;
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

function timestampForPath(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function toShellPath(filePath) {
  return path.resolve(filePath).replaceAll("\\", "/");
}

function sanitizeFileName(value) {
  return value.replace(/[^a-z0-9_.-]/gi, "_");
}

function bin(command) {
  return process.platform === "win32" ? `${command}.cmd` : command;
}

function spawnCommand(command, commandArgs, options) {
  if (process.platform !== "win32" || !command.endsWith(".cmd")) {
    return spawn(command, commandArgs, options);
  }

  return spawn(command, commandArgs, { ...options, shell: true });
}

function killProcessTree(processId) {
  if (processId === undefined) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(processId), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  try {
    process.kill(-processId, "SIGKILL");
  } catch {
    try {
      process.kill(processId, "SIGKILL");
    } catch {
      // The process may already have exited.
    }
  }
}
