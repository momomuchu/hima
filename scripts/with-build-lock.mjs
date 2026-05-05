import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const staleLockMs = Number(process.env.HIMA_BUILD_LOCK_STALE_MS ?? 900_000);
const lockTimeoutMs = Number(process.env.HIMA_BUILD_LOCK_TIMEOUT_MS ?? staleLockMs + 600_000);
const pollMs = Number(process.env.HIMA_BUILD_LOCK_POLL_MS ?? 100);
const heartbeatMs = Number(
  process.env.HIMA_BUILD_LOCK_HEARTBEAT_MS ?? Math.max(1_000, Math.min(30_000, staleLockMs / 3)),
);

const rawArgs = process.argv.slice(2);
const shellMode = rawArgs[0] === "--shell";
const commandArgs = shellMode ? rawArgs.slice(1) : rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
const configuredLockPath = process.env.HIMA_BUILD_LOCK_PATH;

if (commandArgs.length === 0) {
  console.error("Usage: node scripts/with-build-lock.mjs [--shell] -- <command> [args...]");
  process.exit(1);
}

const commandLabel = shellMode
  ? commandArgs.join(" ")
  : [commandArgs[0], ...commandArgs.slice(1)].join(" ");

const lockDirectory = configuredLockPath
  ? path.resolve(projectRoot, configuredLockPath)
  : path.join(projectRoot, ".tmp-hima-build-lock");
const lockMetadataPath = path.join(lockDirectory, "owner.json");
let acquiredAt;

if (process.env.HIMA_BUILD_LOCK_HELD === "1") {
  process.exit(await runCommand(commandArgs, shellMode));
}

let lockHeld = false;
let heartbeat;

try {
  await acquireLock();
  lockHeld = true;
  heartbeat = startHeartbeat();
  process.exitCode = await runCommand(commandArgs, shellMode);
} finally {
  if (heartbeat) {
    clearInterval(heartbeat);
  }
  if (lockHeld) {
    await releaseLock();
  }
}

async function acquireLock() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < lockTimeoutMs) {
    try {
      await mkdir(lockDirectory);
      acquiredAt = new Date().toISOString();
      await writeLockMetadata();
      return;
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }

      await removeStaleLockIfNeeded();
      await sleep(pollMs);
    }
  }

  const metadata = await readLockMetadata();
  throw new Error(`Timed out waiting for HIMA build lock after ${lockTimeoutMs}ms.\n${metadata}`);
}

async function removeStaleLockIfNeeded() {
  const lockStats = await stat(lockDirectory).catch(() => undefined);
  const metadataStats = await stat(lockMetadataPath).catch(() => undefined);
  const metadataHeartbeatMs = await readMetadataHeartbeatMs();
  const lastHeartbeatMs = Math.max(
    lockStats?.mtimeMs ?? 0,
    metadataStats?.mtimeMs ?? 0,
    metadataHeartbeatMs ?? 0,
  );
  if (!lockStats || Date.now() - lastHeartbeatMs < staleLockMs) {
    return;
  }

  await releaseLock();
}

async function releaseLock() {
  await rm(lockDirectory, { recursive: true, force: true });
}

function startHeartbeat() {
  return setInterval(() => {
    writeLockMetadata().catch(() => undefined);
  }, heartbeatMs);
}

async function writeLockMetadata() {
  await writeFile(
    lockMetadataPath,
    `${JSON.stringify(
      {
        pid: process.pid,
        command: commandLabel,
        acquiredAt,
        heartbeatAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

async function readLockMetadata() {
  const metadata = await readFile(lockMetadataPath, "utf8").catch(() => "");
  return metadata ? `Current lock owner:\n${metadata}` : "Current lock owner: unknown";
}

async function readMetadataHeartbeatMs() {
  const metadata = await readFile(lockMetadataPath, "utf8").catch(() => undefined);
  if (!metadata) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(metadata);
    const timestamp = Date.parse(parsed.heartbeatAt ?? parsed.acquiredAt ?? "");
    return Number.isNaN(timestamp) ? undefined : timestamp;
  } catch {
    return undefined;
  }
}

function runCommand(args, useShell) {
  return new Promise((resolve) => {
    const child = useShell
      ? spawn(args.join(" "), {
          env: { ...process.env, HIMA_BUILD_LOCK_HELD: "1" },
          shell: true,
          stdio: "inherit",
        })
      : spawn(args[0], args.slice(1), {
          env: { ...process.env, HIMA_BUILD_LOCK_HELD: "1" },
          shell: process.platform === "win32" && !isNodeExecutable(args[0]),
          stdio: "inherit",
        });

    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

function isAlreadyExistsError(error) {
  return error && typeof error === "object" && "code" in error && error.code === "EEXIST";
}

function isNodeExecutable(command) {
  const commandName = path.basename(command).toLowerCase();
  return (
    commandName === "node" ||
    commandName === "node.exe" ||
    commandName === path.basename(process.execPath).toLowerCase()
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
