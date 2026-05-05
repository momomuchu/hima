import { describe, expect, it } from "vitest";
import {
  EVIDENCE_KEYS,
  GATE_TYPES,
  getHooksCatalog,
  getOperationalCatalog,
  getSkillsCatalog,
  getSubagentsCatalog,
  MACRO_CYCLES,
  OPERATING_MODES,
  RISK_CLASSES,
} from "../src/index.js";

function expectUniqueIds(entries: readonly { id: string }[], label: string) {
  const ids = entries.map((entry) => entry.id);
  expect(new Set(ids).size, `${label} ids must be unique`).toBe(ids.length);
}

function expectEveryCanonical<T extends string>(
  values: readonly T[],
  canonical: readonly T[],
  label: string,
) {
  for (const value of values) {
    expect(canonical, `${label} uses canonical value ${value}`).toContain(value);
  }
}

describe("operational catalogs", () => {
  it("exports all catalog sections from one operational catalog", () => {
    const catalog = getOperationalCatalog();

    expect(catalog.skills).toEqual(getSkillsCatalog());
    expect(catalog.hooks).toEqual(getHooksCatalog());
    expect(catalog.subagents).toEqual(getSubagentsCatalog());
    expect(catalog.skills.length).toBeGreaterThanOrEqual(8);
    expect(catalog.hooks.length).toBeGreaterThanOrEqual(8);
    expect(catalog.subagents.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps catalog ids unique", () => {
    expectUniqueIds(getSkillsCatalog(), "skill");
    expectUniqueIds(getHooksCatalog(), "hook");
    expectUniqueIds(getSubagentsCatalog(), "subagent");
  });

  it("has no dangling references among skills, hooks, and subagents", () => {
    const skills = getSkillsCatalog();
    const hooks = getHooksCatalog();
    const subagents = getSubagentsCatalog();
    const skillIds = new Set(skills.map((entry) => entry.id));
    const hookIds = new Set(hooks.map((entry) => entry.id));
    const subagentIds = new Set(subagents.map((entry) => entry.id));

    for (const skill of skills) {
      for (const hookRef of skill.hookRefs) {
        expect(hookIds, `${skill.id} references hook ${hookRef}`).toContain(hookRef);
      }
      for (const subagentRef of skill.subagentRefs) {
        expect(subagentIds, `${skill.id} references subagent ${subagentRef}`).toContain(
          subagentRef,
        );
      }
    }

    for (const hook of hooks) {
      for (const skillRef of hook.skillRefs) {
        expect(skillIds, `${hook.id} references skill ${skillRef}`).toContain(skillRef);
      }
      for (const subagentRef of hook.subagentRefs) {
        expect(subagentIds, `${hook.id} references subagent ${subagentRef}`).toContain(subagentRef);
      }
    }

    for (const subagent of subagents) {
      for (const hookRef of subagent.hookRefs) {
        expect(hookIds, `${subagent.id} references hook ${hookRef}`).toContain(hookRef);
      }
      for (const skillRef of subagent.skillRefs) {
        expect(skillIds, `${subagent.id} references skill ${skillRef}`).toContain(skillRef);
      }
    }
  });

  it("uses only canonical cycles, gates, risk classes, modes, and evidence keys", () => {
    for (const skill of getSkillsCatalog()) {
      expectEveryCanonical(skill.activation.macroCycles, MACRO_CYCLES, `${skill.id} cycles`);
      expectEveryCanonical(skill.activation.riskClasses, RISK_CLASSES, `${skill.id} risks`);
      expectEveryCanonical(skill.activation.gateTypes ?? [], GATE_TYPES, `${skill.id} gates`);
      expectEveryCanonical(
        skill.activation.operatingModes ?? [],
        OPERATING_MODES,
        `${skill.id} modes`,
      );
      expectEveryCanonical(skill.evidenceProduced, EVIDENCE_KEYS, `${skill.id} evidence`);
    }

    for (const hook of getHooksCatalog()) {
      expectEveryCanonical(hook.macroCycles, MACRO_CYCLES, `${hook.id} cycles`);
      expectEveryCanonical(hook.gateTypes, GATE_TYPES, `${hook.id} gates`);
      expectEveryCanonical(hook.riskClasses, RISK_CLASSES, `${hook.id} risks`);
      expectEveryCanonical(hook.operatingModes, OPERATING_MODES, `${hook.id} modes`);
      expectEveryCanonical(hook.evidenceKeys, EVIDENCE_KEYS, `${hook.id} evidence`);
    }

    for (const subagent of getSubagentsCatalog()) {
      expectEveryCanonical(subagent.spawn.macroCycles, MACRO_CYCLES, `${subagent.id} cycles`);
      expectEveryCanonical(subagent.spawn.gateTypes, GATE_TYPES, `${subagent.id} gates`);
      expectEveryCanonical([subagent.spawn.minimumRiskClass], RISK_CLASSES, `${subagent.id} risk`);
      expectEveryCanonical(
        Object.keys(subagent.spawn.applicabilityByRisk),
        RISK_CLASSES,
        `${subagent.id} applicability risks`,
      );
      expectEveryCanonical(
        subagent.spawn.operatingModes ?? [],
        OPERATING_MODES,
        `${subagent.id} modes`,
      );
      expectEveryCanonical(subagent.evidenceProduced, EVIDENCE_KEYS, `${subagent.id} evidence`);
    }
  });

  it("includes the MVP operational concerns", () => {
    const hookIds = getHooksCatalog().map((entry) => entry.id);
    const skillIds = getSkillsCatalog().map((entry) => entry.id);

    expect(hookIds).toEqual(
      expect.arrayContaining([
        "risk-classification",
        "state-machine",
        "gate-policy",
        "runtime-bindings",
        "platform-adapters",
        "convergence",
        "close-finalization",
        "evidence-management",
      ]),
    );
    expect(skillIds).toEqual(
      expect.arrayContaining([
        "classify-risk",
        "transition-phase",
        "gate-policy",
        "bind-runtime",
        "validate-evidence",
        "close-run",
      ]),
    );
  });
});
