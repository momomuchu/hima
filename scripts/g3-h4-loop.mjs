/**
 * g3-h4-loop.mjs — GOAL-3 H4 never-stop deepening loop driver
 *
 * Purpose: RICE-pick the weakest essai cell from the last verdict,
 * select the next deepening increment, print the chosen increment
 * and a LOOP-LOG-format row to stdout.
 *
 * This script is a PLANNER/DRIVER — it does NOT write files or commit.
 * The orchestrator applies the output.
 *
 * Usage:
 *   node scripts/g3-h4-loop.mjs [--dry-run] [--last-two-zero]
 *
 * Flags:
 *   --dry-run         Default. Print plan without side-effects (always true today).
 *   --last-two-zero   Circuit-breaker: two consecutive zero-delta waves. Prints
 *                     STOP+escalate and exits 3.
 *
 * Exit codes:
 *   0  — normal: increment plan printed
 *   1  — fatal error (matrix unavailable, parse failure)
 *   3  — circuit-breaker triggered (--last-two-zero)
 */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── Repo layout ─────────────────────────────────────────────────────────────

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const matrixScript = path.join(repoRoot, "scripts", "g3-essai-matrix.mjs");
const loopLogPath = path.join(repoRoot, "LOOP-LOG.md");
const ladderPath = path.join(repoRoot, "GOAL-3-LADDER.md");

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || !args.includes("--no-dry-run");
const lastTwoZero = args.includes("--last-two-zero");

// ─── Circuit-breaker ──────────────────────────────────────────────────────────

if (lastTwoZero) {
  const msg = [
    "CIRCUIT-BREAKER: two consecutive zero-delta waves detected.",
    "STOP — escalate to human.",
    "No increment selected. No files written. No commit.",
    "Action: review LOOP-LOG.md last two entries; identify why delta=0;",
    "        either the matrix is fully green (DONE candidate) or the",
    "        increment generator needs a new strategy.",
  ].join("\n");
  console.error(msg);
  process.exit(3);
}

// ─── D-bucket priority order (RICE tie-break axis 2) ─────────────────────────
// D1 fan-in highest (16 presets, directly exercises all chain windows),
// D3 next (RED canary, non-vacuity), D4 next (mode matrix),
// D2/D5 last (parametric proof + state-inspection are narrower).

const BUCKET_PRIORITY = { D1: 1, D3: 2, D4: 3, D2: 4, D5: 5, UNKNOWN: 6 };

// ─── Status severity (RICE impact proxy) ─────────────────────────────────────
// FAIL > PARTIAL > unknown > PASS > "—" (not run)

function statusSeverity(status) {
  switch (status) {
    case "FAIL":    return 4;
    case "PARTIAL": return 3;
    case "—":       return 2; // not yet run = unknown, high priority to run
    case "PASS":    return 0;
    default:        return 1;
  }
}

// ─── Parse --list output from g3-essai-matrix.mjs ────────────────────────────

/**
 * Returns an array of { stem, bucket, status, reason } parsed from the table
 * that `g3-essai-matrix.mjs --list` (or a full run) prints.
 *
 * Table rows look like:
 *   g3-p1-full                           D1       —
 *   g3-d3-p3-hardskip                    D3       FAIL     gate_block…
 */
function parseTableRows(output) {
  const rows = [];

  // Strategy A: pipe-delimited rows (renderTable format).
  // Each row: "stem | bucket | status | reason" with optional trailing " | ".
  // The stem column is fixed-width padded; bucket/status are 8-char padded.
  // We match any line that has a g3- stem followed by pipe-separated fields.
  const pipeRowRe = /^(g3-\S+)\s+\|\s+(\S+)\s+\|\s+(\S+|—)\s*(?:\|\s*(.*))?$/;

  for (const raw of output.split("\n")) {
    // Strip any trailing pipe+whitespace that renderTable appends via join(" | ") on an empty Reason
    const line = raw.replace(/\s*\|\s*$/, "").trimEnd();
    const m = pipeRowRe.exec(line);
    if (!m) continue;

    const stem   = m[1].trim();
    const bucket = m[2].trim();
    const status = m[3].trim();
    const reason = (m[4] ?? "").trim();

    if (!stem.startsWith("g3-")) continue;
    rows.push({ stem, bucket, status, reason });
  }

  return rows;
}

