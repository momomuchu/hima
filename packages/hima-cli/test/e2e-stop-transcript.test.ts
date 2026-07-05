/**
 * e2e-stop-transcript.test.ts — Ultra-QA dogfound (2026-07-04): on the REAL Claude
 * Stop hook the agent's final message is NOT in the payload — it lives as the last
 * assistant message in `transcript_path`. handleStop previously read only
 * promptContent/toolInput (empty at Stop), so BEH-023 never saw a completion claim
 * and the fake-DONE gate silently failed open in real sessions. This locks the fix:
 * the Stop gate reads the transcript and blocks a fake DONE at M+.
 *
 * Pre-condition: `pnpm --filter @norm/cli build`.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const DIST = path.resolve(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/index.js",
);

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-stop-tr-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function cli(args: string[], stdin: Record<string, unknown>): { status: number | null; stdout: string } {
  const r = spawnSync("node", [DIST, ...args, "--root", root], {
    input: JSON.stringify(stdin),
    encoding: "utf8",
    timeout: 20_000,
  });
  return { status: r.status, stdout: r.stdout ?? "" };
}

/** Bootstrap a floor-H ward at discovery (trailing `full` sigil). */
function bootstrapH(): void {
  expect(cli(["init", "--yes"], {}).status).toBe(0);
  cli(["hook", "user-prompt-submit", "--format", "claude"], {
    session_id: "s",
    prompt: "big architecture task full",
  });
}

function writeTranscript(finalAssistantText: string): string {
  const p = path.join(root, "transcript.jsonl");
  writeFileSync(
    p,
    [
      JSON.stringify({ type: "user", message: { role: "user", content: "go" } }),
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: finalAssistantText }] },
      }),
    ].join("\n"),
  );
  return p;
}

describe("Stop gate reads transcript_path (fake-DONE detection in real sessions)", () => {
  it("BLOCKS a fake DONE_VERIFIED claim found only in the transcript (floor H)", () => {
    bootstrapH();
    const tr = writeTranscript("All done. DONE_VERIFIED — the feature is complete and shipped.");
    const r = cli(["hook", "stop", "--format", "claude"], {
      hook_event_name: "Stop",
      session_id: "s",
      transcript_path: tr,
    });
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/BEH-023/);
  });

  it("ALLOWS an honest stop (no completion claim in the transcript)", () => {
    bootstrapH();
    const tr = writeTranscript("I inspected the files; here is a summary of what I found.");
    const r = cli(["hook", "stop", "--format", "claude"], {
      hook_event_name: "Stop",
      session_id: "s",
      transcript_path: tr,
    });
    expect(r.status).toBe(0);
  });
});

// Codex delivers the final message directly as last_assistant_message (no transcript
// read needed); and both runtimes set stop_hook_active to break re-block loops.
describe("Stop gate — Codex last_assistant_message + stop_hook_active loop guard", () => {
  it("BLOCKS a fake DONE delivered via Codex last_assistant_message (floor H)", () => {
    bootstrapH();
    const r = cli(["hook", "stop", "--format", "codex"], {
      hook_event_name: "Stop",
      session_id: "s",
      last_assistant_message: "All done. DONE_VERIFIED — complete and shipped.",
    });
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/BEH-023/);
  });

  it("ALLOWS on stop_hook_active=true despite a completion claim (loop guard)", () => {
    bootstrapH();
    const r = cli(["hook", "stop", "--format", "codex"], {
      hook_event_name: "Stop",
      session_id: "s",
      last_assistant_message: "DONE_VERIFIED — shipped.",
      stop_hook_active: true,
    });
    expect(r.status).toBe(0);
  });
});
