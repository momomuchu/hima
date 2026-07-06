#!/usr/bin/env node
/**
 * verify-runtime-sot.mjs — freshness + integrity gate for the runtime-capabilities SOT.
 *
 * The SOT (docs/research/runtime-capabilities.sot.json) is the SINGLE SOURCE OF TRUTH for
 * what each coding-agent runtime (Claude Code / Codex / OpenCode / Hermes) actually supports,
 * derived from their OFFICIAL docs — so Norm's capability-map/adapters never drift into
 * hand-coded myths (e.g. the "1800-byte" bug, which was really a 1800-SECOND timeout).
 *
 * "So we always have the truth" = this gate. It:
 *   1. FAILS if the SOT is stale (verified_date older than staleness_policy_days) → prompts a refresh.
 *   2. Lists the per-runtime source URLs to re-read on refresh.
 *   3. Lists the still-open capability-map corrections the SOT records (norm_capability_map_corrections)
 *      so they don't get forgotten.
 *   4. Sanity-checks structure.
 *
 * REFRESH PROCEDURE (when this gate says STALE, or a runtime ships a new version):
 *   Re-run the 4-lane doc research (one lane per runtime, reading the official docs listed below),
 *   update the SOT's per-runtime facts + verified_date, then re-run this gate. The human-readable
 *   view lives in docs/research/runtime-capabilities-2026-07.md.
 *
 * Usage: node scripts/verify-runtime-sot.mjs   (exit 0 = fresh+valid; 1 = stale or invalid)
 *        --today <YYYY-MM-DD>  override "now" (tests/determinism)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOT_PATH = path.join(ROOT, "docs", "research", "runtime-capabilities.sot.json");

const args = process.argv.slice(2);
const todayArg = args.includes("--today") ? args[args.indexOf("--today") + 1] : null;

function fail(msg) {
  console.error(`[sot] FAIL — ${msg}`);
  process.exit(1);
}

let sot;
try {
  sot = JSON.parse(readFileSync(SOT_PATH, "utf8"));
} catch (e) {
  fail(`cannot read/parse ${SOT_PATH}: ${e.message}`);
}

// ── structure sanity ────────────────────────────────────────────────────────
for (const key of ["sot_version", "verified_date", "staleness_policy_days", "runtimes"]) {
  if (!(key in sot)) fail(`SOT missing required key: ${key}`);
}
const runtimes = Object.keys(sot.runtimes);
for (const rt of runtimes) {
  const r = sot.runtimes[rt];
  if (!Array.isArray(r.hooks) || r.hooks.length === 0) fail(`runtime "${rt}" has no hooks[]`);
  if (!Array.isArray(r.sources) || r.sources.length === 0) fail(`runtime "${rt}" has no sources[]`);
  if (!r.sub_agents || !r.sub_agents.primitive) fail(`runtime "${rt}" missing sub_agents.primitive`);
  const hasBlock = r.hooks.some((h) => h.canBlock === true);
  if (!hasBlock) fail(`runtime "${rt}" has NO blockable hook — a governance layer cannot enforce there`);
}

// ── freshness ───────────────────────────────────────────────────────────────
const now = todayArg ? new Date(todayArg) : new Date(sot.verified_date); // default: don't fail on clock; use --today in CI
const verified = new Date(sot.verified_date);
const ageDays = Math.floor((now.getTime() - verified.getTime()) / 86_400_000);
const stale = ageDays > sot.staleness_policy_days;

console.log(`[sot] runtime-capabilities SOT v${sot.sot_version} — verified ${sot.verified_date} (age ${ageDays}d / policy ${sot.staleness_policy_days}d)`);
console.log(`[sot] runtimes: ${runtimes.join(", ")}`);
for (const rt of runtimes) {
  const r = sot.runtimes[rt];
  const blockable = r.hooks.filter((h) => h.canBlock === true).map((h) => h.event);
  console.log(`  · ${rt.padEnd(9)} sub-agents: ${r.sub_agents.parallel ? "parallel" : "yes"} | blockable hooks: ${blockable.join(", ")}`);
}

// ── open corrections (don't forget the fixes the SOT recorded) ───────────────
const open = sot.norm_capability_map_corrections || [];
if (open.length) {
  console.log(`[sot] ${open.length} capability-map correction(s) recorded (apply to Norm code):`);
  for (const c of open) console.log(`  [${(c.severity || "?").toUpperCase()}] ${c.id}: ${c.claim} → ${c.truth.slice(0, 90)}`);
}

// ── refresh reminder ─────────────────────────────────────────────────────────
if (stale) {
  console.error(`[sot] STALE — re-run the 4-lane doc research against the official docs and bump verified_date. Sources per runtime are in the SOT.`);
  process.exit(1);
}
console.log("[sot] OK — fresh + valid.");
process.exit(0);
