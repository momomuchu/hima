#!/usr/bin/env node
/**
 * hc-infinite — one iteration of the never-stop greenfield loop.
 *
 * Each invocation: run ONE autonomous greenfield session at the current
 * escalating timeout, parse its SESSION-REPORT, append a row to
 * .planning/ima-greenfield/INFINITE-LOG.md, persist loop state, and print a
 * verdict + (on failure) a failure signature for the orchestrator to fix.
 *
 * Escalation: fullPipeline → grow timeout (×1.5, cap 3000s); minimum-only or
 * fail → hold timeout (the orchestrator fixes the bug before the next run).
 * The infinite loop is driven by the session Stop-hook re-invoking the
 * orchestrator, which fixes any surfaced bug then runs the next iteration —
 * real fixes between iterations, not blind repetition.
 *
 * Exit: 0 full pipeline · 2 minimum-only · 1 fail/partial (orchestrator debugs)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gfRoot = path.join(repoRoot, ".planning", "ima-greenfield");
const statePath = path.join(gfRoot, "_loop-state.json");
const logPath = path.join(gfRoot, "INFINITE-LOG.md");
mkdirSync(gfRoot, { recursive: true });

const TIMEOUT_FLOOR = 300;
const TIMEOUT_CAP = 3000;

const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { iteration: 0, timeout: 600, history: [] };
state.iteration += 1;
const iter = state.iteration;
const timeout = Math.min(TIMEOUT_CAP, Math.max(TIMEOUT_FLOOR, state.timeout));

console.log(`\x1b[35m[hc-infinite]\x1b[0m iteration ${iter} · timeout ${timeout}s`);

const before = new Set(existsSync(gfRoot) ? readdirSync(gfRoot) : []);
const r = spawnSync(
  process.execPath,
  [path.join(repoRoot, "scripts", "ima-greenfield-session.mjs"), "--timeout", String(timeout)],
  { stdio: "inherit" },
);
const sessionExit = r.status ?? 1;

// newest trace dir created by this run
const after = readdirSync(gfRoot)
  .filter((d) => !d.startsWith("_") && !before.has(d))
  .sort();
const traceDir = after.length
  ? path.join(gfRoot, after[after.length - 1])
  : path.join(
      gfRoot,
      readdirSync(gfRoot)
        .filter((d) => /^\d/.test(d))
        .sort()
        .at(-1) ?? "",
    );
const reportPath = path.join(traceDir, "SESSION-REPORT.md");
const report = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : "";

const pick = (re, d = "?") => (report.match(re) || [, d])[1];
const reachedSourcing = /reached idea-sourcing:\s*true/i.test(report);
const reachedPmf = /reached idea-to-pmf:\s*true/i.test(report);
const reachedSpec = /reached specification:\s*true/i.test(report);
const reachedBuild = /reached build:\s*true/i.test(report);
const minimumMet = reachedSourcing && reachedPmf;
const fullPipeline = minimumMet && reachedSpec && reachedBuild;
const verdict = fullPipeline ? "FULL" : minimumMet ? "MIN-ONLY" : "FAIL";
const elapsed = pick(/elapsed (\d+)s/i);
const pmfVerdict = pick(/PMF verdict \(parsed\):\s*([^\n]+)/i);
const endMarker = pick(/session-end marker:\s*([^\n]+)/i, "absent");

// failure signature for the orchestrator to act on
const errLines = (report.match(/## First 30 raw error-ish lines[\s\S]*$/i) || [""])[0]
  .split("\n")
  .slice(1, 10)
  .filter((l) => l.trim() && l.trim() !== "(none)");

// escalate
let nextTimeout = state.timeout;
if (fullPipeline) nextTimeout = Math.min(TIMEOUT_CAP, Math.round(state.timeout * 1.5));
state.timeout = nextTimeout;
state.history.push({ iter, timeout, verdict, elapsed, pmfVerdict, sessionExit, traceDir });
writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");

const row = `| ${iter} | ${new Date().toISOString().slice(0, 16)}Z | ${timeout}s | ${verdict} | src:${reachedSourcing} pmf:${reachedPmf}(${pmfVerdict}) spec:${reachedSpec} build:${reachedBuild} | end:${endMarker} elapsed:${elapsed}s exit:${sessionExit} | ${traceDir.replace(repoRoot + path.sep, "")} |`;
if (!existsSync(logPath)) {
  writeFileSync(
    logPath,
    "# HC Infinite Greenfield Loop\n\n| # | when | budget | verdict | stages | meta | trace |\n|---|---|---|---|---|---|---|\n",
    "utf8",
  );
}
writeFileSync(logPath, readFileSync(logPath, "utf8") + row + "\n", "utf8");

console.log("\n" + "─".repeat(60));
console.log(`iteration ${iter}: ${verdict}  (pmf=${pmfVerdict}, end=${endMarker}, ${elapsed}s)`);
console.log(`next timeout: ${nextTimeout}s · log: ${logPath}`);
if (verdict !== "FULL") {
  console.log("\nFAILURE SIGNATURE (orchestrator: diagnose + fix before next iteration):");
  console.log(
    `  stages: src=${reachedSourcing} pmf=${reachedPmf} spec=${reachedSpec} build=${reachedBuild}`,
  );
  console.log(`  session exit ${sessionExit}, end marker '${endMarker}'`);
  if (errLines.length) console.log("  errors:\n" + errLines.map((l) => "   " + l).join("\n"));
  console.log(`  trace: ${traceDir}`);
}
console.log("─".repeat(60));

process.exit(fullPipeline ? 0 : minimumMet ? 2 : 1);
