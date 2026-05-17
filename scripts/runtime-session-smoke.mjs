import { spawn } from "node:child_process";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = path.join(repoRoot, "packages", "cli", "dist", "index.js");
const fixtureRoot = path.join(repoRoot, "fixtures", "runtime-session", "small-feature");
const runtimeTargets = ["claude", "codex", "hermes"];
const formatByRuntime = {
  claude: "claude",
  codex: "codex",
  hermes: "native",
};

async function assertPathExists(filePath, message) {
  try {
    await access(filePath);
  } catch (error) {
    throw new Error(`${message}: ${filePath}`, { cause: error });
  }
}

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (options.stdin !== undefined) {
    child.stdin.end(options.stdin);
  } else {
    child.stdin.end();
  }

  const stdoutChunks = [];
  const stderrChunks = [];
  child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
  child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (exitCode) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (exitCode !== 0) {
        reject(
          new Error(
            `${command} ${args.join(" ")} exited ${exitCode}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`,
          ),
        );
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function runExpectFailure(command, args, options = {}) {
  try {
    await run(command, args, options);
  } catch (error) {
    return error;
  }

  throw new Error(
    `${command} ${args.join(" ")} was expected to fail before runtime implementation.`,
  );
}

async function runJsonCli(args, options = {}) {
  const result = await run(process.execPath, [cliEntry, ...args], options);

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`CLI did not return JSON for ${args.join(" ")}:\n${result.stdout}`, {
      cause: error,
    });
  }
}

async function smokeRuntime(target, tempRoot) {
  const workspace = path.join(tempRoot, `workspace-${target}`);
  await cp(fixtureRoot, workspace, { recursive: true });

  const redResult = await runExpectFailure(
    process.execPath,
    ["--test", "test/calculator.test.mjs"],
    {
      cwd: workspace,
    },
  );
  if (!redResult.message.includes("clamp")) {
    throw new Error(`Expected missing clamp RED test, got: ${redResult.message}`);
  }

  const dryRun = await runJsonCli(["install", target, "--root", workspace, "--json"]);
  if (dryRun.dryRun !== true || dryRun.manifestWritten !== false) {
    throw new Error(`Unexpected ${target} dry-run install: ${JSON.stringify(dryRun, null, 2)}`);
  }
  if (!dryRun.plannedActions.some((action) => action.kind === "register_hook")) {
    throw new Error(`${target} install dry-run did not plan hook registration.`);
  }

  const apply = await runJsonCli([
    "install",
    target,
    "--root",
    workspace,
    "--apply",
    "--hookCommandPrefix",
    `${process.execPath} ${cliEntry}`,
    "--json",
  ]);
  if (apply.install?.dryRun !== false || apply.install?.manifestWritten !== false) {
    throw new Error(`Unexpected ${target} apply install shape: ${JSON.stringify(apply, null, 2)}`);
  }
  if (typeof apply.applied?.hooksAdded !== "number" || apply.applied.hooksAdded <= 0) {
    throw new Error(`${target} install apply did not add hooks.`);
  }
  if (!apply.applied?.plan?.systemPromptFile) {
    throw new Error(`${target} install apply did not expose the system prompt path.`);
  }

  const hookOutput = await runJsonCli(
    ["hook", "post-tool-use", "--root", workspace, "--dryRun", "--format", formatByRuntime[target]],
    { stdin: "{}" },
  );
  if (typeof hookOutput !== "object" || hookOutput === null) {
    throw new Error(`${target} hook dry-run returned a non-object response.`);
  }

  return {
    target,
    initialTestState: "red",
    hooksPlanned: apply.applied.plan.hooksPlanned,
    unsupportedHooks: apply.applied.plan.unsupportedHooks?.map((hook) => hook.gateType) ?? [],
    degradedHooks: apply.applied.plan.degradedHooks?.map((hook) => hook.gateType) ?? [],
  };
}

await assertPathExists(cliEntry, "Built CLI dist entry is required before runtime session smoke");
await assertPathExists(fixtureRoot, "Runtime session fixture is required");

const tempRoot = await mkdtemp(path.join(tmpdir(), "hima-runtime-session-smoke-"));

try {
  const results = [];
  for (const target of runtimeTargets) {
    results.push(await smokeRuntime(target, tempRoot));
  }

  const task = await readFile(path.join(fixtureRoot, "TASK.md"), "utf8");
  if (!task.includes("clamp(value, min, max)") || !task.includes("Do not call external services")) {
    throw new Error(
      "Runtime session task fixture is missing the portable task or safety boundary.",
    );
  }

  console.log(JSON.stringify({ ok: true, fixture: fixtureRoot, results }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
