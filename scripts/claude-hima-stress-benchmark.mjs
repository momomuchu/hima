import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const iteration = Number(args.iteration ?? "1");
const timeoutSeconds = Number(args.timeoutSeconds ?? "3600");
const model = args.model ?? "sonnet";
const effort = args.effort ?? "high";
const timestamp = timestampForPath(new Date());
const benchmarkRoot = path.join(
  repoRoot,
  ".planning",
  "loop",
  "benchmarks",
  "hima-stress-app",
  `${timestamp}-iteration-${String(iteration).padStart(3, "0")}`,
);
const workspace = path.join(benchmarkRoot, "workspace");
const logsRoot = path.join(benchmarkRoot, "logs");
const artifactsRoot = path.join(repoRoot, ".omx", "artifacts");
const cliEntry = path.join(repoRoot, "packages", "cli", "dist", "index.js");
const hookCommandPrefix = `node "${toShellPath(cliEntry)}"`;
const promptFile = path.join(benchmarkRoot, "prompt.md");
const settingsFile = path.join(workspace, ".claude", "settings.json");
const streamLog = path.join(logsRoot, "claude.stream.jsonl");
const debugLog = path.join(logsRoot, "claude.debug.log");
const stderrLog = path.join(logsRoot, "claude.stderr.log");
const summaryFile = path.join(benchmarkRoot, "summary.md");
const emptyMcpConfigFile = path.join(benchmarkRoot, "empty-mcp-config.json");
const artifactFile = path.join(
  artifactsRoot,
  `claude-hima-stress-app-${timestamp}-iteration-${String(iteration).padStart(3, "0")}.md`,
);

await main();

async function main() {
  await assertFile(cliEntry, "CLI dist entry");
  await mkdir(workspace, { recursive: true });
  await mkdir(logsRoot, { recursive: true });
  await mkdir(artifactsRoot, { recursive: true });

  const prompt = buildPrompt(iteration);
  await writeFile(promptFile, prompt, "utf8");
  await writeFile(emptyMcpConfigFile, `${JSON.stringify({ mcpServers: {} }, null, 2)}\n`, "utf8");

  const preflight = {
    benchmarkRoot,
    workspace,
    cliEntry,
    hookCommandPrefix,
    timeoutSeconds,
    model,
    effort,
    startedAt: new Date().toISOString(),
  };
  await writeFile(
    path.join(benchmarkRoot, "preflight.json"),
    `${JSON.stringify(preflight, null, 2)}\n`,
  );

  const claudeVersion = await runCommand({
    name: "claude-version",
    command: "claude",
    args: ["--version"],
    cwd: workspace,
    timeoutMs: 30_000,
  });

  const init = await runCommand({
    name: "harness-init",
    command: process.execPath,
    args: [cliEntry, "init", "--root", workspace],
    cwd: repoRoot,
    timeoutMs: 30_000,
  });

  const transition = await runCommand({
    name: "harness-transition-build-execute",
    command: process.execPath,
    args: [cliEntry, "transition", "build", "--subPhase", "Execute", "--root", workspace],
    cwd: repoRoot,
    timeoutMs: 30_000,
  });

  const lifecycle = await runCommand({
    name: "harness-lifecycle-apply",
    command: process.execPath,
    args: [
      cliEntry,
      "lifecycle",
      "apply",
      "claude",
      "--root",
      workspace,
      "--kind",
      "all",
      "--apply",
      "--hookCommandPrefix",
      hookCommandPrefix,
      "--json",
    ],
    cwd: repoRoot,
    timeoutMs: 120_000,
  });

  if (
    lifecycle.exitCode !== 0 ||
    init.exitCode !== 0 ||
    transition.exitCode !== 0 ||
    claudeVersion.exitCode !== 0
  ) {
    await writeSummary({
      claudeVersion,
      init,
      transition,
      lifecycle,
      claude: undefined,
      packageChecks: [],
      timedOut: false,
    });
    process.exitCode = 1;
    return;
  }

  await copyFile(settingsFile, path.join(benchmarkRoot, "settings.snapshot.json"));

  const claude = await runClaude(prompt);
  const packageChecks = await runPackageChecks();

  await writeSummary({
    claudeVersion,
    init,
    transition,
    lifecycle,
    claude,
    packageChecks,
    timedOut: claude.timedOut,
  });

  if (claude.exitCode !== 0 || packageChecks.some((check) => check.exitCode !== 0)) {
    process.exitCode = 1;
  }
}

