import { describe, expect, it } from "vitest";
import {
  evaluatePromptCacheBoundary,
  PROMPT_CACHE_INVALIDATION_REASONS,
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
} from "../src/index.js";

describe("prompt cache boundary", () => {
  it("accepts a fresh prompt with a stable prefix and dynamic suffix", () => {
    const result = evaluatePromptCacheBoundary({
      prompt: [
        "Static HIMA policy and tool contract.",
        SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
        "run_id=run-1",
        "risk_class=M",
      ].join("\n"),
      dynamicStateMarkers: ["run_id", "risk_class"],
      snapshotAt: "2026-05-15T00:00:00.000Z",
      now: "2026-05-15T00:00:01.000Z",
      maxSnapshotAgeMs: 5_000,
    });

    expect(result).toMatchObject({
      decision: "allow_cache",
      boundaryCount: 1,
      invalidationRequired: false,
      reasons: [],
      stale: false,
      snapshotAgeMs: 1_000,
    });
    expect(result.cacheablePrefix).toContain("Static HIMA policy");
    expect(result.cacheablePrefix).not.toContain("run_id");
    expect(result.dynamicSuffix).toContain("risk_class=M");
  });

  it("bypasses cache when the boundary snapshot is stale", () => {
    const result = evaluatePromptCacheBoundary({
      prompt: ["Static policy", SYSTEM_PROMPT_DYNAMIC_BOUNDARY, "run_id=run-1"].join("\n"),
      snapshotAt: "2026-05-15T00:00:00.000Z",
      now: "2026-05-15T00:00:10.000Z",
      maxSnapshotAgeMs: 5_000,
    });

    expect(result.decision).toBe("bypass_cache");
    expect(result.stale).toBe(true);
    expect(result.snapshotAgeMs).toBe(10_000);
    expect(result.reasons).toEqual(["staleSnapshot"]);
  });

  it("bypasses cache for explicit invalidation signals", () => {
    const result = evaluatePromptCacheBoundary({
      prompt: ["Static policy", SYSTEM_PROMPT_DYNAMIC_BOUNDARY, "run_id=run-1"].join("\n"),
      invalidationSignals: [" policy_changed ", "risk_changed", "policy_changed"],
    });

    expect(result.decision).toBe("bypass_cache");
    expect(result.reasons).toEqual(["invalidationSignal"]);
    expect(result.invalidationSignals).toEqual(["policy_changed", "risk_changed"]);
  });

  it("rejects missing, duplicate, or leaked dynamic boundary state", () => {
    expect(
      evaluatePromptCacheBoundary({
        prompt: "Static policy without marker",
      }).reasons,
    ).toEqual(["missingBoundary"]);

    expect(
      evaluatePromptCacheBoundary({
        prompt: [
          "Static policy",
          SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
          "dynamic",
          SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
          "more dynamic",
        ].join("\n"),
      }).reasons,
    ).toEqual(["duplicateBoundary"]);

    const leaked = evaluatePromptCacheBoundary({
      prompt: ["Static policy run_id=run-1", SYSTEM_PROMPT_DYNAMIC_BOUNDARY, "risk_class=M"].join(
        "\n",
      ),
      dynamicStateMarkers: ["run_id"],
    });

    expect(leaked.decision).toBe("bypass_cache");
    expect(leaked.reasons).toEqual(["dynamicStateInCacheablePrefix"]);
    expect(leaked.leakedDynamicStateMarkers).toEqual(["run_id"]);
  });

  it("keeps the invalidation reason catalog unique and ordered", () => {
    expect(PROMPT_CACHE_INVALIDATION_REASONS).toEqual([
      "missingBoundary",
      "duplicateBoundary",
      "staleSnapshot",
      "invalidationSignal",
      "dynamicStateInCacheablePrefix",
    ]);
    expect(new Set(PROMPT_CACHE_INVALIDATION_REASONS).size).toBe(
      PROMPT_CACHE_INVALIDATION_REASONS.length,
    );
  });
});
