/**
 * g3-essai-matrix.mjs — GOAL-3 essai matrix orchestrator
 *
 * Runner flags cited from conversation-compliance-runner.mjs:
 *   --runtime          line 24  readOption(args, "--runtime", "simulated")
 *   --scenario         line 25  readOption(args, "--scenario", "all")
 *   --conversation-mode line 28 readOption(args, "--conversation-mode", "batch")
 *   --output-root      line 26  readOption(args, "--output-root", defaultOutputRoot)
 *   --max-turns        line 29  readOption(args, "--max-turns", "0")
 *   --pace-ms          line 30  readOption(args, "--pace-ms", "0")
 *   --json             line 31  args.includes("--json")
 *
 * loadScenarios filter (line 729):
 *   files.filter((entry) => entry === `${selection}.json`)
 *   => --scenario takes the filename stem (without .json), NOT the internal scenario.id
 *
 * Usage:
 *   node scripts/g3-essai-matrix.mjs [--list] [--bucket D1|D2|D3|D4|D5]
 *
 * Exits 0 only if all scenarios PASS.
 */

import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenarioRoot = path.join(repoRoot, "fixtures", "conversation-compliance", "scenarios");
const runnerScript = path.join(repoRoot, "scripts", "conversation-compliance-runner.mjs");

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const bucketFilter = readArg(args, "--bucket", null);

function readArg(inputArgs, name, fallback) {
  const index = inputArgs.indexOf(name);
  if (index === -1) return fallback;
  const value = inputArgs[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

// ─── D-bucket classification ─────────────────────────────────────────────────

/**
 * Classify a filename stem into a D-bucket.
 *
 * D1 — g3-p1..p16 (product-cycle scenarios)
 * D2 — g3-d2-*
 * D3 — g3-d3-*
 * D4 — g3-d4-*
 * D5 — g3-d5-*
 */
function classifyBucket(stem) {
  if (/^g3-d2-/.test(stem)) return "D2";
  if (/^g3-d3-/.test(stem)) return "D3";
  if (/^g3-d4-/.test(stem)) return "D4";
  if (/^g3-d5-/.test(stem)) return "D5";
  if (/^g3-p\d/.test(stem)) return "D1";
  return "UNKNOWN";
}

// ─── Enumerate scenarios ─────────────────────────────────────────────────────

async function enumerateScenarios() {
  const entries = (await readdir(scenarioRoot))
    .filter((f) => f.startsWith("g3-") && f.endsWith(".json"))
    .sort((a, b) => a.localeCompare(a, undefined, { numeric: true }));

  return entries.map((filename) => {
    const stem = filename.replace(/\.json$/, "");
    const bucket = classifyBucket(stem);
    return { stem, bucket, filename };
  });
}

// ─── Run a single scenario via the real runner ───────────────────────────────

function runScenario(stem) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        runnerScript,
        "--runtime", "simulated",
        "--conversation-mode", "sequential",
        "--scenario", stem,
        "--json",
      ],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });

    child.on("close", (exitCode) => {
      let status = exitCode === 0 ? "PASS" : "FAIL";
      let reason = "";

      // Try to parse --json output for structured reason
      try {
        const parsed = JSON.parse(stdout.trim());
        status = parsed.ok ? "PASS" : (parsed.status ?? "FAIL");
        const first = parsed.results?.[0];
        if (first && first.status !== "PASS") {
          const failures = first.detectedFailures ?? [];
          reason = failures.length > 0
            ? failures.map((f) => `${f.axis}:${f.id}`).join(", ")
            : (first.status ?? "");
        }
      } catch {
        // runner wrote plain text or errored before JSON
        reason = (stderr || stdout).trim().split("\n")[0] ?? "";
      }

      resolve({ status, reason });
    });

    child.on("error", (err) => {
      resolve({ status: "FAIL", reason: err.message });
    });
  });
}

// ─── Render table ────────────────────────────────────────────────────────────

function renderTable(rows) {
  const COL_SCENARIO = 35;
  const COL_BUCKET   = 8;
  const COL_STATUS   = 8;

  const hr = `${"─".repeat(COL_SCENARIO + COL_BUCKET + COL_STATUS + 10)}`;
  const header = [
    "Scenario".padEnd(COL_SCENARIO),
    "Bucket".padEnd(COL_BUCKET),
    "Status".padEnd(COL_STATUS),
    "Reason",
  ].join(" | ");

  console.log(hr);
  console.log(header);
  console.log(hr);

  for (const { stem, bucket, status, reason } of rows) {
    const statusMark = status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : status;
    console.log(
      [
        stem.padEnd(COL_SCENARIO),
        bucket.padEnd(COL_BUCKET),
        statusMark.padEnd(COL_STATUS),
        reason ?? "",
      ].join(" | "),
    );
  }

  console.log(hr);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  let scenarios = await enumerateScenarios();

  // Apply --bucket filter
  if (bucketFilter) {
    const upper = bucketFilter.toUpperCase();
    scenarios = scenarios.filter((s) => s.bucket === upper);
    if (scenarios.length === 0) {
      console.error(`No g3 scenarios found for bucket '${bucketFilter}'.`);
      process.exit(1);
    }
  }

  console.log(`GOAL-3 essai matrix — ${scenarios.length} scenario(s)${bucketFilter ? ` [bucket: ${bucketFilter.toUpperCase()}]` : ""}`);

  // --list: enumerate only, no run
  if (listOnly) {
    const rows = scenarios.map(({ stem, bucket }) => ({
      stem,
      bucket,
      status: "—",
      reason: "",
    }));
    renderTable(rows);
    console.log(`\nTotal: ${scenarios.length} scenarios (--list, not run)`);
    return;
  }

  // Full run: sequential to avoid saturating the runner's output paths
  const rows = [];
  let passed = 0;
  let failed = 0;

  for (const { stem, bucket } of scenarios) {
    process.stdout.write(`  Running ${stem} ... `);
    const { status, reason } = await runScenario(stem);
    console.log(status + (reason ? ` (${reason})` : ""));
    rows.push({ stem, bucket, status, reason });
    if (status === "PASS") passed++;
    else failed++;
  }

  console.log();
  renderTable(rows);

  console.log(`\nPassed: ${passed} / ${scenarios.length}   Failed: ${failed}`);

  const overall = failed === 0 ? "PASS" : "FAIL";
  console.log(`\nOVERALL ${overall}`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
