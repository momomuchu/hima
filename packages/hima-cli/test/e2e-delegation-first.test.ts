/**
 * e2e-delegation-first.test.ts — SPEC-018 driven by the REAL built CLI.
 *
 * Proves the Delegation-First gate live:
 *   1. ward at impl (executor) + floor H + main-thread Write to a new src file
 *      → BLOCK (exit 2), reason cites DELEGATION_FIRST.
 *   2. after `hima delegate --session <id>` marks the session as a lane
 *      → the identical Write is ALLOWED (exit 0).
 *   3. a .md write at impl H is never blocked (not an implementation file).
 *
 * Pre-condition: `pnpm --filter @hima/cli build`.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const DIST_INDEX = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

const SESSION = "delfirst-e2e";
let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-delfirst-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function cli(
  args: string[],
  stdin: Record<string, unknown> | null = null,
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("node", [DIST_INDEX, ...args, "--root", root], {
    input: stdin === null ? undefined : JSON.stringify(stdin),
    encoding: "utf8",
    timeout: 25_000,
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function openStage(): string {
  return JSON.parse(
    readFileSync(path.join(root, ".hima", "state", "ward.json"), "utf8"),
  ).openStage;
}

/** Floor-H ward at discovery, then walk it to the impl (executor) stage. */
function bootstrapAtImpl(): void {
  expect(cli(["init", "--yes"]).status).toBe(0);
  const r = cli(["hook", "user-prompt-submit", "--format", "claude"], {
    session_id: SESSION,
    prompt: "large multi-file architecture task full",
  });
  expect(r.status).toBe(0);
  expect(openStage()).toBe("discovery");
  // Seal + advance discovery → analysis → spec → design → impl.
  for (let i = 0; i < 6 && openStage() !== "impl"; i++) {
    cli(["advance"]);
  }
  expect(openStage()).toBe("impl");
}

function writeCall(filePath: string) {
  return cli(["hook", "pre-tool-use", "--format", "claude"], {
    session_id: SESSION,
    tool_name: "Write",
    tool_input: { file_path: filePath, content: "export const x = 1;\n" },
  });
}

describe("Delegation-First gate (live CLI)", () => {
  it("1. blocks a solo main-thread impl write at impl+H (exit 2, DELEGATION_FIRST)", () => {
    bootstrapAtImpl();
    const r = writeCall("src/service.ts");
    expect(r.status).toBe(2);
    expect(`${r.stdout}${r.stderr}`).toMatch(/DELEGATION[_-]FIRST|Delegation-First/i);
  }, 40_000);

  it("2. `hima delegate` marks the lane → the identical write is allowed (exit 0)", () => {
    bootstrapAtImpl();
    expect(writeCall("src/service.ts").status).toBe(2); // blocked first
    const d = cli(["delegate", "--session", SESSION, "--roles", "implementer,verifier"]);
    expect(d.status).toBe(0);
    expect(d.stdout).toMatch(/marked as a delegated lane/);
    expect(writeCall("src/service.ts").status).toBe(0); // now allowed
  }, 40_000);

  it("3. a .md write at impl+H is never blocked by Delegation-First", () => {
    bootstrapAtImpl();
    const r = writeCall("docs/notes.md");
    expect(r.status).toBe(0);
  }, 40_000);

  it("4. a sub-agent starting at this stage auto-unblocks writes (no manual seal)", () => {
    bootstrapAtImpl();
    expect(writeCall("src/service.ts").status).toBe(2); // blocked before any delegation
    // The agent spawns a delegated sub-agent — hima observes SubagentStart and
    // stamps the stage. No `hima delegate` call; model provided so worker-model allows.
    const s = cli(["hook", "subagent-start", "--format", "claude"], {
      session_id: SESSION,
      tool_name: "Task",
      tool_input: { subagent_type: "general-purpose", model: "sonnet" },
    });
    expect(s.status === 0 || s.status === 2).toBe(true); // spawn gate may or may not block; marker is stamped regardless
    expect(writeCall("src/service.ts").status).toBe(0); // now flows via stage-delegation
  }, 40_000);

  it("5. a decoy 'src/.hima/evil.ts' write is still blocked (anchored .hima)", () => {
    bootstrapAtImpl();
    expect(writeCall("src/.hima/evil.ts").status).toBe(2);
  }, 40_000);
});
