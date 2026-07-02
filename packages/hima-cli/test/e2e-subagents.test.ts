/**
 * e2e-subagents.test.ts — SPAWN proof for I10b subagent orchestration + Hermes activation.
 *
 * Spawns the BUILT dist/index.js to validate the subagent gate end-to-end:
 *
 *  Scenario A — subagent-start --format claude with payload lacking model → exit 2
 *               BEH_WORKER_MODEL fires: WORKER_MODEL_UNSPECIFIED → hard block.
 *
 *  Scenario B — subagent-start --format claude with model: "sonnet" → exit 0
 *               BEH_WORKER_MODEL allows: model explicitly set.
 *
 *  Scenario C — pre-tool-use --format hermes with toolName delegate_task
 *               (a) payload has model + task → exit 0, stdout.raw.modifications.task
 *                   contains "[HIMA RULES INJECTED]"
 *               (b) payload lacks model → exit 2 (block via hermes delegate_task intercept)
 *
 *  Scenario D — session-start --format hermes with HERMES_HOME unset → exit 0,
 *               stdout additionalContext contains "[HIMA WARNING]" / HERMES_HOME warning.
 *
 *  Scenario E — R-048: subagent-stop --format hermes dedup, spawned TWICE with the
 *               same session_id + tool_input.agentId → the first invocation is recorded
 *               as a fresh trace event ("first occurrence"); the second (replayed)
 *               invocation is silently suppressed — no second trace line is appended.
 *               Both invocations exit 0 (observe-only, never blocks).
 *
 * Pre-condition: `pnpm --filter @hima/cli build` must have run before this suite.
 * Runtime: node:child_process spawnSync (synchronous, sequential).
 */

import { readTrace } from "@hima/core";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
// Tmp root lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "hima-e2e-subagents-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: spawn dist/index.js synchronously with a JSON stdin payload
// ---------------------------------------------------------------------------

