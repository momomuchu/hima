import { describe, expect, it } from "vitest";
import {
  buildArtifactAutoOpenContext,
  buildFounderDigestContext,
  buildNextAttackContext,
  buildResearchConvertContext,
  buildReviewSurfaceContext,
  detectOpenEnv,
  type OpenEnv,
} from "../src/auto-actions.js";

// ---------------------------------------------------------------------------
// R-025 — buildArtifactAutoOpenContext
// ---------------------------------------------------------------------------

const CMUX: OpenEnv = { platform: "darwin", inCmux: true };

describe("buildArtifactAutoOpenContext (inside CMUX)", () => {
  it("includes the HIMA auto prefix", () => {
    expect(buildArtifactAutoOpenContext("/path/to/plan.md", CMUX)).toContain(
      "[HIMA auto] artifact written",
    );
  });

  it("includes the cmux markdown open command", () => {
    expect(buildArtifactAutoOpenContext("/path/to/plan.md", CMUX)).toContain("cmux markdown open");
  });

  it("includes the --focus true flag", () => {
    expect(buildArtifactAutoOpenContext("/path/to/plan.md", CMUX)).toContain("--focus true");
  });

  it("embeds the provided file path verbatim", () => {
    const path = "/Users/founder/hima/docs/plans/sprint-42.md";
    expect(buildArtifactAutoOpenContext(path, CMUX)).toContain(path);
  });

  it("produces a single line (no newlines)", () => {
    expect(buildArtifactAutoOpenContext("docs/specs/SPEC-007.md", CMUX)).not.toContain("\n");
  });

  it("assembles the full canonical command (path quoted)", () => {
    const fp = "/work/ralplan.md";
    expect(buildArtifactAutoOpenContext(fp, CMUX)).toBe(
      `[HIMA auto] artifact written — open it: cmux markdown open "${fp}" --focus true`,
    );
  });
});

describe("buildArtifactAutoOpenContext (portability — non-CMUX environments)", () => {
  it("uses macOS `open` on darwin outside CMUX", () => {
    expect(buildArtifactAutoOpenContext("/p/x.md", { platform: "darwin", inCmux: false })).toBe(
      '[HIMA auto] artifact written — open it: open "/p/x.md"',
    );
  });

  it("uses `xdg-open` on linux", () => {
    expect(buildArtifactAutoOpenContext("/p/x.md", { platform: "linux", inCmux: false })).toBe(
      '[HIMA auto] artifact written — open it: xdg-open "/p/x.md"',
    );
  });

  it("uses `start` with an empty title arg on win32", () => {
    expect(buildArtifactAutoOpenContext("C:/p/x.md", { platform: "win32", inCmux: false })).toBe(
      '[HIMA auto] artifact written — open it: start "" "C:/p/x.md"',
    );
  });

  it("prefers cmux even on linux when inside CMUX (cmux-open-surface rule)", () => {
    expect(buildArtifactAutoOpenContext("/p/x.md", { platform: "linux", inCmux: true })).toContain(
      "cmux markdown open",
    );
  });

  it("quotes paths containing spaces into a single token on every platform", () => {
    const spaced = "/Users/maache/My Work/plan.md";
    const cases: Array<[OpenEnv, string]> = [
      [{ platform: "darwin", inCmux: true }, `cmux markdown open "${spaced}" --focus true`],
      [{ platform: "darwin", inCmux: false }, `open "${spaced}"`],
      [{ platform: "linux", inCmux: false }, `xdg-open "${spaced}"`],
      [{ platform: "win32", inCmux: false }, `start "" "${spaced}"`],
    ];
    for (const [env, expected] of cases) {
      expect(buildArtifactAutoOpenContext(spaced, env)).toBe(
        `[HIMA auto] artifact written — open it: ${expected}`,
      );
    }
  });

  it("stays single-line on every platform", () => {
    for (const platform of ["darwin", "linux", "win32"] as const) {
      expect(buildArtifactAutoOpenContext("/p/x.md", { platform, inCmux: false })).not.toContain(
        "\n",
      );
    }
  });
});

describe("detectOpenEnv", () => {
  it("detects CMUX from CMUX_WORKSPACE_ID", () => {
    expect(detectOpenEnv({ CMUX_WORKSPACE_ID: "ws_1" }, "darwin").inCmux).toBe(true);
  });

  it("detects CMUX from CMUX_SURFACE_ID", () => {
    expect(detectOpenEnv({ CMUX_SURFACE_ID: "sf_1" }, "linux").inCmux).toBe(true);
  });

  it("reports not-in-CMUX when no CMUX env vars present", () => {
    expect(detectOpenEnv({}, "linux").inCmux).toBe(false);
  });

  it("passes the platform through", () => {
    expect(detectOpenEnv({}, "win32").platform).toBe("win32");
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