// ─── RICE ranking of weakest cell ────────────────────────────────────────────
//
// RICE here = Reach × Impact × Confidence / Effort
//   Reach      = bucket fan-in weight (D1 covers 16 presets → highest reach)
//   Impact     = severity of the current status (FAIL=4, not-run=2, PASS=0)
//   Confidence = 1.0 (all cells equally actionable)
//   Effort     = 1 (one increment per wave — constant, cancels out)
//
// Score = bucketWeight(1/priority) × severity
// Highest score = pick this cell next.

function riceScore(row) {
  const bucketPri = BUCKET_PRIORITY[row.bucket] ?? 6;
  const reach = 1 / bucketPri; // D1→1/1=1.0, D3→1/2=0.5, …
  const impact = statusSeverity(row.status);
  return reach * impact;
}

function pickWeakestCell(rows) {
  if (rows.length === 0) return null;

  // Sort descending by RICE score; tie-break: bucket priority asc, then stem asc
  const sorted = [...rows].sort((a, b) => {
    const sd = riceScore(b) - riceScore(a);
    if (sd !== 0) return sd;
    const bp = (BUCKET_PRIORITY[a.bucket] ?? 6) - (BUCKET_PRIORITY[b.bucket] ?? 6);
    if (bp !== 0) return bp;
    return a.stem.localeCompare(b.stem);
  });

  return sorted[0];
}

// ─── Increment description generator ─────────────────────────────────────────

/**
 * Maps a cell (stem + bucket + status) to a human-readable increment action.
 * One increment = one of:
 *   - one preset deepened (D1)
 *   - one parametric window verified (D2)
 *   - one RED canary strengthened (D3)
 *   - one mode variant hardened (D4)
 *   - state-inspector coverage expanded (D5)
 */
function describeIncrement(cell) {
  const { stem, bucket, status, reason } = cell;

  switch (bucket) {
    case "D1": {
      // e.g. g3-p3-idea-to-design → preset P3
      const presetMatch = stem.match(/g3-(p\d+)/);
      const preset = presetMatch ? presetMatch[1].toUpperCase() : stem;
      if (status === "PASS") {
        return `D1/${preset} is PASS — deepen: add a second NL-seed variant for ${preset} (implicit SIGNAL path) to increase preset coverage robustness.`;
      }
      return `D1/${preset} is ${status}${reason ? ` (${reason})` : ""} — fix: update scenario fixture, re-run runner, make green.`;
    }

    case "D2": {
      // e.g. g3-d2-w1-1 → window [1,1]
      const winMatch = stem.match(/g3-d2-w(\d+)-(\d+)/);
      const win = winMatch ? `[${winMatch[1]}→${winMatch[2]}]` : stem;
      if (status === "PASS") {
        return `D2/${win} is PASS — deepen: add one more non-preset random window to expand parametric proof surface.`;
      }
      return `D2/${win} is ${status}${reason ? ` (${reason})` : ""} — fix: update parametric window fixture, verify correct start/stop activation.`;
    }

    case "D3": {
      const hardSoft = stem.includes("-hardskip") ? "HARD-skip RED canary" : "SOFT-skip advisory canary";
      const presetMatch = stem.match(/g3-d3-(p\d+)/);
      const preset = presetMatch ? presetMatch[1].toUpperCase() : stem;
      if (status === "PASS") {
        return `D3/${preset} ${hardSoft} is PASS — deepen: add one more preset's RED canary (next unrepresented preset) to widen non-vacuity coverage.`;
      }
      return `D3/${preset} ${hardSoft} is ${status}${reason ? ` (${reason})` : ""} — fix: align stopPolicy/forbiddenEvidence tokens with scan.mjs:357 + checkStopBehavior path.`;
    }

    case "D4": {
      const modeMatch = stem.match(/g3-d4-p3-(m\d)-(\w+)/);
      const mode = modeMatch ? `${modeMatch[1].toUpperCase()} (${modeMatch[2]})` : stem;
      if (status === "PASS") {
        return `D4/${mode} is PASS — deepen: port D4 5-mode matrix to a second preset (P1 or P9) to prove mode-axis is not P3-specific.`;
      }
      return `D4/${mode} is ${status}${reason ? ` (${reason})` : ""} — fix: correct mode-contract assertions (hardFloorActive/softGatesSuppressed/checkpoint semantics).`;
    }

    case "D5": {
      if (status === "PASS") {
        return `D5/state-emit is PASS — deepen: extend D5 to a second preset (P9) to prove ImaState emission is not stage-1 specific.`;
      }
      return `D5/${stem} is ${status}${reason ? ` (${reason})` : ""} — fix: ensure all 6 ImaState fields emitted per turn (active_stage/window/mode/forced_disciplines/next_handoff/decision_owner).`;
    }

    default:
      return `UNKNOWN bucket ${bucket} — investigate stem ${stem}; classify into D1–D5 and author scenario.`;
  }
}

