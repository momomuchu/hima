#!/usr/bin/env node
/**
 * hc — "Harness Claude". Launch Claude Code with the IMA dev-cycle system
 * already set up in the target folder. Everything pre-wired; just run `hc`.
 *
 *   hc                      install IMA into cwd (idempotent) + interactive claude
 *   hc <dir>                same, targeting <dir>
 *   hc --auto [--timeout N] autonomous greenfield session (delegates to
 *                           ima-greenfield-session.mjs) — for infinite testing
 *   hc --reinstall          force re-install of the IMA artifacts
 *   hc -- <claude args...>  pass everything after `--` straight to claude
 *
 * The PATH shim hc.cmd / hc calls: node <hima>/scripts/hc.mjs %*
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = path.join(repoRoot, "packages", "cli", "dist", "index.js");

const argv = process.argv.slice(2);
const passIdx = argv.indexOf("--");
const claudePassthrough = passIdx !== -1 ? argv.slice(passIdx + 1) : [];
const flags = passIdx !== -1 ? argv.slice(0, passIdx) : argv;
const has = (f) => flags.includes(f);
const opt = (f, d) => {
  const i = flags.indexOf(f);
  return i !== -1 && flags[i + 1] ? flags[i + 1] : d;
};

const positional = flags.find((a) => !a.startsWith("-"));
const target = path.resolve(positional ?? process.cwd());
const log = (m) => console.log(`\x1b[36m[hc]\x1b[0m ${m}`);

// --auto → delegate to the autonomous greenfield session harness
if (has("--auto")) {
  const r = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "ima-greenfield-session.mjs"),
      "--workspace",
      target,
      "--timeout",
      opt("--timeout", "1500"),
      ...(has("--keep") ? ["--keep"] : []),
    ],
    { stdio: "inherit" },
  );
  process.exit(r.status ?? 1);
}

// idempotent IMA install into target
mkdirSync(target, { recursive: true });
const skillsDir = path.join(target, ".claude", "skills");
const alreadySetup = existsSync(skillsDir);

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "ignore", shell: process.platform === "win32", ...opts });
}

if (!alreadySetup || has("--reinstall")) {
  log(`setting up IMA in ${target} …`);
  // hook wrapper shim
  const wrapper = path.join(target, "hima-hook.ps1");
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
      ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${wrapper.replaceAll("\\", "/")}"`
      : `bash ${wrapper.replaceAll("\\", "/")}`;

  if (!existsSync(path.join(target, ".git"))) sh("git", ["init"], { cwd: target });
  sh("node", [cliEntry, "init", "--root", target]);
  sh("node", [
    cliEntry,
    "enter",
    "--root",
    target,
    "--phase",
    "discovery",
    "--subPhase",
    "Observer",
    "--mode",
    "auto",
    "--riskClass",
    "T",
    "--objective",
    "hc session",
    "--prompt",
    "hc launch",
    "--reason",
    "hc",
  ]);
  sh("node", [
    cliEntry,
    "install",
    "claude",
    "--root",
    target,
    "--apply",
    "--force",
    "--writeManifest",
    "--hookCommandPrefix",
    hookPrefix,
  ]);
  sh("node", [
    cliEntry,
    "install-artifacts",
    "claude",
    "--root",
    target,
    "--kind",
    "all",
    "--apply",
    "--writeManifest",
  ]);
  log("IMA installed (43 skills + hooks wired).");
} else {
  log(`IMA already set up in ${target} (use --reinstall to refresh).`);
}

// launch interactive Claude Code in the target folder, everything pre-set
log(`launching claude in ${target} …`);
const c = spawn("claude", claudePassthrough, {
  cwd: target,
  stdio: "inherit",
  shell: false,
});
c.on("close", (code) => process.exit(code ?? 0));
c.on("error", (e) => {
  console.error(`[hc] failed to launch claude: ${e.message}`);
  process.exit(1);
});
