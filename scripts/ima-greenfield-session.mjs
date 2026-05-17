#!/usr/bin/env node
/**
 * ima-greenfield-session.mjs — autonomous greenfield IMA session on a REAL
 * Claude Code project, with heavy observability.
 *
 * Goal (user W-G3 follow-up): take an EMPTY local folder with NO idea, install
 * the consommable/IMA skill+hook system for Claude Code, and launch a fully
 * autonomous session that runs the forced dev-cycle chain from scratch:
 *   idea-sourcing -> idea-to-pmf -> (if PMF valid) spec -> ... -> build,
 * full-autonomy (M1, no human decisions), emitting phase/skill/hook markers
 * and producing real traced artifacts. Then parse EVERYTHING into a trace
 * dir so we can understand exactly what happened (observability-first).
 *
 * Usage:
 *   node scripts/ima-greenfield-session.mjs \
 *     [--workspace <dir>] [--timeout <sec, default 1500>] \
 *     [--trace-root <dir>] [--keep] [--no-launch]
 *
 * Exit 0 iff the autonomous session reached at least idea-to-pmf with a
 * PMF verdict artifact (the minimum "it can start the pipeline alone" bar).
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = path.join(repoRoot, "packages", "cli", "dist", "index.js");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes(name);

const stamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
const workspace = path.resolve(
  arg("--workspace", path.join(homedir(), "dev", "ima-greenfield-test", `run-${stamp}`)),
);
const timeoutSec = Number.parseInt(arg("--timeout", "1500"), 10);
const traceRoot = path.resolve(
  arg("--trace-root", path.join(repoRoot, ".planning", "ima-greenfield", stamp)),
);

const log = (m) => console.log(`[ima-greenfield ${new Date().toISOString()}] ${m}`);

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { cwd: opts.cwd ?? repoRoot, shell: process.platform === "win32" });
    let out = "";
    let err = "";
    c.stdout?.on("data", (d) => (out += d));
    c.stderr?.on("data", (d) => (err += d));
    c.on("close", (code) => resolve({ code, out, err }));
    c.on("error", (e) => resolve({ code: -1, out, err: String(e) }));
  });
}

function shellSafe(p) {
  return p.replaceAll("\\", "/");
}

// ── 1. fresh empty workspace ────────────────────────────────────────────────
if (existsSync(workspace) && !hasFlag("--keep")) {
  rmSync(workspace, { recursive: true, force: true });
}
mkdirSync(workspace, { recursive: true });
mkdirSync(traceRoot, { recursive: true });
log(`workspace: ${workspace}`);
log(`trace dir: ${traceRoot}`);

// hook wrapper (PowerShell shim → node cli)
const wrapper = path.join(workspace, "hima-hook.ps1");
writeFileSync(
  wrapper,
  [
    `$Cli = '${cliEntry.replaceAll("'", "''")}'`,
    "& node $Cli @args",
    "exit $LASTEXITCODE",
    "",
  ].join("\n"),
  "utf8",
);
const hookPrefix =
  process.platform === "win32"
    ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${shellSafe(wrapper)}"`
    : `bash ${shellSafe(wrapper)}`;

const setupLog = [];
async function step(label, cmd, args, cwd) {
  log(`SETUP: ${label}`);
  const r = await run(cmd, args, { cwd });
  setupLog.push({ label, code: r.code, out: r.out.slice(-2000), err: r.err.slice(-2000) });
  if (r.code !== 0) log(`  (exit ${r.code}) ${r.err.slice(-300)}`);
  return r;
}

// ── 2. install IMA system into the empty project ────────────────────────────
await step("git init", "git", ["init"], workspace);
await step("cli init", "node", [cliEntry, "init", "--root", workspace]);
await step("cli enter (greenfield discovery, full-auto, T-risk)", "node", [
  cliEntry,
  "enter",
  "--root",
  workspace,
  "--phase",
  "discovery",
  "--subPhase",
  "Observer",
  "--mode",
  "auto",
  "--riskClass",
  "T",
  "--objective",
  "greenfield autonomous IMA full-cycle test",
  "--prompt",
  "Empty folder, no idea. Run the full IMA dev-cycle autonomously.",
  "--reason",
  "ima-greenfield-session",
]);
await step("cli install claude (--apply hooks+adapter)", "node", [
  cliEntry,
  "install",
  "claude",
  "--root",
  workspace,
  "--apply",
  "--force",
  "--writeManifest",
  "--hookCommandPrefix",
  hookPrefix,
]);
await step("cli install-artifacts claude (--kind all: 43 skills+hooks+subagents)", "node", [
  cliEntry,
  "install-artifacts",
  "claude",
  "--root",
  workspace,
  "--kind",
  "all",
  "--apply",
  "--writeManifest",
]);

// snapshot installed surface
function walk(dir, base = dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, base, acc);
    else acc.push(path.relative(base, p).replaceAll("\\", "/"));
  }
  return acc;
}
const installedSkills = walk(path.join(workspace, ".claude", "skills"));
const installedFiles = walk(path.join(workspace, ".claude"));
log(`installed: ${installedSkills.length} skill files, ${installedFiles.length} .claude files`);
writeFileSync(
  path.join(traceRoot, "00-setup.json"),
  JSON.stringify({ workspace, hookPrefix, setupLog, installedSkills, installedFiles }, null, 2),
  "utf8",
);

if (hasFlag("--no-launch")) {
  log("--no-launch: setup complete, skipping session.");
  process.exit(0);
}

// ── 3. greenfield autonomous prompt ─────────────────────────────────────────
const prompt = [
  "You are in an EMPTY project folder with NO predefined idea. The IMA",
  "dev-cycle skill system is installed (.claude/skills). Operate in FULL",
  "AUTONOMY (mode M1): make every decision yourself, never ask the user,",
  "never pause for approval. Run the forced dev-cycle chain from scratch:",
  "",
  "1. idea-sourcing: research/choose a concrete, buildable software product",
  "   idea yourself (small, real, shippable). Produce an idea-sourcing",
  "   evidence artifact under .planning/ with a clear idea id.",
  "2. idea-to-pmf: evaluate PMF (problem, audience, wedge, MVP scope,",
  "   build/pivot/kill verdict). Produce an idea-to-pmf verdict artifact.",
  "3. GATE: only if the PMF verdict is build, continue. Otherwise stop and",
  "   record the kill/pivot rationale.",
  "4. If valid: continue the pipeline — specification (SPEC.md with",
  "   acceptance criteria), then design/architecture as warranted, then a",
  "   minimal BUILD slice with a RED test then GREEN. Stop at a coherent,",
  "   traced milestone (do not git push).",
  "",
  "OBSERVABILITY (mandatory): on its own line, emit a marker the moment you",
  "enter each stage and when a skill/hook/subagent is used or declined:",
  "  [HIMA_PHASE:idea-sourcing] [HIMA_PHASE:idea-to-pmf] [HIMA_PHASE:specification] ...",
  "  [HIMA_SKILL_USED:<skill>]  [HIMA_HOOK:<event>]  [HIMA_SUBAGENT:<name>]",
  "  [HIMA_GATE:pmf=build|kill|pivot]  [HIMA_DECISION:<what you decided & why>]",
  "  [HIMA_ERROR:<what failed>] then how you recovered (error-handling visible).",
  "End with [HIMA_SESSION_END:<reached-stage>] and a 5-line self-assessment.",
  "Write all real work to files under the project (traceable), not just chat.",
].join("\n");
writeFileSync(path.join(traceRoot, "01-prompt.txt"), prompt, "utf8");

// ── 4. launch autonomous claude, capture everything ─────────────────────────
const transcriptPath = path.join(traceRoot, "02-transcript.log");
log(`launching autonomous claude (timeout ${timeoutSec}s)…`);
const started = Date.now();
const sessionResult = await new Promise((resolve) => {
  // shell:false (NOT win32 shell) so the long multiline prompt arg is passed
  // verbatim — shell:true mangles it and claude falls back to (empty) stdin.
  // Close stdin immediately so claude does not wait 3s for stdin then print
  // a generic greeting. (Mirrors conversation-compliance-runner run().)
  const c = spawn("claude", ["--permission-mode", "bypassPermissions", "--print", prompt], {
    cwd: workspace,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
  });
  c.stdin?.end();
  let out = "";
  const killer = setTimeout(() => {
    log(`TIMEOUT ${timeoutSec}s — killing session`);
    c.kill("SIGTERM");
  }, timeoutSec * 1000);
  c.stdout?.on("data", (d) => {
    out += d;
    process.stdout.write(d);
  });
  c.stderr?.on("data", (d) => {
    out += d;
    process.stderr.write(d);
  });
  c.on("close", (code) => {
    clearTimeout(killer);
    resolve({ code, out, elapsedSec: Math.round((Date.now() - started) / 1000) });
  });
  c.on("error", (e) => {
    clearTimeout(killer);
    resolve({
      code: -1,
      out: out + `\nSPAWN_ERROR: ${e}`,
      elapsedSec: Math.round((Date.now() - started) / 1000),
    });
  });
});
writeFileSync(transcriptPath, sessionResult.out, "utf8");

// ── 5. OBSERVABILITY: parse transcript + workspace into a trace ─────────────
const text = sessionResult.out;
const grab = (re) => [...text.matchAll(re)].map((m) => m[0]);
const events = {
  phases: grab(/\[HIMA_PHASE:[^\]]+\]/g),
  skills: grab(/\[HIMA_SKILL_USED:[^\]]+\]/g),
  hooks: grab(/\[HIMA_HOOK:[^\]]+\]/g),
  subagents: grab(/\[HIMA_SUBAGENT:[^\]]+\]/g),
  gate: grab(/\[HIMA_GATE:[^\]]+\]/g),
  decisions: grab(/\[HIMA_DECISION:[^\]]*\]/g),
  errors: grab(/\[HIMA_ERROR:[^\]]*\]/g),
  sessionEnd: grab(/\[HIMA_SESSION_END:[^\]]*\]/g),
  rawErrorsign: grab(/\b(?:Error|Exception|ENOENT|EPERM|Traceback|FATAL)\b[^\n]{0,120}/g).slice(
    0,
    40,
  ),
};
const artifactsAfter = walk(workspace).filter(
  (f) => !f.startsWith(".git/") && !f.startsWith(".claude/") && f !== "hima-hook.ps1",
);
const planningArtifacts = artifactsAfter.filter(
  (f) => f.startsWith(".planning/") || /SPEC|PMF|idea|ADR|README/i.test(f),
);

// On-disk artifacts ARE the trace (the prompt mandates "write to files not
// chat"). Transcript markers truncate on SIGTERM / may be absent in --print,
// so artifact evidence is PRIMARY; markers are corroborating/secondary.
const read = (f) => {
  try {
    return readFileSync(path.join(workspace, f), "utf8");
  } catch {
    return "";
  }
};
// Robust: match the stage anywhere in the path (LLM names files freely:
// idea-sourcing-evidence.md, idea-to-pmf-verdict.md, …) — not an exact stem.
const ideaSourcingFile = artifactsAfter.find((f) => /idea[-_]?sourcing/i.test(f) && f.endsWith(".md"));
const pmfFile = artifactsAfter.find((f) => /idea[-_]?to[-_]?pmf|pmf[-_]?verdict/i.test(f) && f.endsWith(".md"));
const specFile = artifactsAfter.find((f) => /(^|\/)spec[^/]*\.md$/i.test(f));
const buildMilestoneFile = artifactsAfter.find((f) => /build[-_]?milestone/i.test(f));
const pmfBody = pmfFile ? read(pmfFile) : "";
const pmfVerdict =
  (pmfBody.match(/\b(build|kill|pivot)\b(?=[^]*verdict|.*verdict)/i) ||
    pmfBody.match(/verdict[^]{0,80}?\b(build|kill|pivot)\b/i) ||
    [])[1]?.toLowerCase() ?? (pmfBody ? "stated-in-doc" : "none");

const phaseOrder = events.phases.map((p) => p.replace(/\[HIMA_PHASE:|\]/g, ""));
const reachedIdeaSourcing = Boolean(ideaSourcingFile) || phaseOrder.includes("idea-sourcing");
const reachedPmf = Boolean(pmfFile) || phaseOrder.includes("idea-to-pmf");
const reachedSpec = Boolean(specFile) || phaseOrder.includes("specification");
const reachedBuild =
  phaseOrder.includes("build") ||
  Boolean(buildMilestoneFile) ||
  artifactsAfter.some((f) => /\.(test|spec)\.[mc]?[jt]sx?$/.test(f)) ||
  artifactsAfter.some((f) => /^src\//.test(f)) ||
  artifactsAfter.some((f) => f === "package.json" && /vitest|jest|node:test|test/.test(read(f)));
// Minimum bar: autonomously produced BOTH an idea-sourcing AND an
// idea-to-pmf artifact from an empty folder (it started the pipeline alone).
const minimumMet = reachedIdeaSourcing && reachedPmf;

// Capture artifact contents into the trace (real observability of WHAT it
// decided autonomously — the idea, the PMF verdict, the spec).
const captured = {};
for (const f of [ideaSourcingFile, pmfFile, specFile, ...planningArtifacts].filter(Boolean)) {
  if (!captured[f]) captured[f] = read(f).slice(0, 8000);
}
writeFileSync(
  path.join(traceRoot, "03-artifact-contents.md"),
  Object.entries(captured)
    .map(([f, c]) => `\n\n===== ${f} =====\n${c}`)
    .join("\n"),
  "utf8",
);

const report = [
  `# IMA Greenfield Autonomous Session — ${stamp}`,
  "",
  `Workspace: ${workspace}`,
  `Session exit: ${sessionResult.code} · elapsed ${sessionResult.elapsedSec}s / ${timeoutSec}s budget`,
  `Setup: ${setupLog.filter((s) => s.code === 0).length}/${setupLog.length} steps ok · ${installedSkills.length} skill files installed`,
  "",
  "## Chain progression (observed phase markers, in order)",
  phaseOrder.length
    ? phaseOrder.map((p, i) => `${i + 1}. ${p}`).join("\n")
    : "(none — no [HIMA_PHASE:*] emitted)",
  "",
  "## Observability counts",
  `- skills used: ${events.skills.length} ${[...new Set(events.skills)].slice(0, 12).join(" ")}`,
  `- hooks fired: ${events.hooks.length}`,
  `- subagents: ${events.subagents.length}`,
  `- gate verdicts: ${events.gate.join(" ") || "none"}`,
  `- explicit decisions: ${events.decisions.length}`,
  `- HIMA_ERROR recoveries: ${events.errors.length}`,
  `- raw error-ish lines: ${events.rawErrorsign.length}`,
  `- session-end marker: ${events.sessionEnd.join(" ") || "ABSENT (likely truncated/timeout)"}`,
  "",
  "## Artifacts produced (real files, not chat)",
  planningArtifacts.length
    ? planningArtifacts.map((f) => `- ${f}`).join("\n")
    : "(NONE — nothing written to disk)",
  "",
  "## Autonomy verdict (artifact-primary — on-disk evidence, not markers)",
  `- reached idea-sourcing: ${reachedIdeaSourcing}${ideaSourcingFile ? ` (${ideaSourcingFile})` : ""}`,
  `- reached idea-to-pmf:   ${reachedPmf}${pmfFile ? ` (${pmfFile})` : ""}`,
  `- PMF verdict (parsed):  ${pmfVerdict}`,
  `- reached specification: ${reachedSpec}${specFile ? ` (${specFile})` : ""}`,
  `- reached build:         ${reachedBuild}`,
  `- MINIMUM BAR (autonomous empty→idea-sourcing→idea-to-pmf): ${minimumMet ? "MET" : "NOT MET"}`,
  `- session terminated by: ${sessionResult.code === null ? `TIMEOUT at ${timeoutSec}s (mid-pipeline — not a failure)` : `exit ${sessionResult.code}`}`,
  "",
  "## Honest assessment",
  minimumMet
    ? "The system started the pipeline autonomously from an empty folder and produced a PMF gate. Review the transcript for chain fidelity + error-handling quality."
    : "The system did NOT autonomously reach a PMF gate from empty. See transcript + raw error lines below; this is the gap to debug next.",
  "",
  "## First 30 raw error-ish lines (error-handling observability)",
  events.rawErrorsign
    .slice(0, 30)
    .map((l) => `- ${l}`)
    .join("\n") || "(none)",
  "",
].join("\n");

writeFileSync(path.join(traceRoot, "events.json"), JSON.stringify(events, null, 2), "utf8");
writeFileSync(
  path.join(traceRoot, "artifacts.json"),
  JSON.stringify({ all: artifactsAfter, planning: planningArtifacts }, null, 2),
  "utf8",
);
writeFileSync(path.join(traceRoot, "SESSION-REPORT.md"), report, "utf8");

log("─".repeat(60));
console.log(report);
log(`full trace: ${traceRoot}`);
process.exit(minimumMet ? 0 : 1);
