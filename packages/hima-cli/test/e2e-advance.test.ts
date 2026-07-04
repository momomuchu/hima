/**
 * e2e-advance.test.ts — locks two dogfood follow-up fixes, driven by the real CLI:
 *   1. `--evidence` on stage-advance: StageVerdict.evidence carries real evidence
 *      (previously always []). Closes the R3 demo gap.
 *   2. `hima advance`: the one-command unblock. Seals the CURRENT open stage
 *      (default status "done") and advances — so a planner-blocked agent can walk
 *      the cycle to `impl` where the planner-write-guard no longer blocks code.
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

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-advance-"));
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
    timeout: 20_000,
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function readWard(): {
  openStage: string;
  verdicts: Array<{ stage: string; status: string; evidence: string[] }>;
} {
  return JSON.parse(
    readFileSync(path.join(root, ".hima", "state", "ward.json"), "utf8"),
  );
}

/** Bootstrap a floor-H ward at discovery via a trailing `full` sigil. */
function bootstrapWard(): void {
  expect(cli(["init", "--yes"], null).status).toBe(0);
  const r = cli(["hook", "user-prompt-submit", "--format", "claude"], {
    session_id: "adv-e2e",
    prompt: "big architecture task full",
  });
  expect(r.status).toBe(0);
  expect(readWard().openStage).toBe("discovery");
}

describe("stage-advance --evidence", () => {
  it("records the evidence on the StageVerdict (not [])", () => {
    bootstrapWard();
    const r = cli([
      "hook", "stage-advance",
      "--stage", "discovery", "--status", "done-verified",
      "--evidence", "ran the survey",
    ]);
    expect(r.status).toBe(0);
    const v = readWard().verdicts.find((x) => x.stage === "discovery");
    expect(v?.evidence).toEqual(["ran the survey"]);
  }, 30_000);

  it("supports multiple --evidence items", () => {
    bootstrapWard();
    cli([
      "hook", "stage-advance", "--stage", "discovery", "--status", "done-verified",
      "--evidence", "a", "--evidence", "b",
    ]);
    const v = readWard().verdicts.find((x) => x.stage === "discovery");
    expect(v?.evidence).toEqual(["a", "b"]);
  }, 30_000);
});

describe("hima advance", () => {
  it("with no args seals the current open stage (done) and advances", () => {
    bootstrapWard();
    expect(readWard().openStage).toBe("discovery");
    const r = cli(["advance"]);
    expect(r.status).toBe(0);
    // discovery sealed done -> open stage moved forward to analysis
    expect(readWard().openStage).toBe("analysis");
    const v = readWard().verdicts.find((x) => x.stage === "discovery");
    expect(v?.status).toBe("done");
  }, 30_000);

  it("errors (exit 1) with no active ward", () => {
    expect(cli(["init", "--yes"], null).status).toBe(0);
    const r = cli(["advance"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/no active ward/);
  }, 30_000);

  it("exits 1 (NOT 0) when --stage jumps ahead of unsealed predecessors", () => {
    // Governance: a done-verified seal that fails the predecessor gate must
    // surface as a non-zero exit — never silently report success.
    bootstrapWard();
    const r = cli(["advance", "--stage", "impl", "--status", "done-verified"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/error/);
    // Ward is untouched — still at discovery, no impl verdict written.
    expect(readWard().openStage).toBe("discovery");
    expect(readWard().verdicts.find((v) => v.stage === "impl")).toBeUndefined();
  }, 30_000);

  it("exits 1 (NOT 0) with an explicit --stage but no ward file", () => {
    expect(cli(["init", "--yes"], null).status).toBe(0);
    const r = cli(["advance", "--stage", "discovery"]);
    expect(r.status).toBe(1);
  }, 30_000);

  it("walking to impl removes the planner-write-guard block (the unblock path)", () => {
    bootstrapWard();
    // At discovery, an implementation write is planner-write-guard blocked.
    const atDiscovery = cli(["hook", "pre-tool-use", "--format", "claude"], {
      session_id: "adv-e2e",
      tool_name: "Write",
      tool_input: { file_path: path.join(root, "src/app.ts"), content: "x" },
    });
    expect(atDiscovery.status).toBe(2);
    expect(atDiscovery.stdout).toMatch(/PLANNER-WRITE-GUARD/);

    // Advance discovery -> analysis -> spec -> design -> impl (4 advances).
    for (let n = 0; n < 4; n++) expect(cli(["advance"]).status).toBe(0);
    expect(readWard().openStage).toBe("impl");

    // At impl the planner-write-guard no longer applies. Any remaining block
    // (e.g. floor-H skill-force) is a DIFFERENT, legitimate gate — assert only
    // that the planner guard is gone.
    const atImpl = cli(["hook", "pre-tool-use", "--format", "claude"], {
      session_id: "adv-e2e",
      tool_name: "Write",
      tool_input: { file_path: path.join(root, "src/app.ts"), content: "x" },
    });
    expect(atImpl.stdout).not.toMatch(/PLANNER-WRITE-GUARD/);
  }, 60_000);
});
