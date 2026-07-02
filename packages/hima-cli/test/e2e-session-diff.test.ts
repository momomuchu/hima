/**
 * e2e-session-diff.test.ts — SPAWN proof for R-044 (session-diff wiring).
 *
 * Before this wiring, session-diff.ts (captureGitSnapshot/readGitSnapshot/
 * hasChangesSince) was fully orphaned: router.ts's handlePostToolUse called
 * buildReviewSurfaceContext(true) with a hardcoded literal, so the "changed"
 * flag was fabricated on every .md plan write regardless of the real git state.
 *
 * This suite proves BOTH branches are now reachable through the live hook path:
 *
 *   1. session-start captures a git-diff baseline via captureGitSnapshot.
 *   2. post-tool-use with an unchanged working tree → "No diff this session."
 *      (hasChangesSince(base, current) === false)
 *   3. post-tool-use after the working tree actually changed → real
 *      "git diff --stat HEAD" line (hasChangesSince(base, current) === true)
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this
 * suite executes; also requires a real `git` binary on PATH.
 */

import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

// ---------------------------------------------------------------------------
// Spawn helper
// ---------------------------------------------------------------------------

function spawnCli(
  args: string[],
  stdinPayload: Record<string, unknown>,
  cliRoot: string,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("node", [DIST_INDEX, ...args, "--root", cliRoot], {
    input: JSON.stringify(stdinPayload),
    encoding: "utf8",
    timeout: 15_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function git(root: string, args: string[]): void {
  execFileSync("git", args, { cwd: root, stdio: "ignore" });
}

// ---------------------------------------------------------------------------
// Shared tmp git repo
// ---------------------------------------------------------------------------

let root: string;
const TRACKED_FILE = "tracked.txt";

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-e2e-session-diff-"));
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "hima-test@example.com"]);
  git(root, ["config", "user.name", "hima-test"]);
  writeFileSync(path.join(root, TRACKED_FILE), "line1\n", "utf8");
  git(root, ["add", TRACKED_FILE]);
  git(root, ["commit", "-q", "-m", "init"]);
  mkdirSync(path.join(root, "docs"), { recursive: true });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 1. session-start captures the git-diff baseline
// ---------------------------------------------------------------------------

describe("R-044 (1) session-start captures a git-diff baseline", () => {
  it("exits 0", () => {
    const { status } = spawnCli(["hook", "session-start", "--format", "claude"], {}, root);
    expect(status).toBe(0);
  });

  it("persists .hima/state/session-diff-base.json", async () => {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(
      path.join(root, ".hima", "state", "session-diff-base.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as { base: string };
    // Clean tree right after commit → git diff --stat is empty.
    expect(parsed.base.trim()).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 2. post-tool-use on an UNCHANGED tree → changed=false → "No diff this session."
// ---------------------------------------------------------------------------

describe("R-044 (2) post-tool-use with unchanged tree → changed=false", () => {
  it('additionalContext contains "No diff this session."', () => {
    // The router does not actually write the file to disk on Write toolInput —
    // it only reacts to the payload. The working tree is therefore still clean.
    const { stdout, status } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      {
        toolName: "Write",
        toolInput: { file_path: "docs/plan-unchanged.md", content: "# plan" },
      },
      root,
    );
    expect(status).toBe(0);
    expect(stdout).toContain("No diff this session.");
    expect(stdout).not.toContain("git diff --stat HEAD");
  });
});

// ---------------------------------------------------------------------------
// 3. post-tool-use AFTER a real working-tree change → changed=true → real command
// ---------------------------------------------------------------------------

describe("R-044 (3) post-tool-use after a real working-tree change → changed=true", () => {
  beforeAll(() => {
    // Mutate the tracked file directly (simulates work done during the session
    // outside of what the router itself writes) so `git diff --stat` now
    // differs from the session-start baseline captured above.
    appendFileSync(path.join(root, TRACKED_FILE), "line2\n", "utf8");
  });

  it('additionalContext contains the real "git diff --stat HEAD" review-surface command', () => {
    const { stdout, status } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      {
        toolName: "Write",
        toolInput: { file_path: "docs/plan-changed.md", content: "# plan" },
      },
      root,
    );
    expect(status).toBe(0);
    expect(stdout).toContain("git diff --stat HEAD");
    expect(stdout).not.toContain("No diff this session.");
  });
});
