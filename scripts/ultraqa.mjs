#!/usr/bin/env node
/**
 * ultraqa.mjs — the RUNNER for hima's ISO scenario taxonomy (qa/scenario-taxonomy.md).
 *
 * It executes the machine-readable taxonomy in qa/scenarios.mjs: for each cell it
 * launches a REAL agent session (claude -p / codex exec), reads the hima trace, and
 * asserts the cell's SHALL gate (plus the universal NO_HOOK_ERROR invariant, and
 * NO_DISABLED_SOURCE whenever the cell overrides enabledSources). A mismatch is a
 * finding. This is quality by systematic coverage, not an ad-hoc list.
 *
 * Usage:
 *   CLAUDE_CONFIG_DIR=/…/claude-config node scripts/ultraqa.mjs [--runtime codex] [--only <id>] [--timeout 130]
 *   (codex cells use ~/.codex auth; claude cells need an authed CLAUDE_CONFIG_DIR.)
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { SCENARIOS } from "../qa/scenarios.mjs";

const HIMA = "/Users/maache/hima/packages/hima-cli/dist/index.js";
const CFG = process.env.CLAUDE_CONFIG_DIR;
const args = process.argv.slice(2);
const TIMEOUT_S = Number(args[args.indexOf("--timeout") + 1]) || 130;
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const RUNTIME = args.includes("--runtime") ? args[args.indexOf("--runtime") + 1] : null;

function sh(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, { encoding: "utf8", timeout: (opts.t || 30) * 1000, ...opts });
}

function readTrace(root) {
  const dir = path.join(root, ".hima", "state", "trace");
  const out = { events: [], errors: 0, blocks: 0, skillForces: 0, stops: 0, stopBlocks: 0, corpusRefs: 0 };
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".jsonl"))) {
    for (const line of readFileSync(path.join(dir, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      out.events.push(e);
      const reason = String(e.reason || "");
      if (e.exitCode && e.exitCode !== 0 && e.exitCode !== 2) out.errors++;
      if (/\berror\b/i.test(reason) && e.decision !== "block") out.errors++;
      if (e.decision === "block") out.blocks++;
      if (String(e.gateType || "").includes("skill-force") || /skill-force/.test(reason)) out.skillForces++;
      if (e.hookEvent === "Stop" || e.gateType === "stop") { out.stops++; if (e.decision === "block") out.stopBlocks++; }
      if (/corpus-/.test(reason)) out.corpusRefs++;
    }
  }
  return out;
}

/** Any implementation file (src/**.ts) written = the planner-write-guard did not hold. */
function implFileWritten(root) {
  const src = path.join(root, "src");
  try { return readdirSync(src).some((f) => f.endsWith(".ts")); } catch { return false; }
}

function detectDisabledSourceTrap(trace, enabledSources) {
  if (!enabledSources) return null;
  const allowed = new Set(enabledSources);
  for (const e of trace.events) {
    const reason = String(e.reason || "");
    for (const src of ["corpus", "user", "project", "base"]) {
      if (!allowed.has(src) && new RegExp(`\\b${src}-`).test(reason) && (e.decision === "block" || /skill-force/.test(reason))) {
        return `forced/blocked on a "${src}"-source skill though "${src}" ∉ enabledSources: ${reason.slice(0, 110)}`;
      }
    }
  }
  return null;
}

/** gate id -> oracle(trace, root) => failure reason | null. NO_HOOK_ERROR is universal. */
const GATE_CHECKS = {
  ALLOW: (t) => (t.blocks > 0 ? "expected ALLOW but the session was blocked" : null),
  PLANNER_WRITE_GUARD: (t, root) => (implFileWritten(root) ? "implementation file written at planner stage — guard bypassed" : null),
  STOP_FAKE_DONE: (t) => (t.stopBlocks === 0 ? "fake completion claim at M+ was NOT blocked by the Stop gate" : null),
  SKILL_FORCE: (t) => (t.skillForces === 0 ? "expected a skill-force, none observed" : null),
  RESEARCH_FIRST: (t) => (t.skillForces === 0 ? "expected a forced research skill, none observed" : null),
  NO_DISABLED_SOURCE: () => null, // covered by the universal disabled-source check below
};

