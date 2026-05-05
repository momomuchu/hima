import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getPlanningPaths,
  handleHook,
  initPlanningProject,
  readPlanningProject,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-hook-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
});

describe("handleHook", () => {
  it("fails closed when the planning root is missing", async () => {
    const result = await handleHook(root, "session_start", {});

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("RUNTIME_BINDING_UNAVAILABLE");
    expect(result.finalState).toBe("BLOCKED_RUNTIME_MISSING");
    expect(result.failOpen).toBe(false);
  });

  it("fails closed when planning state cannot be parsed", async () => {
    await initPlanningProject(root);
    await writeFile(getPlanningPaths(root).stateFile, "not: [valid", "utf8");

    const result = await handleHook(root, "session_start", {});

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("RUNTIME_BINDING_UNAVAILABLE");
    expect(result.finalState).toBe("BLOCKED_RUNTIME_MISSING");
    expect(result.failOpen).toBe(false);
  });

  it("redacts secrets from persisted gate reasons", async () => {
    await initPlanningProject(root);

    const result = await handleHook(root, "pre_tool", {
      toolName: "write_file",
      toolInput: {
        path: "outside/token=ghp_abcdefghijklmnopqrstuvwxyz123456.txt",
      },
    });
    const project = await readPlanningProject(root);

    expect(result.reason).toContain("[REDACTED]");
    expect(result.reason).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz123456");
    expect(project.runSet.events[0]?.reason).toContain("[REDACTED]");
    expect(project.runSet.events[0]?.reason).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz123456");
  });

  it("redacts structured secrets before persisting tool previews", async () => {
    await initPlanningProject(root);

    await handleHook(root, "post_tool", {
      toolName: "shell",
      toolInput: {
        password: "correct-horse-battery-staple",
        nested: {
          token: "abcdefghijklmnopqrstuvwxyz123456",
          apiKey: "sk-abcdefghijklmnopqrstuvwxyz123456",
        },
      },
      toolOutput: {
        secret: "ghp_abcdefghijklmnopqrstuvwxyz123456",
      },
    });
    const project = await readPlanningProject(root);
    const payload = project.runSet.events[0]?.payload ?? {};

    expect(payload.toolInputPreview).toContain("[REDACTED]");
    expect(payload.toolInputPreview).not.toContain("correct-horse-battery-staple");
    expect(payload.toolInputPreview).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(payload.toolOutputPreview).toContain("[REDACTED]");
    expect(payload.toolOutputPreview).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz123456");
  });

  it("normalizes Claude Code snake_case hook payloads before gate evaluation", async () => {
    await initPlanningProject(root);

    const result = await handleHook(root, "pre_tool", {
      hook_event_name: "PreToolUse",
      session_id: "claude-session-1",
      tool_name: "Bash",
      tool_input: {
        command: 'echo -n "HIMA_CLAUDE_TOOL_OK" > claude-smoke.txt',
        description: "Create smoke file",
      },
    });
    const project = await readPlanningProject(root);
    const event = project.runSet.events[0];

    expect(result.decision).toBe("warn");
    expect(result.reason).toContain("write target outside allowed zones");
    expect(result.reason).toContain("claude-smoke.txt");
    expect(event?.payload).toMatchObject({
      toolName: "Bash",
      metadata: {
        hookEventName: "PreToolUse",
        sessionId: "claude-session-1",
      },
      toolInputPreview: expect.stringContaining("claude-smoke.txt"),
    });
  });
});
