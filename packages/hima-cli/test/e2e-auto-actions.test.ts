/**
 * e2e-auto-actions.test.ts — SPAWN proof for I12 auto-action handlers.
 *
 * Spawns the BUILT dist/index.js in a real tmp .hima root to validate the
 * three advisory auto-action paths end-to-end:
 *
 *   (a) session-start with an existing ward → exit 0 + additionalContext
 *       contains "resuming ward" (R-030 buildSessionResumeContext).
 *
 *   (b) post-tool-use Write to a .md file under docs/ → exit 0 +
 *       additionalContext contains "cmux markdown open" (R-025 artifact-auto-open).
 *
 *   (c) pre-compact with an existing ward and claude format → exit 0 +
 *       additionalContext contains "pre-compact" (R-036 buildPreCompactContext).
 *
 * All three paths are advisory only — they NEVER exit 2.
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this
 * suite executes. The test runner chains build → vitest in package.json.
 *
 * Uses node:child_process spawnSync — synchronous so assertion ordering is
 * trivially sequential without async combinators.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createWard } from "@hima/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Absolute path to the built CLI entry-point.
 * The e2e suite requires a prior `pnpm build` in the @hima/cli package.
 */
const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

// ---------------------------------------------------------------------------
// Helper: spawn dist/index.js synchronously with a JSON stdin payload
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

// ---------------------------------------------------------------------------
// (a) session-start with active ward → "resuming ward" in additionalContext
// ---------------------------------------------------------------------------

describe("(a) session-start: existing ward → resume context emitted", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-auto-actions-a-"));
    // Create a ward so buildSessionResumeContext returns non-null.
    await createWard(root, {
      id: "auto-actions-session-a",
      entryPoint: "full",
      floor: "H",
    });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("exit 0 (advisory — never blocks)", () => {
    const { status } = spawnCli(
      ["hook", "session-start", "--format", "claude"],
      { sessionId: "test-session-start-a" },
      root,
    );
    expect(status).toBe(0);
  });

  it('stdout contains "resuming ward" in additionalContext', () => {
    const { stdout } = spawnCli(
      ["hook", "session-start", "--format", "claude"],
      { sessionId: "test-session-start-a" },
      root,
    );
    expect(stdout).toContain("resuming ward");
  });

  it("stdout contains hookSpecificOutput (Claude context shape)", () => {
    const { stdout } = spawnCli(
      ["hook", "session-start", "--format", "claude"],
      { sessionId: "test-session-start-a" },
      root,
    );
    expect(stdout).toMatch(/additionalContext|hookSpecificOutput/);
  });

  it('stdout does NOT contain "block"', () => {
    const { stdout } = spawnCli(
      ["hook", "session-start", "--format", "claude"],
      { sessionId: "test-session-start-a" },
      root,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});

// ---------------------------------------------------------------------------
// (b) post-tool-use Write to docs/*.md → "cmux markdown open" in additionalContext
// ---------------------------------------------------------------------------

describe("(b) post-tool-use Write docs/*.md → artifact-auto-open context emitted", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "hima-auto-actions-b-"));
    // No ward required — artifact auto-open fires on file path alone.
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const mdPayload = {
    sessionId: "test-post-tool-b",
    toolName: "Write",
    toolInput: {
      file_path: "/project/docs/plans/RALPLAN.md",
      content: "# Plan",
    },
  };

  it("exit 0 (advisory — never blocks)", () => {
    const { status } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      mdPayload,
      root,
    );
    expect(status).toBe(0);
  });

  it('stdout contains "cmux markdown open"', () => {
    const { stdout } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      mdPayload,
      root,
    );
    expect(stdout).toContain("cmux markdown open");
  });

  it("stdout contains the artifact file path", () => {
    const { stdout } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      mdPayload,
      root,
    );
    expect(stdout).toContain("RALPLAN.md");
  });

  it('stdout does NOT contain "block"', () => {
    const { stdout } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      mdPayload,
      root,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });

  it("non-.md write (Write to .ts) does NOT emit auto-open context", () => {
    const { stdout } = spawnCli(
      ["hook", "post-tool-use", "--format", "claude"],
      {
        sessionId: "test-post-tool-b2",
        toolName: "Write",
        toolInput: { file_path: "/project/src/index.ts", content: "// code" },
      },
      root,
    );
    expect(stdout).not.toContain("cmux markdown open");
  });
});

// ---------------------------------------------------------------------------
// (c) pre-compact with active ward and claude format → "pre-compact" in context
// ---------------------------------------------------------------------------

describe("(c) pre-compact: active ward + claude format → preservation block emitted", () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-auto-actions-c-"));
    // Create a ward so buildPreCompactContext returns non-null.
    await createWard(root, {
      id: "auto-actions-compact-c",
      entryPoint: "full",
      floor: "H",
    });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("exit 0 (advisory — never blocks)", () => {
    const { status } = spawnCli(
      ["hook", "pre-compact", "--format", "claude"],
      { sessionId: "test-pre-compact-c" },
      root,
    );
    expect(status).toBe(0);
  });

  it('stdout contains "pre-compact" preservation marker', () => {
    const { stdout } = spawnCli(
      ["hook", "pre-compact", "--format", "claude"],
      { sessionId: "test-pre-compact-c" },
      root,
    );
    expect(stdout).toContain("pre-compact");
  });

  it("stdout contains hookSpecificOutput (Claude context shape)", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-compact", "--format", "claude"],
      { sessionId: "test-pre-compact-c" },
      root,
    );
    expect(stdout).toMatch(/additionalContext|hookSpecificOutput/);
  });

  it('stdout does NOT contain "block"', () => {
    const { stdout } = spawnCli(
      ["hook", "pre-compact", "--format", "claude"],
      { sessionId: "test-pre-compact-c" },
      root,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });

  it("codex format → exit 0 no-op (pre-compact is claude-only)", () => {
    const { status, stdout } = spawnCli(
      ["hook", "pre-compact", "--format", "codex"],
      { sessionId: "test-pre-compact-codex" },
      root,
    );
    expect(status).toBe(0);
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});
