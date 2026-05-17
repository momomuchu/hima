import { describe, expect, it } from "vitest";
import {
  getKeywordRegistry,
  getSkillsCatalog,
  matchKeywordRegistry,
  rankKeywordMatches,
} from "../src/index.js";

describe("keyword registry", () => {
  it("derives a typed flat registry from operational skill activation keywords", () => {
    const registry = getKeywordRegistry();
    const skillIds = new Set(getSkillsCatalog().map((skill) => skill.id));

    expect(registry.length).toBeGreaterThanOrEqual(10);
    expect(new Set(registry.map((entry) => entry.id)).size).toBe(registry.length);
    const keywordOwners = new Map<string, string>();
    for (const entry of registry) {
      expect(skillIds, `${entry.id} target skill`).toContain(entry.skillId);
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.keywords.length + entry.patterns.length).toBeGreaterThan(0);
      expect(entry.source).toBe("operational-catalog");
      for (const keyword of entry.keywords) {
        const normalized = keyword.toLocaleLowerCase().normalize("NFKC");
        expect(keywordOwners.get(normalized), `${normalized} duplicate owner`).toBeUndefined();
        keywordOwners.set(normalized, entry.skillId);
      }
    }
  });

  it("matches keywords and applies route filters", () => {
    const buildMatches = matchKeywordRegistry("please implement the code", {
      macroCycle: "build",
      gateType: "pre_tool",
      riskClass: "M",
      operatingMode: "auto",
    });
    const validationMatches = matchKeywordRegistry("please implement the code", {
      macroCycle: "validation",
      gateType: "pre_tool",
      riskClass: "M",
      operatingMode: "auto",
    });

    expect(buildMatches[0]).toMatchObject({
      skillId: "build-inner-loop",
      matchedBy: "keyword",
    });
    expect(validationMatches.map((match) => match.skillId)).not.toContain("build-inner-loop");
    expect(matchKeywordRegistry("please implement the code")).toEqual([]);
  });

  it("ranks higher priority and longer matches first", () => {
    const matches = rankKeywordMatches([
      {
        entry: {
          id: "short",
          skillId: "status",
          priority: 10,
          keywords: ["status"],
          patterns: [],
          source: "test",
        },
        skillId: "status",
        matchedText: "status",
        matchedBy: "keyword",
        score: 10,
      },
      {
        entry: {
          id: "long",
          skillId: "hima-enter",
          priority: 10,
          keywords: ["development mode"],
          patterns: [],
          source: "test",
        },
        skillId: "hima-enter",
        matchedText: "development mode",
        matchedBy: "keyword",
        score: 10,
      },
      {
        entry: {
          id: "priority",
          skillId: "classify-risk",
          priority: 20,
          keywords: ["risk"],
          patterns: [],
          source: "test",
        },
        skillId: "classify-risk",
        matchedText: "risk",
        matchedBy: "keyword",
        score: 20,
      },
    ]);

    expect(matches.map((match) => match.entry.id)).toEqual(["priority", "long", "short"]);
  });
});