async function runClaude(prompt) {
  const stdout = createWriteStream(streamLog, { flags: "w" });
  const stderr = createWriteStream(stderrLog, { flags: "w" });
  let timedOut = false;
  const start = Date.now();

  const child = spawn(
    "claude",
    [
      "-p",
      prompt,
      "--model",
      model,
      "--effort",
      effort,
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-hook-events",
      "--debug-file",
      debugLog,
      "--settings",
      settingsFile,
      "--setting-sources",
      "project",
      "--mcp-config",
      emptyMcpConfigFile,
      "--strict-mcp-config",
      "--dangerously-skip-permissions",
    ],
    {
      cwd: workspace,
      env: {
        ...process.env,
        HIMA_BENCHMARK_ROOT: benchmarkRoot,
        HIMA_BENCHMARK_ITERATION: String(iteration),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, timeoutSeconds * 1000);
  timeout.unref();

  const exitCode = await new Promise((resolve) => {
    child.on("close", (code, signal) => resolve(code ?? signal ?? 1));
  });
  clearTimeout(timeout);
  stdout.end();
  stderr.end();

  return {
    name: "claude",
    exitCode,
    timedOut,
    durationMs: Date.now() - start,
    stdoutFile: streamLog,
    stderrFile: stderrLog,
    debugFile: debugLog,
  };
}

async function runPackageChecks() {
  const packageJson = path.join(workspace, "package.json");
  if (!(await exists(packageJson))) {
    return [
      {
        name: "workspace-package-checks",
        exitCode: 1,
        skipped: false,
        reason: "workspace package.json not found",
      },
    ];
  }

  const packageFile = await readJsonIfExists(packageJson);
  const scripts =
    typeof packageFile?.scripts === "object" && packageFile.scripts !== null
      ? packageFile.scripts
      : {};

  return [
    await runPackageScriptCheck("workspace-test", "test", scripts.test),
    await runPackageScriptCheck("workspace-build", "build", scripts.build),
  ];
}

async function runPackageScriptCheck(name, scriptName, script) {
  if (typeof script !== "string" || script.trim().length === 0) {
    return {
      name,
      exitCode: 1,
      skipped: false,
      reason: `package.json script ${scriptName} is missing`,
    };
  }

  const nodeArgs = parseNodeScript(script);
  if (nodeArgs) {
    return runCommand({
      name,
      command: process.execPath,
      args: nodeArgs,
      cwd: workspace,
      timeoutMs: 300_000,
    });
  }

  return runCommand({
    name,
    command: bin("npm"),
    args: ["run", scriptName, "--if-present"],
    cwd: workspace,
    timeoutMs: 300_000,
    shell: process.platform === "win32",
  });
}

function parseNodeScript(script) {
  const tokens = tokenizeCommand(script.trim());
  const [command, ...args] = tokens;

  if (command !== "node") {
    return null;
  }

  return args.length === 0 ? null : args;
}

async function runCommand({ name, command, args, cwd, timeoutMs, shell = false }) {
  const stdoutFile = path.join(logsRoot, `${name}.stdout.log`);
  const stderrFile = path.join(logsRoot, `${name}.stderr.log`);
  const stdout = createWriteStream(stdoutFile, { flags: "w" });
  const stderr = createWriteStream(stderrFile, { flags: "w" });
  let timedOut = false;
  const start = Date.now();
  let child;
  try {
    child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell });
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    stdout.end();
    stderr.end();
    return {
      name,
      command,
      args,
      cwd,
      exitCode: 1,
      timedOut: false,
      durationMs: Date.now() - start,
      stdoutFile,
      stderrFile,
    };
  }

  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, timeoutMs);
  timeout.unref();

  const exitCode = await new Promise((resolve) => {
    child.on("error", (error) => {
      stderr.write(`${error.message}\n`);
      resolve(1);
    });
    child.on("close", (code, signal) => resolve(code ?? signal ?? 1));
  });
  clearTimeout(timeout);
  stdout.end();
  stderr.end();

  return {
    name,
    command,
    args,
    cwd,
    exitCode,
    timedOut,
    durationMs: Date.now() - start,
    stdoutFile,
    stderrFile,
  };
}

