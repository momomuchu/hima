import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  EvidenceItemSchema,
  IntentSetSchema,
  PolicySetSchema,
  ProjectSetSchema,
  RunSetFileSchema,
  SubagentRunRecordSchema,
} from "../src/index.js";

const futureKey = fc.constantFrom(
  "xSprint22A",
  "xSprint22B",
  "xSprint22C",
  "xSprint22D",
  "xSprint22E",
);

const invalidNonObjectRoot = fc.oneof(
  fc.constant(null),
  fc.boolean(),
  fc.integer(),
  fc.double({ noNaN: true }),
  fc.string(),
  fc.array(fc.jsonValue()),
);

describe("RMS schema preservation properties", () => {
  it("preserves unknown ProjectSet root fields", () => {
    fc.assert(
      fc.property(jsonObjectArbitrary(), (extension) => {
        expect(ProjectSetSchema.parse(extension)).toEqual(extension);
      }),
      { numRuns: 100 },
    );
  });

  it("preserves unknown IntentSet root fields", () => {
    fc.assert(
      fc.property(jsonObjectArbitrary(), (extension) => {
        expect(IntentSetSchema.parse(extension)).toEqual(extension);
      }),
      { numRuns: 100 },
    );
  });

  it("preserves unknown PolicySet root fields", () => {
    fc.assert(
      fc.property(jsonObjectArbitrary(), (extension) => {
        expect(PolicySetSchema.parse(extension)).toEqual(extension);
      }),
      { numRuns: 100 },
    );
  });

  it("preserves evidence metadata as opaque JSON object data", () => {
    fc.assert(
      fc.property(jsonObjectArbitrary(), (metadata) => {
        const evidence = {
          id: "ev-property",
          key: "subagent_output" as const,
          kind: "property",
          status: "accepted" as const,
          summary: "property evidence",
          metadata,
          createdAt: "2026-05-03T00:00:00.000Z",
        };

        expect(EvidenceItemSchema.parse(evidence).metadata).toEqual(metadata);
      }),
      { numRuns: 100 },
    );
  });

  it("preserves SubagentRunRecord metadata and future root fields", () => {
    fc.assert(
      fc.property(jsonObjectArbitrary(), jsonObjectArbitrary(), (metadata, futureFields) => {
        const record = {
          ...futureFields,
          agentId: "agent-property",
          metadata,
        };

        expect(SubagentRunRecordSchema.parse(record)).toEqual(record);
      }),
      { numRuns: 100 },
    );
  });

  it("rejects invalid non-object ProjectSet, IntentSet, and PolicySet roots", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("project", "intent", "policy"),
        invalidNonObjectRoot,
        (field, value) => {
          expect(
            RunSetFileSchema.safeParse({
              ...runSetFixture(),
              [field]: value,
            }).success,
          ).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

function jsonObjectArbitrary(): fc.Arbitrary<Record<string, unknown>> {
  return fc.dictionary(futureKey, fc.jsonValue(), { maxKeys: 5 }) as fc.Arbitrary<
    Record<string, unknown>
  >;
}

function runSetFixture() {
  return {
    version: 1 as const,
    runId: "run_schema_contract",
    project: {},
    intent: {},
    runtimeCapabilities: {},
    runtimeBindings: {},
    policy: {},
    route: {
      phase: "discovery" as const,
      subPhase: "Observer" as const,
      mode: "auto" as const,
      riskClass: "T" as const,
    },
    events: [],
    evidence: [],
    subagents: [],
    finalization: {
      state: "ACTIVE" as const,
      gaps: [],
    },
  };
}
