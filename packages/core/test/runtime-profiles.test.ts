import { describe, expect, it } from "vitest";
import {
  getRuntimeProfile,
  RUNTIME_TARGETS,
  type RuntimeTarget,
  toHookCommand,
} from "../src/index.js";
import { GATE_TYPES, type GateType } from "../src/types/canonical.js";

describe("runtime profiles", () => {
  it("covers every canonical gate for every runtime target", () => {
    for (const target of RUNTIME_TARGETS) {
      const profile = getRuntimeProfile(target);

      expect(Object.keys(profile.hooks).sort()).toEqual([...GATE_TYPES].sort());
      for (const gateType of GATE_TYPES) {
        expect(profile.hooks[gateType]).toMatchObject({
          gateType,
          command: toHookCommand(gateType),
        });
      }
    }
  });

  it("keeps Codex subagent_stop missing", () => {
    const codex = getRuntimeProfile("codex");

    expect(codex.hooks.subagent_stop.supported).toBe(false);
    expect(codex.hooks.subagent_stop.nativeEvent).toBeNull();
    expect(codex.hooks.subagent_stop.canBlock).toBe(false);
  });

  it("uses hyphenated hook commands for all canonical gates", () => {
    const expectedCommands: Record<GateType, `harness hook ${string}`> = {
      session_start: "harness hook session-start",
      user_prompt: "harness hook user-prompt-submit",
      pre_tool: "harness hook pre-tool-use",
      post_tool: "harness hook post-tool-use",
      stop: "harness hook stop",
      subagent_start: "harness hook subagent-start",
      subagent_stop: "harness hook subagent-stop",
    };

    for (const target of RUNTIME_TARGETS as readonly RuntimeTarget[]) {
      const profile = getRuntimeProfile(target);

      for (const gateType of GATE_TYPES) {
        expect(profile.hooks[gateType].command).toBe(expectedCommands[gateType]);
      }
    }
  });
});
