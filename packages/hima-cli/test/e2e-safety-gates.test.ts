/**
 * e2e-safety-gates.test.ts — SPAWN proof for the I9 safety invariants.
 *
 * Spawns the BUILT dist/index.js to validate the four always-on safety behaviors
 * end-to-end:
 *
 *  Scenario A — pre-tool-use Write to docs/decisions/x.md without Falsifies-If
 *               → exit 2 (MISSING_FALSIFIES_IF via BEH_FALSIFIES_IF)
 *
 *  Scenario B — pre-tool-use Bash "nmap -p- target" with no authorized scope
 *               → exit 2 (SECURITY_SCOPE via BEH_SECURITY_SCOPE)
 *
 *  Scenario C — pre-tool-use Write with content containing a sk- API key
 *               → exit 2 (SECRET_DETECTED via BEH_SECRET_GUARD)
 *
 *  Scenario D — pre-tool-use Write to an existing unread file at floor H/M
 *               → exit 2 (READ_BEFORE_WRITE via BEH_READ_BEFORE_WRITE)
 *
 *  Scenario E — pre-tool-use Write at floor T (no ward) with clean content
 *               → exit 0 (no false positive: all safety behaviors allow)
 *
 * Pre-condition: `pnpm --filter @norm/cli build` must have run first.
 *
 * Runtime: node:child_process spawnSync (synchronous, sequential).
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createWard } from "@norm/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

// ---------------------------------------------------------------------------
// Helper: spawn CLI with JSON stdin
// ---------------------------------------------------------------------------

function spawnCli(
  args: string[],
  stdinPayload: Record<string, unknown>,
  cliRoot: string,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    "node",
    [DIST_INDEX, ...args, "--root", cliRoot],
    {
      input: JSON.stringify(stdinPayload),
      encoding: "utf8",
      timeout: 15_000,
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// ---------------------------------------------------------------------------
// Scenario A — BEH_FALSIFIES_IF: claim-bearing file without Falsifies-If → exit 2
// ---------------------------------------------------------------------------

describe("Scenario A — MISSING_FALSIFIES_IF: Write to docs/decisions/x.md without Falsifies-If block", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "hima-safety-a-"));
    // No ward needed — BEH_FALSIFIES_IF fires at all floors (R-053 ensures it
    // evaluates even without a ward).
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exitStatus === 2 (MISSING_FALSIFIES_IF block)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Write",
        tool_input: {
          file_path: "docs/decisions/x.md",
          content: "# Decision\n\nThis is a claim without the required block.",
        },
        session_id: "s-a",
      },
      root,
    );
    expect(status).toBe(2);
  });

  it("stdout contains block decision", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Write",
        tool_input: {
          file_path: "docs/decisions/x.md",
          content: "# Another claim\n\nNo falsifies-if here.",
        },
        session_id: "s-a",
      },
      root,
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  it("block reason mentions MISSING_FALSIFIES_IF", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Write",
        tool_input: {
          file_path: "docs/decisions/x.md",
          content: "# Yet another claim\n\nMissing the required block.",
        },
        session_id: "s-a",
      },
      root,
    );
    expect(stdout).toMatch(/MISSING_FALSIFIES_IF|Falsifies-If/);
  });
});

// ---------------------------------------------------------------------------
// Scenario B — BEH_SECURITY_SCOPE: Bash nmap command without authorized scope → exit 2
// ---------------------------------------------------------------------------

describe("Scenario B — SECURITY_SCOPE: Bash nmap without authorized scope", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "hima-safety-b-"));
    // No .hima/security-scope.json → scope is absent → block.
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exitStatus === 2 (SECURITY_SCOPE block)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Bash",
        tool_input: { command: "nmap -p- target" },
        session_id: "s-b",
      },
      root,
    );
    expect(status).toBe(2);
  });

  it("stdout contains block decision", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Bash",
        tool_input: { command: "nmap -p- target" },
        session_id: "s-b",
      },
      root,
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  it("block reason mentions SECURITY_SCOPE", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Bash",
        tool_input: { command: "nmap -p- target" },
        session_id: "s-b",
      },
      root,
    );
    expect(stdout).toMatch(/SECURITY_SCOPE|security.scope|offensive/i);
  });
});

// ---------------------------------------------------------------------------
// Scenario C — BEH_SECRET_GUARD: Write with sk- API key in content → exit 2
// ---------------------------------------------------------------------------

describe("Scenario C — SECRET_DETECTED: Write with sk- API key in content", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "hima-safety-c-"));
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exitStatus === 2 (SECRET_DETECTED block)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Write",
        tool_input: {
          file_path: "src/config.ts",
          // sk- followed by ≥16 alphanumeric chars — matches the secret pattern.
          content: 'export const API_KEY = "sk-ABCDEFGHIJKLMNOPQRST1234";',
        },
        session_id: "s-c",
      },
      root,
    );
    expect(status).toBe(2);
  });

  it("stdout contains block decision", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Write",
        tool_input: {
          file_path: "src/config.ts",
          content: 'const key = "sk-ABCDEFGHIJKLMNOPQRST1234";',
        },
        session_id: "s-c",
      },
      root,
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  it("block reason mentions SECRET_DETECTED", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Write",
        tool_input: {
          file_path: "src/config.ts",
          content: 'const key = "sk-ABCDEFGHIJKLMNOPQRST1234";',
        },
        session_id: "s-c",
      },
      root,
    );
    expect(stdout).toMatch(/SECRET_DETECTED|secret|credential/i);
  });
});

// ---------------------------------------------------------------------------
// Scenario D — BEH_READ_BEFORE_WRITE: Write to existing unread file at floor M → exit 2
// ---------------------------------------------------------------------------

describe("Scenario D — READ_BEFORE_WRITE: Write to existing unread file at floor H", () => {
  let root: string;
  const targetRelPath = "src/existing-file.ts";

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "hima-safety-d-"));

    // Create the target file on disk (it must exist for the check to fire).
    const srcDir = path.join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      path.join(root, targetRelPath),
      "// existing file — not yet read\nexport const x = 1;\n",
      "utf8",
    );

    // Create a ward at floor "H" (above the M enforcement floor).
    // No read is recorded → BEH_READ_BEFORE_WRITE will block.
    await createWard(root, {
      id: "safety-d-ward",
      entryPoint: "full",
      floor: "H",
    });
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exitStatus === 2 (READ_BEFORE_WRITE block)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Write",
        tool_input: {
          file_path: targetRelPath,
          content: "// overwrite attempt without prior read\nexport const x = 2;\n",
        },
        session_id: "s-d",
      },
      root,
    );
    expect(status).toBe(2);
  });

  it("stdout contains block decision", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Write",
        tool_input: {
          file_path: targetRelPath,
          content: "// overwrite without read\nexport const x = 3;\n",
        },
        session_id: "s-d",
      },
      root,
    );
    expect(stdout).toMatch(/"decision"\s*:\s*"block"/);
  });

  it("block reason mentions READ_BEFORE_WRITE", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Write",
        tool_input: {
          file_path: targetRelPath,
          content: "// overwrite\nexport const x = 4;\n",
        },
        session_id: "s-d",
      },
      root,
    );
    expect(stdout).toMatch(/READ_BEFORE_WRITE|read.*before.*writ/i);
  });
});

// ---------------------------------------------------------------------------
// Scenario E — No false positive: clean Write at floor T (no ward) → exit 0
// ---------------------------------------------------------------------------

describe("Scenario E — No false positive: clean Write at floor T (no ward)", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "hima-safety-e-"));
    // No ward created → riskClass = "T".
    // Target file does not exist → new-file write (no read-before-write check).
    // Content has no secrets, no claim-bearing path, no offensive Bash tool.
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("exitStatus === 0 (clean Write at T floor passes all safety behaviors)", () => {
    const { status } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Write",
        tool_input: {
          file_path: "src/hello.ts",
          content: "export function hello(): string { return 'hello'; }\n",
        },
        session_id: "s-e",
      },
      root,
    );
    expect(status).toBe(0);
  });

  it("stdout does NOT contain block decision", () => {
    const { stdout } = spawnCli(
      ["hook", "pre-tool-use"],
      {
        tool_name: "Write",
        tool_input: {
          file_path: "src/hello.ts",
          content: "export function hello(): string { return 'hello'; }\n",
        },
        session_id: "s-e",
      },
      root,
    );
    expect(stdout).not.toMatch(/"decision"\s*:\s*"block"/);
  });
});