async function writeSummary({
  claudeVersion,
  init,
  transition,
  lifecycle,
  claude,
  packageChecks,
  timedOut,
}) {
  const runSet = await readJsonIfExists(path.join(workspace, ".planning", "run-set.json"));
  const events = Array.isArray(runSet?.events) ? runSet.events : [];
  const hookValidationFailures = await countMatches(
    [streamLog, debugLog, stderrLog],
    /Hook JSON output validation failed|Expected schema|\(root\): Invalid input/g,
  );
  const invalidClaudeContractMarkers = await countMatches(
    [streamLog, debugLog, stderrLog],
    /"decision"\s*:\s*"approve"|"continue"\s*:\s*false|"stopReason"/g,
  );
  const workspaceFiles = await listWorkspaceFiles();
  const packageCheckFailures = packageChecks.filter((check) => check.exitCode !== 0).length;
  const gateWarnings = events.filter((event) => event.decision === "warn").length;
  const gateBlocks = events.filter((event) => event.decision === "block").length;
  const resultLine =
    claude?.exitCode === 0 &&
    hookValidationFailures === 0 &&
    packageCheckFailures === 0 &&
    gateWarnings === 0 &&
    gateBlocks === 0
      ? "PASS"
      : "FAIL";

  const summary = [
    `# HIMA Claude Stress Benchmark Iteration ${iteration}`,
    "",
    `## Verdict: ${resultLine}`,
    "",
    `- Started: ${new Date().toISOString()}`,
    `- Benchmark root: \`${benchmarkRoot}\``,
    `- Workspace: \`${workspace}\``,
    `- Claude exit: ${claude?.exitCode ?? "not-run"}`,
    `- Timed out: ${timedOut ? "yes" : "no"}`,
    `- Hook validation failures: ${hookValidationFailures}`,
    `- Invalid Claude contract markers: ${invalidClaudeContractMarkers}`,
    `- Package check failures: ${packageCheckFailures}`,
    `- Gate warnings: ${gateWarnings}`,
    `- Gate blocks: ${gateBlocks}`,
    `- Run-set events: ${events.length}`,
    `- Workspace files: ${workspaceFiles.length}`,
    "",
    "## Commands",
    commandSummary(claudeVersion),
    commandSummary(init),
    commandSummary(transition),
    commandSummary(lifecycle),
    ...(claude ? [commandSummary(claude)] : []),
    ...packageChecks.map(commandSummary),
    "",
    "## Gate Events",
    ...events.map(
      (event) =>
        `- ${event.gateType ?? event.type}: ${event.decision ?? "n/a"}: ${event.reason ?? ""}`,
    ),
    "",
    "## Workspace Files",
    ...workspaceFiles.map((file) => `- ${file}`),
    "",
    "## Logs",
    `- Prompt: \`${promptFile}\``,
    `- Claude stream: \`${streamLog}\``,
    `- Claude debug: \`${debugLog}\``,
    `- Claude stderr: \`${stderrLog}\``,
    `- Run-set: \`${path.join(workspace, ".planning", "run-set.json")}\``,
    "",
  ].join("\n");

  await writeFile(summaryFile, summary, "utf8");
  await writeFile(
    artifactFile,
    [
      "# Claude HIMA Stress Benchmark Artifact",
      "",
      "## Original user task",
      "Run an isolated HIMA stress app benchmark with Claude Code, capture feedback, and iterate package fixes.",
      "",
      "## Final prompt sent to Claude CLI",
      "",
      await readFile(promptFile, "utf8"),
      "",
      "## Claude output (raw)",
      `Raw stream is stored at \`${streamLog}\`.`,
      "",
      "## Concise summary",
      summary,
      "",
      "## Action items / next steps",
      hookValidationFailures > 0
        ? "- Fix Claude hook validation failures before the next iteration."
        : "- Use app/build/test failures as the next iteration input.",
    ].join("\n"),
    "utf8",
  );
}