const results = [];
for (const s of SCENARIOS) {
  const rt = s.runtime || "claude";
  if (ONLY && s.id !== ONLY) continue;
  if (RUNTIME && rt !== RUNTIME) continue;
  if (rt === "claude" && (!CFG || !existsSync(CFG))) {
    results.push({ id: s.id, status: "SKIP", findings: ["no authed CLAUDE_CONFIG_DIR"] });
    console.log(`[SKIP] ${s.id} — no authed CLAUDE_CONFIG_DIR`);
    continue;
  }
  const root = mkdtempSync(path.join(tmpdir(), `uqa-`));
  const findings = [];
  try {
    // 1. init (+ generic cycle) then codex wiring if needed
    const initArgs = ["init", "--yes", "--root", root];
    if (s.generic) initArgs.push("--generic");
    if (sh("node", [HIMA, ...initArgs]).status !== 0) findings.push("INIT_FAILED");
    if (s.enabledSources) {
      const cfgPath = path.join(root, ".hima", "config.json");
      const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
      cfg.enabledSources = s.enabledSources;
      writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
    }
    if (rt === "codex") sh("node", [HIMA, "setup", "--runtime", "codex", "--root", root]);

    // 2. real authed session (runtime-specific)
    const prompt = s.sigil ? `${s.prompt} ${s.sigil}` : s.prompt;
    let run;
    if (rt === "codex") {
      run = spawnSync("codex", ["exec", prompt, "--dangerously-bypass-approvals-and-sandbox", "--dangerously-bypass-hook-trust"],
        { cwd: root, encoding: "utf8", timeout: TIMEOUT_S * 1000 });
    } else {
      run = spawnSync("claude", ["-p", prompt, "--dangerously-skip-permissions", "--output-format", "json"],
        { cwd: root, encoding: "utf8", timeout: TIMEOUT_S * 1000, env: { ...process.env, CLAUDE_CONFIG_DIR: CFG } });
      try { const r = JSON.parse(run.stdout || "{}"); if (r.is_error) findings.push(`SESSION_ERROR: ${String(r.result || "").slice(0, 120)}`); } catch { /* */ }
    }
    if (run.signal) findings.push(`SESSION_TIMEOUT/KILLED (${run.signal})`);

    // 3. oracles: universal NO_HOOK_ERROR + NO_DISABLED_SOURCE + the cell's SHALL gate
    const trace = readTrace(root);
    if (trace.errors > 0) findings.push(`NO_HOOK_ERROR violated: ${trace.errors} hook error event(s)`);
    const trap = detectDisabledSourceTrap(trace, s.enabledSources);
    if (trap) findings.push(`NO_DISABLED_SOURCE violated: ${trap}`);
    const gateCheck = GATE_CHECKS[s.gate];
    const gateFail = gateCheck ? gateCheck(trace, root) : `unknown gate "${s.gate}"`;
    if (gateFail) findings.push(`${s.gate} violated: ${gateFail}`);

    const status = findings.length === 0 ? "PASS" : "FAIL";
    results.push({ id: s.id, runtime: rt, gate: s.gate, trace, findings, status });
    console.log(`[${status}] ${s.id} (${s.gate}) — blk:${trace.blocks} sf:${trace.skillForces} stop:${trace.stops}/${trace.stopBlocks}b err:${trace.errors}${findings.length ? " → " + findings.join(" | ") : ""}`);
  } catch (err) {
    findings.push(`HARNESS_ERROR: ${err.message}`);
    results.push({ id: s.id, status: "FAIL", findings });
    console.log(`[FAIL] ${s.id} — HARNESS_ERROR: ${err.message}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.status === "PASS").length;
const skip = results.filter((r) => r.status === "SKIP").length;
const md = [
  `# hima Ultra QA — ISO scenario taxonomy run`,
  ``,
  `Cells: ${results.length} · PASS: ${pass} · FAIL: ${results.length - pass - skip} · SKIP: ${skip}`,
  ``,
  `| Cell | Gate | Status | blk | skillForce | stop(b) | hookErr | findings |`,
  `|---|---|---|--:|--:|--:|--:|---|`,
  ...results.map((r) =>
    `| ${r.id} | ${r.gate ?? "-"} | ${r.status} | ${r.trace?.blocks ?? "-"} | ${r.trace?.skillForces ?? "-"} | ${r.trace?.stops ?? "-"}(${r.trace?.stopBlocks ?? "-"}) | ${r.trace?.errors ?? "-"} | ${(r.findings || []).join("; ") || "—"} |`),
].join("\n");
const reportPath = process.env.ULTRAQA_REPORT || path.join(homedir(), "hima-sandbox", "ultraqa-report.md");
try { mkdirSync(path.dirname(reportPath), { recursive: true }); } catch { /* */ }
writeFileSync(reportPath, md);
console.log(`\n=== ${pass}/${results.length} PASS (${skip} skipped) === report: ${reportPath}`);
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
