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
});
