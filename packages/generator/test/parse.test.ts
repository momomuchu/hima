/**
 * parse.test.ts — unit tests for Stage 0 PARSE (parseRules + parseFrontmatter logic).
 * Uses small inline fixture strings; does NOT depend on the real corpus path.
 */
import { describe, it, expect } from "vitest";
import { parseRules } from "../src/parse.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---- inline fixture helpers -----------------------------------------------

function makeRulesFile(content: string): string {
  const dir = join(tmpdir(), `hima-parse-test-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, "ACTIVATION-RULES.md");
  writeFileSync(p, content, "utf8");
  return p;
}

// A minimal two-rule fixture covering the 7-regex grammar:
//   - RULE_START: ### RULE <id>
//   - SIGNAL (quoted string signal + phase signal)
//   - FORCE-INVOKE with [HARD] or [SOFT]
//   - HANDOFF NEXT-STAGE and END variants
//   - PRECEDENCE numeric field
const FIXTURE = `
### RULE analysis-discovery-001
SIGNAL: "impact analysis" | "codebase mapping"
FORCE-INVOKE: technical-analysis-discovery [HARD]
HANDOFF: NEXT-STAGE specification
PRECEDENCE: 10

### RULE idea-pmf-001
SIGNAL: "idea validation" | "pmf"
FORCE-INVOKE: idea-to-pmf [SOFT]
HANDOFF: END
PRECEDENCE: 5
`;

describe("parseRules", () => {
  it("extracts the correct rule id from ### RULE <id> headers", () => {
    const path = makeRulesFile(FIXTURE);
    const rules = parseRules(path);
    const ids = rules.map((r) => r.id);
    expect(ids).toContain("analysis-discovery-001");
    expect(ids).toContain("idea-pmf-001");
  });

  it("assigns stage from the rule id prefix (spine mapping)", () => {
    const path = makeRulesFile(FIXTURE);
    const rules = parseRules(path);
    const r = rules.find((r) => r.id === "analysis-discovery-001");
    expect(r).toBeDefined();
    // idToStage normalises to spine — "analysis-discovery" maps to "analysis-discovery"
    expect(r!.stage).toBe("analysis-discovery");
  });

  it("extracts hardness [HARD] correctly", () => {
    const path = makeRulesFile(FIXTURE);
    const rules = parseRules(path);
    const r = rules.find((r) => r.id === "analysis-discovery-001");
    expect(r!.hardness).toBe("HARD");
  });

  it("extracts hardness [SOFT] correctly", () => {
    const path = makeRulesFile(FIXTURE);
    const rules = parseRules(path);
    const r = rules.find((r) => r.id === "idea-pmf-001");
    expect(r!.hardness).toBe("SOFT");
  });

  it("extracts forceInvokeSkill without the [HARD]/[SOFT] bracket annotation", () => {
    const path = makeRulesFile(FIXTURE);
    const rules = parseRules(path);
    const r = rules.find((r) => r.id === "analysis-discovery-001");
    expect(r!.forceInvokeSkill).toBe("technical-analysis-discovery");
  });

  it("extracts NEXT-STAGE handoff target correctly", () => {
    const path = makeRulesFile(FIXTURE);
    const rules = parseRules(path);
    const r = rules.find((r) => r.id === "analysis-discovery-001");
    expect(r!.handoffTarget).toBe("specification");
    expect(r!.isEnd).toBe(false);
  });

  it("detects END handoff and sets isEnd=true", () => {
    const path = makeRulesFile(FIXTURE);
    const rules = parseRules(path);
    const r = rules.find((r) => r.id === "idea-pmf-001");
    expect(r!.isEnd).toBe(true);
    expect(r!.handoffTarget).toBe("END");
  });

  it("extracts numeric PRECEDENCE field", () => {
    const path = makeRulesFile(FIXTURE);
    const rules = parseRules(path);
    const r1 = rules.find((r) => r.id === "analysis-discovery-001");
    const r2 = rules.find((r) => r.id === "idea-pmf-001");
    expect(r1!.precedence).toBe(10);
    expect(r2!.precedence).toBe(5);
  });

  it("extracts quoted signal A tokens from the SIGNAL line", () => {
    const path = makeRulesFile(FIXTURE);
    const rules = parseRules(path);
    const r = rules.find((r) => r.id === "analysis-discovery-001");
    expect(r!.signalA).toContain("impact analysis");
    expect(r!.signalA).toContain("codebase mapping");
  });

  it("returns exactly 2 rules from the 2-rule fixture", () => {
    const path = makeRulesFile(FIXTURE);
    const rules = parseRules(path);
    expect(rules).toHaveLength(2);
  });
});
