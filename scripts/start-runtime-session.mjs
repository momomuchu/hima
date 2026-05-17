import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, cp, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = path.join(repoRoot, "packages", "cli", "dist", "index.js");
const fixtureRoot = path.join(repoRoot, "fixtures", "runtime-session", "small-feature");
const runtimeTargets = new Set(["claude", "codex", "hermes"]);

const args = process.argv.slice(2);
const target = args.find((arg) => !arg.startsWith("-"));
const dryRun = args.includes("--dry-run");
const keepOpen = !args.includes("--no-launch");
const workspaceArg = readOption(args, "--workspace");
const promptArg = readOption(args, "--prompt");
const logArg = readOption(args, "--log");

if (!target || !runtimeTargets.has(target)) {
  console.error(
    "Usage: node scripts/start-runtime-session.mjs <claude|codex|hermes> [--dry-run] [--no-launch] [--workspace <path>]",
  );
  process.exit(1);
}

const workspace = path.resolve(workspaceArg ?? defaultWorkspace(target));
const hookPrefix = buildHookPrefix(workspace);
const setupCommands = [
  ["node", [cliEntry, "init", "--root", workspace]],
  [
    "node",
    [
      cliEntry,
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
      "T",
      "--objective",
      `${target} manual runtime session`,
      "--prompt",
      "Manual HIMA runtime fixture session",
      "--reason",
      "one-command manual runtime session launcher",
    ],
  ],
  [
    "node",
    [
      cliEntry,
      "install",
      target,
      "--root",
      workspace,
      "--apply",
      "--force",
      "--writeManifest",
      "--hookCommandPrefix",
      hookPrefix,
    ],
  ],
  [
    "node",
    [
      cliEntry,
      "runtime",
      "probe",
      target,
      "--root",
      workspace,
      "--bind",
      "--verifyBlockingFixtures",
    ],
  ],
];
const launchCommand = runtimeLaunchCommand(target);
const transcriptFile = logArg ? path.resolve(logArg) : undefined;

await assertPathExists(cliEntry, "Built CLI dist entry is required. Run: corepack pnpm build");
await assertPathExists(fixtureRoot, "Runtime session fixture is missing");

if (!(await commandExists(target))) {
  console.error(`Blocked: '${target}' is not available on PATH.`);
  process.exit(1);
}

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        target,
        workspace,
        hookPrefix,
        setupCommands: setupCommands.map(([command, commandArgs]) =>
          [command, ...commandArgs].join(" "),
        ),
        launchCommand: [launchCommand.command, ...launchCommand.args].join(" "),
        transcriptFile,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

await prepareWorkspace(workspace);

console.log(`HIMA ${target} session`);
console.log(`Workspace: ${workspace}`);
console.log("Task: read TASK.md, implement the fixture, run npm test.");

for (const [command, commandArgs] of setupCommands) {
  await run(command, commandArgs, { cwd: repoRoot, stdio: "inherit" });
}

const testCommand = packageTestCommand();
const beforeTestExit = await runAllowFailure(testCommand.command, testCommand.args, {
  cwd: workspace,
  stdio: "inherit",
});
console.log(`Pre-session npm test exit: ${beforeTestExit}`);

if (keepOpen) {
  console.log(`Launching ${target}. Exit the runtime to return to the post-session probe.`);
  await run(launchCommand.command, withPromptArgs(target, launchCommand.args, promptArg), {
    cwd: workspace,
    stdio: transcriptFile ? "pipe" : "inherit",
    shell: launchCommand.shell,
    stdin: promptArg,
    transcriptFile,
  });

  await run(testCommand.command, testCommand.args, { cwd: workspace, stdio: "inherit" });
}

console.log("Post-session runtime probe");
await run(
  "node",
  [cliEntry, "runtime", "probe", target, "--root", workspace, "--bind", "--verifyBlockingFixtures"],
  { cwd: repoRoot, stdio: "inherit" },
);

function readOption(inputArgs, name) {
  const index = inputArgs.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = inputArgs[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
}

function defaultWorkspace(runtimeTarget) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/u, "Z");
  const base =
    process.platform === "win32"
      ? "C:\\hima-runtime-workspaces"
      : path.join(homedir(), ".hima-runtime-workspaces");

  return path.join(base, `manual-${runtimeTarget}-${stamp}`);
}

function buildHookPrefix(workspaceRoot) {
  const wrapper = shellSafeWindowsPath(hookWrapperPath(workspaceRoot));

  return process.platform === "win32"
    ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${wrapper}"`
    : `${process.execPath} ${cliEntry}`;
}

