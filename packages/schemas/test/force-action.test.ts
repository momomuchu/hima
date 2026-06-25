import { Either } from "effect";
import { describe, expect, it } from "vitest";
import { decodeForceAction, decodeForceActionEither } from "../src/index.js";

describe("ForceAction schema", () => {
  it("decodes a valid skill-force action", () => {
    const value = {
      kind: "skill-force",
      skillId: "corpus-spec-driven-development",
      reason: "spec stage requires the skill",
    };
    expect(decodeForceAction(value)).toEqual(value);
  });

  it("decodes a valid deferred-block action with resolveOn list", () => {
    const value = {
      kind: "deferred-block",
      verdictFile: ".hima/pending-stop-verdict-abc.json",
      reason: "stop is degraded on this runtime",
      resolveOn: ["pre_tool", "user_prompt"],
    };
    expect(decodeForceAction(value)).toEqual(value);
  });

  it("rejects an unknown kind", () => {
    const result = decodeForceActionEither({ kind: "nope" });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects skill-force missing skillId", () => {
    const result = decodeForceActionEither({ kind: "skill-force", reason: "x" });
    expect(Either.isLeft(result)).toBe(true);
  });
});