function commandSummary(result) {
  return [
    `- ${result.name}: exit=${result.exitCode ?? "n/a"}, timeout=${result.timedOut ? "yes" : "no"}, durationMs=${result.durationMs ?? "n/a"}`,
    result.stdoutFile ? `  - stdout: \`${result.stdoutFile}\`` : "",
    result.stderrFile ? `  - stderr: \`${result.stderrFile}\`` : "",
    result.debugFile ? `  - debug: \`${result.debugFile}\`` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function listWorkspaceFiles() {
  const files = [];
  await walk(workspace, files);
  return files
    .map((file) => path.relative(workspace, file).replaceAll(path.sep, "/"))
    .filter((file) => !file.startsWith(".planning/") && !file.startsWith(".claude/"))
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

async function countMatches(files, pattern) {
  let count = 0;
  for (const file of files) {
    if (!(await exists(file))) {
      continue;
    }
    const content = await readFile(file, "utf8");
    count += [...content.matchAll(pattern)].length;
  }
  return count;
}

async function readJsonIfExists(filePath) {
  if (!(await exists(filePath))) {
    return undefined;
  }
  return JSON.parse(await readFile(filePath, "utf8"));
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
    "You are running inside an isolated benchmark workspace governed by HIMA hooks.",
    "",
    `Benchmark iteration: ${currentIteration}.`,
    "",
    'Build a small complete offline web app called "HIMA Stress Console". It must be usable by opening index.html and must not need network access or external dependencies.',
    "",
    "Required deliverables:",
    "- index.html, styles.css, app.js",
    "- package.json with test and build scripts that use only Node built-ins",
    "- test/app.test.js or equivalent Node-based tests",
    "- README.md with run/test/build instructions",
    "- BENCHMARK_REPORT.md explaining what you built and which commands you ran",
    "",
    "Functional requirements:",
    "- Show the eight HIMA macro cycles in order.",
    "- Show the seven sub-phases in order.",
    "- Let a user select risk class T/L/M/H/C and display required gates.",
    "- Include a convergence panel with iteration count, evidence status, and stop condition.",
    "- Persist UI state in localStorage.",
    "- Keep the implementation simple, readable, and deterministic.",
    "",
    "Verification requirements:",
    "- Run the test script.",
    "- Run the build script.",
    "- After both pass, record accepted HIMA evidence with these exact commands:",
    `  - ${harnessCommand} evidence add --root . --key ci_green --kind benchmark-test --status accepted --summary "test and build scripts passed"`,
    `  - ${harnessCommand} evidence add --root . --key sast_clean --kind benchmark-static-check --status accepted --summary "offline app uses no external dependencies or unsafe dynamic execution"`,
    `  - ${harnessCommand} evidence add --root . --key secrets_clean --kind benchmark-secret-check --status accepted --summary "no secrets or credentials were introduced"`,
    "- Fix any issue you find before finishing.",
    "",
    "Do not ask questions. Work autonomously in this workspace only. When done, print HIMA_STRESS_APP_DONE.",
  ].join("\n");
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

function tokenizeCommand(command) {
  return [...command.matchAll(/"([^"]*)"|'([^']*)'|([^\s]+)/g)]
    .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
    .filter((token) => token.length > 0);
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

function bin(command) {
  return process.platform === "win32" ? `${command}.cmd` : command;
}
