import { describe, expect, it } from "vitest";
import {
  buildArtifactAutoOpenContext,
  buildFounderDigestContext,
  buildNextAttackContext,
  buildResearchConvertContext,
  buildReviewSurfaceContext,
} from "../src/auto-actions.js";

// ---------------------------------------------------------------------------
// R-025 — buildArtifactAutoOpenContext
// ---------------------------------------------------------------------------

describe("buildArtifactAutoOpenContext", () => {
  it("includes the HIMA auto prefix", () => {
    const result = buildArtifactAutoOpenContext("/path/to/plan.md");
    expect(result).toContain("[HIMA auto] artifact written");
  });

  it("includes the cmux markdown open command", () => {
    const result = buildArtifactAutoOpenContext("/path/to/plan.md");
    expect(result).toContain("cmux markdown open");
  });

  it("includes the --focus true flag", () => {
    const result = buildArtifactAutoOpenContext("/path/to/plan.md");
    expect(result).toContain("--focus true");
  });

  it("embeds the provided file path verbatim", () => {
    const path = "/Users/founder/hima/docs/plans/sprint-42.md";
    const result = buildArtifactAutoOpenContext(path);
    expect(result).toContain(path);
  });

  it("produces a single line (no newlines)", () => {
    const result = buildArtifactAutoOpenContext("docs/specs/SPEC-007.md");
    expect(result).not.toContain("\n");
  });

  it("assembles the full canonical command", () => {
    const fp = "/work/ralplan.md";
    expect(buildArtifactAutoOpenContext(fp)).toBe(
      `[HIMA auto] artifact written — open it: cmux markdown open ${fp} --focus true`,
    );
  });
});

// ---------------------------------------------------------------------------
// R-026 — buildFounderDigestContext
// ---------------------------------------------------------------------------

describe("buildFounderDigestContext", () => {
  const opts = {
    state: "DONE_VERIFIED — local tests pass",
    whatChanged: "auto-actions module added with 5 pure builders",
    reviewCmd: "git diff --stat HEAD",
  };

  it("starts with the ## Founder Digest header", () => {
    const result = buildFounderDigestContext(opts);
    expect(result).toContain("## Founder Digest");
  });

  it("contains all 8 required field labels", () => {
    const result = buildFounderDigestContext(opts);
    expect(result).toContain("**What this means**");
    expect(result).toContain("**The core loop**");
    expect(result).toContain("**Terms translated**");
    expect(result).toContain("**What is actually new**");
    expect(result).toContain("**What to challenge**");
    expect(result).toContain("**Where to look**");
    expect(result).toContain("**Review surface**");
    expect(result).toContain("**State**");
  });

  it("injects opts.state into the State field", () => {
    const result = buildFounderDigestContext(opts);
    expect(result).toContain(opts.state);
  });

  it("injects opts.whatChanged into the What this means and What is actually new fields", () => {
    const result = buildFounderDigestContext(opts);
    // whatChanged appears at least twice (in "What this means" and "What is actually new")
    const occurrences = result.split(opts.whatChanged).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("injects opts.reviewCmd into the Review surface field", () => {
    const result = buildFounderDigestContext(opts);
    expect(result).toContain(opts.reviewCmd);
  });

  it("stays within the 20-line hard limit", () => {
    const result = buildFounderDigestContext(opts);
    const lines = result.split("\n");
    expect(lines.length).toBeLessThanOrEqual(20);
  });

  it("is multi-line (contains newlines)", () => {
    const result = buildFounderDigestContext(opts);
    expect(result).toContain("\n");
  });

  it("different opts produce different digests", () => {
    const a = buildFounderDigestContext({ ...opts, state: "PARTIAL" });
    const b = buildFounderDigestContext({ ...opts, state: "BLOCKED" });
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// R-044 — buildReviewSurfaceContext
// ---------------------------------------------------------------------------

describe("buildReviewSurfaceContext", () => {
  it("returns the git diff command when changed=true", () => {
    const result = buildReviewSurfaceContext(true);
    expect(result).toContain("[HIMA] review surface:");
    expect(result).toContain("git diff --stat HEAD");
  });

  it("returns a no-diff note when changed=false", () => {
    const result = buildReviewSurfaceContext(false);
    expect(result).toContain("[HIMA] review surface:");
    expect(result).toContain("No diff this session");
  });

  it("result is a single line in both cases", () => {
    expect(buildReviewSurfaceContext(true)).not.toContain("\n");
    expect(buildReviewSurfaceContext(false)).not.toContain("\n");
  });

  it("changed=true and changed=false produce different strings", () => {
    expect(buildReviewSurfaceContext(true)).not.toBe(buildReviewSurfaceContext(false));
  });
});

// ---------------------------------------------------------------------------
// R-045 — buildResearchConvertContext
// ---------------------------------------------------------------------------

describe("buildResearchConvertContext", () => {
  it("includes the HIMA research evidence prefix", () => {
    const result = buildResearchConvertContext("WebSearch 2026-06-29");
    expect(result).toContain("[HIMA] research evidence:");
  });

  it("embeds the provided source verbatim", () => {
    const source = "deep-research: vitest NodeNext ESM docs";
    const result = buildResearchConvertContext(source);
    expect(result).toContain(source);
  });

  it("includes the convert-to reminder", () => {
    const result = buildResearchConvertContext("corpus-architecture §3");
    expect(result).toContain("convert to requirements / decisions / risks");
  });

  it("produces a single line", () => {
    const result = buildResearchConvertContext("any source");
    expect(result).not.toContain("\n");
  });

  it("full canonical form", () => {
    const src = "WebSearch 2026-06-29";
    expect(buildResearchConvertContext(src)).toBe(
      `[HIMA] research evidence: ${src} — convert to requirements / decisions / risks before deciding.`,
    );
  });
});

// ---------------------------------------------------------------------------
// R-039 — buildNextAttackContext
// ---------------------------------------------------------------------------

describe("buildNextAttackContext", () => {
  it("includes the HIMA stage prefix", () => {
    const result = buildNextAttackContext("discovery");
    expect(result).toContain("[HIMA] stage");
  });

  it("embeds the wardStage name", () => {
    const result = buildNextAttackContext("cadrage");
    expect(result).toContain("cadrage");
  });

  it("includes 'sealed'", () => {
    const result = buildNextAttackContext("implementation");
    expect(result).toContain("sealed");
  });

  it("includes the ranked next-attacks prompt", () => {
    const result = buildNextAttackContext("discovery");
    expect(result).toContain("propose ranked next attacks");
  });

  it("mentions owner surface + evidence", () => {
    const result = buildNextAttackContext("discovery");
    expect(result).toContain("owner surface");
    expect(result).toContain("evidence");
  });

  it("produces a single line", () => {
    const result = buildNextAttackContext("apprentissage");
    expect(result).not.toContain("\n");
  });

  it("full canonical form", () => {
    const stage = "discovery";
    expect(buildNextAttackContext(stage)).toBe(
      `[HIMA] stage ${stage} sealed — propose ranked next attacks (owner surface + evidence)`,
    );
  });
});
