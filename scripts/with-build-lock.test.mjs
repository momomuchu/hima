import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const lockDirectory = path.join(projectRoot, `.tmp-hima-build-lock-test-${process.pid}`);

await rm(lockDirectory, { recursive: true, force: true });

try {
  const inherited = spawnSync(
    process.execPath,
    [
      "scripts/with-build-lock.mjs",
      "--",
      process.execPath,
      "-e",
      "console.log(process.env.HIMA_BUILD_LOCK_HELD)",
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env, HIMA_BUILD_LOCK_PATH: path.basename(lockDirectory) },
    },
  );

  assert.equal(inherited.status, 0, inherited.stderr);
  assert.equal(inherited.stdout.trim(), "1");
  assert.equal(existsSync(lockDirectory), false);

  const reentrant = spawnSync(
    process.execPath,
    [
      "scripts/with-build-lock.mjs",
      "--",
      process.execPath,
      "-e",
      "console.log(process.env.HIMA_BUILD_LOCK_HELD)",
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        HIMA_BUILD_LOCK_HELD: "1",
        HIMA_BUILD_LOCK_PATH: path.basename(lockDirectory),
      },
    },
  );

  assert.equal(reentrant.status, 0, reentrant.stderr);
  assert.equal(reentrant.stdout.trim(), "1");
  assert.equal(existsSync(lockDirectory), false);

  const nodeByNameArgs = spawnSync(
    process.execPath,
    [
      "scripts/with-build-lock.mjs",
      "--",
      "node",
      "-e",
      "console.log(JSON.stringify(process.argv.slice(1)))",
      "arg with spaces",
      "a&b",
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env, HIMA_BUILD_LOCK_PATH: path.basename(lockDirectory) },
    },
  );

  assert.equal(nodeByNameArgs.status, 0, nodeByNameArgs.stderr);
  assert.deepEqual(JSON.parse(nodeByNameArgs.stdout.trim()), ["arg with spaces", "a&b"]);
  assert.equal(existsSync(lockDirectory), false);

  await mkdir(lockDirectory);

  const staleRecovery = spawnSync(
    process.execPath,
    ["scripts/with-build-lock.mjs", "--", process.execPath, "-e", "console.log('stale-recovered')"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        HIMA_BUILD_LOCK_PATH: path.basename(lockDirectory),
        HIMA_BUILD_LOCK_STALE_MS: "1",
        HIMA_BUILD_LOCK_TIMEOUT_MS: "5000",
        HIMA_BUILD_LOCK_POLL_MS: "10",
      },
    },
  );

  assert.equal(staleRecovery.status, 0, staleRecovery.stderr);
  assert.equal(staleRecovery.stdout.trim(), "stale-recovered");
  assert.equal(existsSync(lockDirectory), false);

  const liveOwner = spawn(
    process.execPath,
    [
      "scripts/with-build-lock.mjs",
      "--",
      process.execPath,
      "-e",
      "setTimeout(process.exit, 1500, 0)",
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        HIMA_BUILD_LOCK_PATH: path.basename(lockDirectory),
        HIMA_BUILD_LOCK_STALE_MS: "200",
        HIMA_BUILD_LOCK_TIMEOUT_MS: "2000",
        HIMA_BUILD_LOCK_HEARTBEAT_MS: "50",
      },
      stdio: "ignore",
    },
  );

  await waitFor(() => existsSync(lockDirectory));
  await sleep(500);
  assert.equal(existsSync(lockDirectory), true);

  const liveWaiter = spawnSync(
    process.execPath,
    ["scripts/with-build-lock.mjs", "--", process.execPath, "-e", "console.log('should-not-run')"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        HIMA_BUILD_LOCK_PATH: path.basename(lockDirectory),
        HIMA_BUILD_LOCK_STALE_MS: "200",
        HIMA_BUILD_LOCK_TIMEOUT_MS: "300",
        HIMA_BUILD_LOCK_POLL_MS: "20",
      },
    },
  );

  assert.notEqual(liveWaiter.status, 0);
  assert.equal(liveWaiter.stdout.trim(), "");
  assert.equal(existsSync(lockDirectory), true);
  await waitForExit(liveOwner);
  assert.equal(existsSync(lockDirectory), false);
} finally {
  await rm(lockDirectory, { recursive: true, force: true });
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) {
      return;
    }
    await sleep(10);
  }

  throw new Error("Timed out waiting for condition.");
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    child.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