function spawnCli(
  args: string[],
  stdinPayload: Record<string, unknown>,
  cliRoot: string,
  env?: Record<string, string | undefined>,
): { status: number | null; stdout: string; stderr: string } {
  const mergedEnv = env !== undefined ? env : process.env as Record<string, string | undefined>;
  const result = spawnSync(
    "node",
    [DIST_INDEX, "hook", ...args, "--root", cliRoot],
    {
      input: JSON.stringify(stdinPayload),
      encoding: "utf8",
      timeout: 15_000,
      env: mergedEnv,
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/** Parse the JSON object emitted to stdout. Returns null on parse failure. */
function parseStdout(stdout: string): Record<string, unknown> | null {
  const trimmed = stdout.trim();
  if (trimmed === "") return null;
  try {
    // Take only the first line (some paths emit a single JSON line)
    const firstLine = trimmed.split("\n")[0] ?? "";
    return JSON.parse(firstLine) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scenario A — subagent-start without model → exit 2 (WORKER_MODEL_UNSPECIFIED)
// ---------------------------------------------------------------------------

describe("Scenario A — subagent-start: no model → block (exit 2)", () => {
  it("payload lacking model field → exitCode 2 + block decision", () => {
    const result = spawnCli(
      ["subagent-start", "--format", "claude"],
      {
        session_id: "test-session-A",
        tool_name: "Task",
        tool_input: {
          // No "model" or "subagent_type" field
          prompt: "Do some work",
        },
      },
      root,
    );

    expect(result.status, "exit code must be 2 (block)").toBe(2);

    const parsed = parseStdout(result.stdout);
    expect(parsed, "stdout must be valid JSON").not.toBeNull();
    expect(parsed?.["decision"], "decision must be 'block'").toBe("block");

    const reason = parsed?.["reason"];
    expect(typeof reason, "reason must be a string").toBe("string");
    expect(
      String(reason),
      "reason must reference worker model or WORKER_MODEL_UNSPECIFIED",
    ).toMatch(/model|WORKER_MODEL_UNSPECIFIED/i);
  });

  it("payload with empty model string → exitCode 2 (block)", () => {
    const result = spawnCli(
      ["subagent-start", "--format", "claude"],
      {
        session_id: "test-session-A2",
        tool_name: "Task",
        tool_input: {
          model: "",
          prompt: "Do some work",
        },
      },
      root,
    );

    expect(result.status, "exit code must be 2 (empty model)").toBe(2);
    const parsed = parseStdout(result.stdout);
    expect(parsed?.["decision"]).toBe("block");
  });
});

// ---------------------------------------------------------------------------
// Scenario B — subagent-start with explicit model → exit 0 (allow)
// ---------------------------------------------------------------------------

describe("Scenario B — subagent-start: explicit model → allow (exit 0)", () => {
  it("payload with model: 'sonnet' → exitCode 0, no block", () => {
    const result = spawnCli(
      ["subagent-start", "--format", "claude"],
      {
        session_id: "test-session-B",
        tool_name: "Task",
        tool_input: {
          model: "sonnet",
          prompt: "Do some work",
        },
      },
      root,
    );

    expect(result.status, "exit code must be 0 (allow)").toBe(0);

    // Stdout may be empty (emitAllow = silent) or contain additionalContext.
    // It must NOT contain a block decision.
    if (result.stdout.trim() !== "") {
      const parsed = parseStdout(result.stdout);
      if (parsed !== null) {
        expect(parsed["decision"], "must not be 'block'").not.toBe("block");
      }
    }
  });

  it("payload with subagent_type: 'haiku' → exitCode 0, no block", () => {
    const result = spawnCli(
      ["subagent-start", "--format", "claude"],
      {
        session_id: "test-session-B2",
        tool_name: "Task",
        tool_input: {
          subagent_type: "haiku",
          prompt: "Do some work",
        },
      },
      root,
    );

    expect(result.status, "exit code must be 0 (subagent_type accepted)").toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario C — pre-tool-use --format hermes with toolName delegate_task
// ---------------------------------------------------------------------------

describe("Scenario C — hermes delegate_task intercept", () => {
  it("(a) delegate_task with model + task → exit 0, raw.modifications.task injected", () => {
    const result = spawnCli(
      ["pre-tool-use", "--format", "hermes"],
      {
        session_id: "test-session-C",
        tool_name: "delegate_task",
        tool_input: {
          model: "sonnet",
          task: "Analyse the codebase and propose a refactor.",
        },
      },
      root,
    );

    expect(result.status, "exit code must be 0 (allow with injection)").toBe(0);

    const parsed = parseStdout(result.stdout);
    expect(parsed, "stdout must be valid JSON").not.toBeNull();
    expect(parsed?.["decision"], "decision must be 'allow'").toBe("allow");

    // raw.modifications.task must contain the injection marker.
    const raw = parsed?.["raw"] as Record<string, unknown> | undefined;
    expect(raw, "raw field must be present").not.toBeUndefined();
    expect(
      (raw as Record<string, unknown>)?.["action"],
      "raw.action must be 'continue'",
    ).toBe("continue");

    const modifications = (raw as Record<string, unknown>)?.["modifications"] as
      | Record<string, unknown>
      | undefined;
    expect(modifications, "raw.modifications must be present").not.toBeUndefined();

    const taskField = modifications?.["task"] as string | undefined;
    expect(typeof taskField, "raw.modifications.task must be a string").toBe("string");
    expect(
      taskField,
      "raw.modifications.task must contain [HIMA RULES INJECTED]",
    ).toContain("[HIMA RULES INJECTED]");

    // The original task text must be preserved at the start.
    expect(
      taskField,
      "original task text must be preserved in the modified payload",
    ).toContain("Analyse the codebase");
  });

  it("(b) delegate_task without model → exit 2 (block — WORKER_MODEL_UNSPECIFIED)", () => {
    const result = spawnCli(
      ["pre-tool-use", "--format", "hermes"],
      {
        session_id: "test-session-C2",
        tool_name: "delegate_task",
        tool_input: {
          task: "Analyse the codebase without a model.",
        },
      },
      root,
    );

    expect(result.status, "exit code must be 2 (block)").toBe(2);

    const parsed = parseStdout(result.stdout);
    expect(parsed?.["decision"], "decision must be 'block'").toBe("block");
  });

  it("(c) delegate_task is idempotent — injection marker not duplicated on re-call", () => {
    const alreadyInjectedTask =
      "Do work.\n\n---\n[HIMA RULES INJECTED]\nprevious rules\n---";

    const result = spawnCli(
      ["pre-tool-use", "--format", "hermes"],
      {
        session_id: "test-session-C3",
        tool_name: "delegate_task",
        tool_input: {
          model: "haiku",
          task: alreadyInjectedTask,
        },
      },
      root,
    );

    expect(result.status, "exit code must be 0 (allow — idempotent)").toBe(0);

    const parsed = parseStdout(result.stdout);
    const raw = parsed?.["raw"] as Record<string, unknown> | undefined;
    const modifications = (raw as Record<string, unknown>)?.["modifications"] as
      | Record<string, unknown>
      | undefined;
    const taskField = modifications?.["task"] as string | undefined;

    // When already injected, the function returns the original text unchanged.
    // The modifications.task should still be the original (idempotent).
    expect(taskField, "idempotent: task preserved").toBe(alreadyInjectedTask);
  });
});

// ---------------------------------------------------------------------------
// Scenario D — session-start --format hermes + HERMES_HOME unset → warning emitted
// ---------------------------------------------------------------------------

describe("Scenario D — hermes session-start: HERMES_HOME warning", () => {
  it("HERMES_HOME not set → additionalContext contains HIMA WARNING", () => {
    // Build an env without HERMES_HOME.
    const envWithoutHermesHome: Record<string, string | undefined> = {
      ...process.env,
    };
    delete envWithoutHermesHome["HERMES_HOME"];

    const result = spawnCli(
      ["session-start", "--format", "hermes"],
      { session_id: "test-session-D" },
      root,
      envWithoutHermesHome,
    );

    expect(result.status, "exit code must be 0 (advisory only)").toBe(0);

    const parsed = parseStdout(result.stdout);
    expect(parsed, "stdout must be valid JSON (context was emitted)").not.toBeNull();

    // The additionalContext must contain the HERMES_HOME warning.
    const hookOutput = parsed?.["hookSpecificOutput"] as
      | Record<string, unknown>
      | undefined;
    const additionalContext = hookOutput?.["additionalContext"] as string | undefined;
    expect(
      additionalContext,
      "additionalContext must contain [HIMA WARNING]",
    ).toContain("[HIMA WARNING]");
    expect(
      additionalContext,
      "additionalContext must mention HERMES_HOME",
    ).toContain("HERMES_HOME");
  });

  it("HERMES_HOME set → no HIMA WARNING in output", () => {
    const envWithHermesHome: Record<string, string | undefined> = {
      ...process.env,
      HERMES_HOME: "/some/hermes/home",
    };

    const result = spawnCli(
      ["session-start", "--format", "hermes"],
      { session_id: "test-session-D2" },
      root,
      envWithHermesHome,
    );

    expect(result.status, "exit code must be 0").toBe(0);

    // When HERMES_HOME is set, no warning should appear.
    // Stdout may be empty (no ward to resume, no warning).
    if (result.stdout.trim() !== "") {
      expect(result.stdout, "HIMA WARNING must not appear when HERMES_HOME is set")
        .not.toContain("[HIMA WARNING]");
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario E — R-048: subagent-stop --format hermes dedup (replay suppression)
// ---------------------------------------------------------------------------

describe("Scenario E — R-048: Hermes subagent-stop dedup e2e", () => {
  it("second invocation with same session_id + agentId is suppressed as a replay", async () => {
    const sessionId = "test-session-E-r048";
    const agentId = "agent-r048-dedup-1";

    // First invocation: fresh (agentId, "subagent_stop") pair for this session.
    const first = spawnCli(
      ["subagent-stop", "--format", "hermes"],
      {
        session_id: sessionId,
        tool_name: "Task",
        tool_input: { agentId },
      },
      root,
    );

    expect(first.status, "first invocation must exit 0 (observe-only)").toBe(0);

    const eventsAfterFirst = await readTrace(root, sessionId);
    expect(
      eventsAfterFirst.length,
      "first invocation must append exactly one trace event",
    ).toBe(1);
    expect(eventsAfterFirst[0]?.hookEvent).toBe("subagent-stop");
    expect(
      String(eventsAfterFirst[0]?.reason),
      "first-occurrence trace must say so",
    ).toContain("first occurrence");

    // Second invocation: Hermes replay of the SAME subagent_stop event
    // (same session_id + agentId) — must be silently suppressed.
    const second = spawnCli(
      ["subagent-stop", "--format", "hermes"],
      {
        session_id: sessionId,
        tool_name: "Task",
        tool_input: { agentId },
      },
      root,
    );

    expect(second.status, "replayed invocation must still exit 0 (never blocks)").toBe(0);

    const eventsAfterSecond = await readTrace(root, sessionId);
    expect(
      eventsAfterSecond.length,
      "replayed invocation must NOT append a second trace event — proves dedup suppression",
    ).toBe(1);
  });

  it("a different agentId in the same session is treated as a distinct event (not suppressed)", async () => {
    const sessionId = "test-session-E-r048-distinct";

    const forAgentOne = spawnCli(
      ["subagent-stop", "--format", "hermes"],
      {
        session_id: sessionId,
        tool_name: "Task",
        tool_input: { agentId: "agent-r048-dedup-A" },
      },
      root,
    );
    expect(forAgentOne.status).toBe(0);

    const forAgentTwo = spawnCli(
      ["subagent-stop", "--format", "hermes"],
      {
        session_id: sessionId,
        tool_name: "Task",
        tool_input: { agentId: "agent-r048-dedup-B" },
      },
      root,
    );
    expect(forAgentTwo.status).toBe(0);

    const events = await readTrace(root, sessionId);
    expect(
      events.length,
      "distinct agentIds must both be recorded — dedup key is per-agent, not per-session",
    ).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Confirm adapter-hermes-plugin scaffold files exist
// ---------------------------------------------------------------------------

describe("adapter-hermes-plugin scaffold", () => {
  const PLUGIN_DIR = path.resolve(
    import.meta.dirname ?? new URL(".", import.meta.url).pathname,
    "../../adapter-hermes-plugin",
  );

  it("plugin.toml exists", async () => {
    const { access } = await import("node:fs/promises");
    await expect(
      access(path.join(PLUGIN_DIR, "plugin.toml")),
    ).resolves.not.toThrow();
  });

  it("main.mjs exists", async () => {
    const { access } = await import("node:fs/promises");
    await expect(
      access(path.join(PLUGIN_DIR, "main.mjs")),
    ).resolves.not.toThrow();
  });

  it("README.md exists", async () => {
    const { access } = await import("node:fs/promises");
    await expect(
      access(path.join(PLUGIN_DIR, "README.md")),
    ).resolves.not.toThrow();
  });
});
