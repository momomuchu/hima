#!/usr/bin/env node
/**
 * GOAL-3 D7 Regression Gate
 *
 * Runs: corepack pnpm typecheck → corepack pnpm test → corepack pnpm lint
 * Flags:
 *   --only typecheck|test|lint   run a single step
 *   --continue                   do not exit-early on first failure
 *
 * Exit code: 0 = all ran steps PASS, non-zero = at least one FAIL
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..");

// ── CLI parsing ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const onlyIdx = args.indexOf("--only");
const onlyStep = onlyIdx !== -1 ? args[onlyIdx + 1] : null;
const continueOnFail = args.includes("--continue");

const VALID_STEPS = ["typecheck", "test", "lint"];
if (onlyStep && !VALID_STEPS.includes(onlyStep)) {
  console.error(`[D7] --only must be one of: ${VALID_STEPS.join(", ")}`);
  process.exit(2);
}

const stepsToRun = onlyStep ? [onlyStep] : VALID_STEPS;

// ── Runner ───────────────────────────────────────────────────────────────────
const TAIL_LINES = 40;

function tailLines(str, n) {
  const lines = str.trimEnd().split("\n");
  return lines.slice(-n).join("\n");
}

function runStep(scriptName) {
  const started = Date.now();
  console.log(`\n${"─".repeat(60)}`);
  console.log(`[D7] RUNNING: corepack pnpm ${scriptName}`);
  console.log(`${"─".repeat(60)}`);

  const result = spawnSync("corepack", ["pnpm", scriptName], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "pipe",
    shell: process.platform === "win32",
    env: { ...process.env },
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const combined = [stdout, stderr].filter(Boolean).join("\n");
  const tail = tailLines(combined, TAIL_LINES);
  const passed = result.status === 0 && result.error == null;

  // Stream the tail to console so operator sees it live
  if (tail) {
    console.log(tail);
  }
  if (result.error) {
    console.error(`[D7] spawn error: ${result.error.message}`);
  }

  return {
    step: scriptName,
    passed,
    exitCode: result.status ?? -1,
    spawnError: result.error?.message ?? null,
    elapsed,
    tail,
  };
}

// ── Execute steps ────────────────────────────────────────────────────────────
const results = [];
let aborted = false;

for (const step of stepsToRun) {
  const r = runStep(step);
  results.push(r);
  if (!r.passed && !continueOnFail) {
    aborted = true;
    console.log(`\n[D7] Step '${step}' FAILED — stopping early (use --continue to run all)`);
    break;
  }
}

// ── Summary table ────────────────────────────────────────────────────────────
const OVERALL = results.every((r) => r.passed) && !aborted;

console.log(`\n${"═".repeat(60)}`);
console.log("D7 REGRESSION GATE — SUMMARY");
console.log(`${"═".repeat(60)}`);
console.log(
  `${"Step".padEnd(12)} ${"Status".padEnd(8)} ${"Exit".padEnd(6)} ${"Time(s)".padEnd(8)} Notes`,
);
console.log(`${"─".repeat(60)}`);

for (const r of results) {
  const status = r.passed ? "PASS" : "FAIL";
  const notes = r.spawnError ? `spawn-error: ${r.spawnError}` : "";
  console.log(
    `${r.step.padEnd(12)} ${status.padEnd(8)} ${String(r.exitCode).padEnd(6)} ${r.elapsed.padEnd(8)} ${notes}`,
  );
}

// Steps not reached due to early abort
if (aborted) {
  const ran = new Set(results.map((r) => r.step));
  for (const step of stepsToRun) {
    if (!ran.has(step)) {
      console.log(`${step.padEnd(12)} ${"SKIPPED".padEnd(8)} ${"—".padEnd(6)} ${"—".padEnd(8)}`);
    }
  }
}

console.log(`${"─".repeat(60)}`);
console.log(`OVERALL: ${OVERALL ? "PASS ✓" : "FAIL ✗"}`);
console.log(`${"═".repeat(60)}\n`);

process.exit(OVERALL ? 0 : 1);