// ─── LOOP-LOG row formatter ───────────────────────────────────────────────────
//
// Format (per GOAL-3 §10.5):
// | <date> | H4 | <wave> | <stem> | <bucket> | <status>→next | <increment> | delta=pending | REQ-08 |

function formatLoopLogRow({ waveLabel, cell, increment }) {
  const date = new Date().toISOString().split("T")[0];
  const status = cell.status;
  const delta = status === "PASS" ? "0 (all-green in cell)" : "pending";
  const reqs = "REQ-08,REQ-09";
  return `| ${date} | H4 | ${waveLabel} | ${cell.stem} | ${cell.bucket} | ${status}→deepening | ${increment.slice(0, 80)} | delta=${delta} | ${reqs} |`;
}

// ─── Invoke g3-essai-matrix.mjs --list ───────────────────────────────────────

function invokeMatrixList() {
  if (!existsSync(matrixScript)) {
    return {
      ok: false,
      error: `g3-essai-matrix.mjs not found at ${matrixScript}`,
      rows: [],
    };
  }

  const result = spawnSync(process.execPath, [matrixScript, "--list"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 30_000,
  });

  if (result.error) {
    return { ok: false, error: result.error.message, rows: [] };
  }

  const output = result.stdout ?? "";
  const rows = parseTableRows(output);

  if (rows.length === 0) {
    // Matrix ran but no scenarios found — degrade gracefully
    return {
      ok: false,
      error: "g3-essai-matrix.mjs --list returned 0 parseable rows. Scenario directory may be empty or the table format changed.",
      rows: [],
    };
  }

  return { ok: true, rows };
}

// ─── Read last known verdict from LOOP-LOG ────────────────────────────────────
//
// LOOP-LOG may not exist yet (first run). If it does exist, we read the last
// H4 row to surface the last-run cell status for context.

function readLastVerdict() {
  if (!existsSync(loopLogPath)) return null;

  try {
    const content = readFileSync(loopLogPath, "utf8");
    const lines = content.split("\n").filter((l) => l.includes("| H4 |"));
    if (lines.length === 0) return null;
    const last = lines[lines.length - 1];
    // Extract stem (col 4) and status col (col 6) — pipe-delimited
    const parts = last.split("|").map((p) => p.trim());
    // parts[0]="" parts[1]=date parts[2]=H4 parts[3]=wave parts[4]=stem parts[5]=bucket parts[6]=status→
    return {
      stem: parts[4] ?? "unknown",
      statusTransition: parts[6] ?? "unknown",
    };
  } catch {
    return null;
  }
}

// ─── Derive wave label ────────────────────────────────────────────────────────

