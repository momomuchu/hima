import { Schema } from "effect";
import { SkillRef } from "./skill-ref.js";

/**
 * StageDef — one stage in a development cycle.
 * `forceSkills` are skills that must be forced (activated) when entering this stage.
 * `injectSkills` are skills whose context is injected as background guidance.
 * `entryAllowed` gates whether the pipeline may enter this stage given current state.
 *
 * See: .planning/architecture/AMENDMENT-003 (cycle is DATA not hardcoded).
 */

export const StageDef = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  forceSkills: Schema.Array(SkillRef),
  injectSkills: Schema.Array(SkillRef),
  entryAllowed: Schema.Boolean,
});

export type StageDef = typeof StageDef.Type;

/**
 * CycleDef — a named development cycle composed of ordered stages.
 */

export const CycleDef = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  stages: Schema.Array(StageDef),
});

export type CycleDef = typeof CycleDef.Type;

/** Decode an unknown value into a CycleDef, throwing on invalid input. */
export const decodeCycleDef = Schema.decodeUnknownSync(CycleDef);

/** Decode an unknown value into Either<CycleDef, ParseError> (non-throwing). */
export const decodeCycleDefEither = Schema.decodeUnknownEither(CycleDef);

/** Decode an unknown value into a StageDef, throwing on invalid input. */
export const decodeStageDef = Schema.decodeUnknownSync(StageDef);

/** Decode an unknown value into Either<StageDef, ParseError> (non-throwing). */
export const decodeStageDefEither = Schema.decodeUnknownEither(StageDef);

/**
 * DEV_CYCLE — the canonical 8-stage development cycle (AMENDMENT-003).
 * Stages: discovery, analysis, spec, design, impl, test, verify, maintenance.
 * Each stage's forceSkills reference the founder default corpus-skill map.
 */
export const DEV_CYCLE: CycleDef = {
  id: "dev-cycle-v1",
  name: "Development Cycle",
  stages: [
    {
      id: "discovery",
      name: "Discovery",
      forceSkills: [
        { source: "corpus", id: "corpus-technical-analysis-discovery" },
      ],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "analysis",
      name: "Analysis",
      forceSkills: [
        { source: "corpus", id: "corpus-specification-requirements" },
        { source: "corpus", id: "corpus-domain-modeling-ddd" },
      ],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "spec",
      name: "Specification",
      forceSkills: [
        { source: "corpus", id: "corpus-spec-driven-development" },
      ],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "design",
      name: "Design",
      forceSkills: [
        { source: "corpus", id: "corpus-architecture-system-design" },
      ],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "impl",
      name: "Implementation",
      forceSkills: [
        { source: "corpus", id: "corpus-code-quality-maintainability" },
        { source: "corpus", id: "corpus-error-handling-resilience" },
      ],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "test",
      name: "Test",
      forceSkills: [
        { source: "corpus", id: "corpus-quality-engineering" },
      ],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "verify",
      name: "Verify",
      forceSkills: [
        { source: "corpus", id: "corpus-quality-engineering" },
      ],
      injectSkills: [],
      entryAllowed: true,
    },
    {
      id: "maintenance",
      name: "Maintenance",
      forceSkills: [
        { source: "corpus", id: "corpus-production-reliability-devops" },
      ],
      injectSkills: [],
      entryAllowed: true,
    },
  ],
};