async function writeHookWrapper(workspaceRoot) {
  await mkdir(workspaceRoot, { recursive: true });
  const wrapper = hookWrapperPath(workspaceRoot);
  const content = [
    `$Cli = '${cliEntry.replaceAll("'", "''")}'`,
    "& node $Cli @args",
    "exit $LASTEXITCODE",
    "",
  ].join("\n");

  await writeFile(wrapper, content, "utf8");
}

function hookWrapperPath(workspaceRoot) {
  return path.join(workspaceRoot, "hima-hook.ps1");
}

async function prepareWorkspace(workspaceRoot) {
  await mkdir(path.dirname(workspaceRoot), { recursive: true });

  if (await pathExists(workspaceRoot)) {
    const workspaceStat = await stat(workspaceRoot);
    if (!workspaceStat.isDirectory()) {
      throw new Error(`Workspace exists and is not a directory: ${workspaceRoot}`);
    }

    const entries = await readdir(workspaceRoot);
    const onlyWrapper = entries.length === 1 && entries[0] === "hima-hook.ps1";
    if (entries.length > 0 && !onlyWrapper) {
      throw new Error(`Workspace is not empty. Pick another --workspace: ${workspaceRoot}`);
    }
  }

  await cp(fixtureRoot, workspaceRoot, { recursive: true });
  await writeHookWrapper(workspaceRoot);
  await initializeGitWorkspace(workspaceRoot);
}

async function initializeGitWorkspace(workspaceRoot) {
  await run("git", ["init"], { cwd: workspaceRoot, stdio: "ignore" });
  await run("git", ["add", "-A"], { cwd: workspaceRoot, stdio: "ignore" });
  await run(
    "git",
    [
      "-c",
      "user.name=HIMA Runtime",
      "-c",
      "user.email=hima-runtime@example.invalid",
      "commit",
      "-m",
      "Seed runtime fixture",
    ],
    { cwd: workspaceRoot, stdio: "ignore" },
  );
}

function runtimeLaunchCommand(runtimeTarget) {
  if (runtimeTarget === "codex") {
    return {
      command: "codex",
      args: ["--ignore-user-config", "--skip-git-repo-check"],
      shell: process.platform === "win32",
    };
  }

  return { command: runtimeTarget, args: [], shell: false };
}

function packageTestCommand() {
  return process.platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", "npm test"] }
    : { command: "npm", args: ["test"] };
}

function withPromptArgs(runtimeTarget, launchArgs, prompt) {
  if (!prompt) {
    return launchArgs;
  }

  if (runtimeTarget === "claude") {
    return [...launchArgs, "--permission-mode", "bypassPermissions", "--print", prompt];
  }

  if (runtimeTarget === "codex") {
    return [
      "exec",
      "--ignore-user-config",
      "--skip-git-repo-check",
      "--dangerously-bypass-approvals-and-sandbox",
      "-",
    ];
  }

  return [...launchArgs, prompt];
}

function shellSafeWindowsPath(inputPath) {
  return inputPath.replaceAll("\\", "/");
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

async function run(command, commandArgs, options) {
  const transcriptHandle = options.transcriptFile
    ? await openTranscript(options.transcriptFile)
    : undefined;
  const child = spawn(command, commandArgs, {
    cwd: options.cwd,
    stdio: options.stdio,
    shell: options.shell ?? false,
  });

  return new Promise((resolve, reject) => {
    if (options.stdio === "pipe") {
      if (options.stdin) {
        child.stdin.end(options.stdin);
      } else {
        child.stdin.end();
      }

      child.stdout.on("data", (chunk) => {
        process.stdout.write(chunk);
        transcriptHandle?.write(chunk);
      });
      child.stderr.on("data", (chunk) => {
        process.stderr.write(chunk);
        transcriptHandle?.write(chunk);
      });
    }

    child.on("error", async (error) => {
      await transcriptHandle?.close();
      reject(error);
    });
    child.on("close", async (exitCode) => {
      await transcriptHandle?.close();
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${commandArgs.join(" ")} exited ${exitCode}`));
    });
  });
}

async function runAllowFailure(command, commandArgs, options) {
  try {
    await run(command, commandArgs, options);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/ exited (?<exitCode>[0-9]+)$/u);

    return match?.groups?.exitCode ? Number(match.groups.exitCode) : 1;
  }
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
