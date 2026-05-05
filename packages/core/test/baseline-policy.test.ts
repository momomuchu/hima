import { describe, expect, it } from "vitest";
import { BASE_GATES, getRequiredGates, mergeRequiredGates, RISK_POLICY } from "../src/index.js";

describe("baseline policy", () => {
  it("keeps required gates in one policy source", () => {
    expect(BASE_GATES).toEqual(["session_start", "user_prompt", "pre_tool", "post_tool", "stop"]);
    expect(getRequiredGates("M", { delegationPlanned: true })).toEqual([
      "session_start",
      "user_prompt",
      "pre_tool",
      "post_tool",
      "stop",
      "subagent_start",
      "subagent_stop",
    ]);
  });

  it("models checkpoints as policy inside auto/pairing, not as extra modes", () => {
    expect(RISK_POLICY.H.allowedModes).toEqual(["auto", "pairing"]);
    expect(RISK_POLICY.H.requiresHumanCheckpoint).toBe(true);
    expect(RISK_POLICY.H.mandatoryEvidenceKeys).toContain("threat_model_stride");
    expect(RISK_POLICY.C.allowedModes).toEqual(["auto", "pairing"]);
    expect(RISK_POLICY.C.requiresHumanCheckpoint).toBe(true);
    expect(RISK_POLICY.C.mandatoryEvidenceKeys).toContain("independent_security_audit");
  });

  it("merges required gates without duplicating policy, route, or state gates", () => {
    expect(
      mergeRequiredGates(
        ["session_start", "pre_tool", "stop"],
        ["pre_tool", "subagent_stop"],
        undefined,
        ["stop", "subagent_start"],
      ),
    ).toEqual(["session_start", "pre_tool", "stop", "subagent_stop", "subagent_start"]);
  });
});
