import { describe, expect, it } from "vitest";
import { routeWithCascade } from "../src/index.js";

const context = {
  macroCycle: "build" as const,
  gateType: "user_prompt" as const,
  riskClass: "M" as const,
  operatingMode: "auto" as const,
};

describe("router cascade", () => {
  it("routes regex overrides before state and keyword tiers", () => {
    const result = routeWithCascade({
      prompt: "status please",
      context,
      regexRoutes: [
        {
          id: "force-risk",
          skillId: "classify-risk",
          pattern: "\\bstatus\\b",
          priority: 100,
        },
      ],
      stateRoutes: [
        {
          id: "state-status",
          skillId: "status",
          reason: "state route for status",
          priority: 50,
          macroCycles: ["build"],
        },
      ],
    });

    expect(result).toMatchObject({
      tier: "regex",
      skillId: "classify-risk",
      routeId: "force-risk",
    });
    expect(result.eventPayload).toEqual({
      tier: "regex",
      selectedSkillId: "classify-risk",
      routeId: "force-risk",
      tokenSpendingRequired: false,
      promptLength: "status please".length,
    });
  });

  it("breaks regex route ties by priority then id", () => {
    const result = routeWithCascade({
      prompt: "status please",
      context,
      regexRoutes: [
        {
          id: "z-lower",
          skillId: "status",
          pattern: "\\bstatus\\b",
          priority: 50,
        },
        {
          id: "b-same-priority",
          skillId: "propose-change",
          pattern: "\\bstatus\\b",
          priority: 100,
        },
        {
          id: "a-same-priority",
          skillId: "classify-risk",
          pattern: "\\bstatus\\b",
          priority: 100,
        },
      ],
    });

    expect(result).toMatchObject({
      tier: "regex",
      skillId: "classify-risk",
      routeId: "a-same-priority",
    });
  });

  it("routes state matches before keyword matches", () => {
    const result = routeWithCascade({
      prompt: "status please",
      context,
      stateRoutes: [
        {
          id: "state-build-loop",
          skillId: "build-inner-loop",
          reason: "build execute route",
          priority: 50,
          macroCycles: ["build"],
          gateTypes: ["user_prompt"],
        },
      ],
    });

    expect(result).toMatchObject({
      tier: "state",
      skillId: "build-inner-loop",
      routeId: "state-build-loop",
    });
    expect(result.eventPayload).toEqual({
      tier: "state",
      selectedSkillId: "build-inner-loop",
      routeId: "state-build-loop",
      tokenSpendingRequired: false,
      promptLength: "status please".length,
    });
  });

  it("filters state routes and breaks matches by priority then id", () => {
    const result = routeWithCascade({
      prompt: "status please",
      context,
      stateRoutes: [
        {
          id: "z-validation",
          skillId: "validate-evidence",
          reason: "wrong macro cycle",
          priority: 200,
          macroCycles: ["validation"],
        },
        {
          id: "b-build",
          skillId: "status",
          reason: "same priority build route",
          priority: 100,
          macroCycles: ["build"],
          gateTypes: ["user_prompt"],
        },
        {
          id: "a-build",
          skillId: "transition-phase",
          reason: "same priority build route with lower id",
          priority: 100,
          macroCycles: ["build"],
          gateTypes: ["user_prompt"],
        },
      ],
    });

    expect(result).toMatchObject({
      tier: "state",
      skillId: "transition-phase",
      routeId: "a-build",
    });
  });

  it("ignores invalid regex and state skill references", () => {
    const result = routeWithCascade({
      prompt: "status please",
      context,
      regexRoutes: [
        {
          id: "invalid-regex",
          skillId: "missing-skill",
          pattern: "\\bstatus\\b",
          priority: 999,
        },
      ],
      stateRoutes: [
        {
          id: "invalid-state",
          skillId: "missing-skill",
          reason: "dangling route",
          priority: 999,
          macroCycles: ["build"],
        },
      ],
    });

    expect(result).toMatchObject({
      tier: "keyword",
      skillId: "status",
    });
  });

  it("ignores invalid keyword-registry skill references", () => {
    const result = routeWithCascade({
      prompt: "custom trigger",
      context: {
        macroCycle: "build",
        gateType: "user_prompt",
        riskClass: "M",
        operatingMode: "auto",
      },
      keywordRegistry: [
        {
          id: "dangling-keyword",
          skillId: "missing-skill",
          priority: 999,
          keywords: ["custom trigger"],
          patterns: [],
          source: "test",
        },
      ],
    });

    expect(result).toMatchObject({
      tier: "llm_fallback",
      skillId: null,
    });
  });

  it("does not match filtered state or keyword routes when context is missing", () => {
    const result = routeWithCascade({
      prompt: "status please",
      stateRoutes: [
        {
          id: "state-build-loop",
          skillId: "build-inner-loop",
          reason: "requires build context",
          priority: 100,
          macroCycles: ["build"],
        },
      ],
    });

    expect(result).toMatchObject({
      tier: "llm_fallback",
      skillId: null,
    });
  });

  it("routes keyword matches before LLM fallback", () => {
    const result = routeWithCascade({
      prompt: "what is the status?",
      context,
    });

    expect(result).toMatchObject({
      tier: "keyword",
      skillId: "status",
    });
    expect(result.eventPayload).toMatchObject({
      tier: "keyword",
      selectedSkillId: "status",
      tokenSpendingRequired: false,
    });
  });

  it("returns a token-spending fallback descriptor when deterministic tiers miss", () => {
    const result = routeWithCascade({
      prompt: "this is unrelated to any known trigger",
      context,
    });

    expect(result.tier).toBe("llm_fallback");
    expect(result.skillId).toBeNull();
    expect(result.eventPayload).toEqual({
      tier: "llm_fallback",
      selectedSkillId: null,
      routeId: null,
      tokenSpendingRequired: true,
      promptLength: "this is unrelated to any known trigger".length,
    });
    expect(result.llmFallback).toMatchObject({
      required: true,
      tokenSpendingRequired: true,
    });
    expect(result.llmFallback?.candidateSkillIds).toContain("hima-enter");
  });
});