function deriveWaveLabel() {
  if (!existsSync(loopLogPath)) return "W-G3-H4-1";

  try {
    const content = readFileSync(loopLogPath, "utf8");
    const matches = [...content.matchAll(/W-G3-H4-(\d+)/g)];
    if (matches.length === 0) return "W-G3-H4-1";
    const nums = matches.map((m) => parseInt(m[1], 10));
    const max = Math.max(...nums);
    return `W-G3-H4-${max + 1}`;
  } catch {
    return "W-G3-H4-1";
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== g3-h4-loop.mjs — GOAL-3 H4 loop driver ===");
  if (dryRun) console.log("Mode: dry-run (planner only — no files written, no commit)");
  console.log();

  // 1. Invoke matrix --list
  const { ok, error, rows } = invokeMatrixList();

  if (!ok) {
    console.warn(`[DEGRADE] Matrix unavailable: ${error}`);
    console.warn("Falling back to synthetic row set (all D-buckets, status=—).");
    console.warn("Run `node scripts/g3-essai-matrix.mjs --list` manually to verify.");
    console.warn();

    // Synthetic fallback: inject one representative cell per bucket
    const fallbackRows = [
      { stem: "g3-p1-full",             bucket: "D1", status: "—", reason: "" },
      { stem: "g3-d2-w1-1",             bucket: "D2", status: "—", reason: "" },
      { stem: "g3-d3-p3-hardskip",      bucket: "D3", status: "—", reason: "" },
      { stem: "g3-d4-p3-m0-bypass",     bucket: "D4", status: "—", reason: "" },
      { stem: "g3-d5-p3-state-emit",    bucket: "D5", status: "—", reason: "" },
    ];
    rows.push(...fallbackRows);
  }

  // 2. Surface last verdict context
  const lastVerdict = readLastVerdict();
  if (lastVerdict) {
    console.log(`Last H4 verdict: stem=${lastVerdict.stem}  transition=${lastVerdict.statusTransition}`);
  } else {
    console.log("Last H4 verdict: none (first H4 wave or LOOP-LOG not yet created).");
  }
  console.log();

  // 3. RICE-rank weakest cell
  const cell = pickWeakestCell(rows);

  if (!cell) {
    console.error("No cells found — cannot pick an increment. Check scenario directory.");
    process.exit(1);
  }

  // 4. Describe next increment
  const increment = describeIncrement(cell);

  // 5. Derive wave label
  const waveLabel = deriveWaveLabel();

  // 6. Format LOOP-LOG row
  const loopLogRow = formatLoopLogRow({ waveLabel, cell, increment });

  // 7. Print results
  console.log("─── RICE ranking (top 5) ───────────────────────────────────────────────────");
  const top5 = [...rows]
    .sort((a, b) => {
      const sd = riceScore(b) - riceScore(a);
      if (sd !== 0) return sd;
      return (BUCKET_PRIORITY[a.bucket] ?? 6) - (BUCKET_PRIORITY[b.bucket] ?? 6);
    })
    .slice(0, 5);

  for (const r of top5) {
    const score = riceScore(r).toFixed(3);
    console.log(`  score=${score}  ${r.stem.padEnd(38)} bucket=${r.bucket}  status=${r.status}`);
  }

  console.log();
  console.log("─── Chosen increment ───────────────────────────────────────────────────────");
  console.log(`  Wave  : ${waveLabel}`);
  console.log(`  Cell  : ${cell.stem}  (bucket=${cell.bucket}, status=${cell.status})`);
  console.log(`  Action: ${increment}`);
  console.log();
  console.log("─── LOOP-LOG row (append to LOOP-LOG.md) ───────────────────────────────────");
  console.log(loopLogRow);
  console.log();
  console.log("─── GOAL-3-LADDER note ─────────────────────────────────────────────────────");
  console.log(`  Add row: ${waveLabel} | H4 | ${cell.bucket}/${cell.stem} | before=current status | after=pending | increment above`);
  console.log();

  if (dryRun) {
    console.log("[dry-run] No files written. Orchestrator applies the above to LOOP-LOG.md and GOAL-3-LADDER.md, then commits (S or B, never mixed).");
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
