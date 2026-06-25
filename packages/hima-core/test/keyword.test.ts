import { describe, expect, it } from "vitest";
import { pickSigil } from "../src/keyword.js";

describe("pickSigil", () => {
  // ── Terminal sigil detection ──────────────────────────────────────────────

  it('detects "full" at end → entryPoint full, floor H', () => {
    expect(pickSigil("build it full")).toEqual({
      sigil: "full",
      entryPoint: "full",
      floor: "H",
    });
  });

  it('detects "ulw" alias → entryPoint full, floor H', () => {
    expect(pickSigil("ship ulw")).toEqual({
      sigil: "ulw",
      entryPoint: "full",
      floor: "H",
    });
  });

  it('detects "run" at end → entryPoint run, floor M', () => {
    expect(pickSigil("deploy and run")).toEqual({
      sigil: "run",
      entryPoint: "run",
      floor: "M",
    });
  });

  it('detects "spec" at end → entryPoint spec, floor M', () => {
    expect(pickSigil("write the spec")).toEqual({
      sigil: "spec",
      entryPoint: "spec",
      floor: "M",
    });
  });

  // ── Case-insensitivity ────────────────────────────────────────────────────

  it("detects upper-case FULL", () => {
    expect(pickSigil("ship it FULL")).toEqual({
      sigil: "full",
      entryPoint: "full",
      floor: "H",
    });
  });

  it("detects mixed-case Ulw", () => {
    const result = pickSigil("do it Ulw");
    expect(result).not.toBeNull();
    expect(result?.entryPoint).toBe("full");
    expect(result?.floor).toBe("H");
  });

  // ── Trailing whitespace tolerance ─────────────────────────────────────────

  it("detects sigil with trailing spaces", () => {
    expect(pickSigil("build it full   ")).toEqual({
      sigil: "full",
      entryPoint: "full",
      floor: "H",
    });
  });

  // ── Inline code span stripping — sigil inside backticks is NOT detected ───

  it('returns null when sigil is inside an inline code span (`run`)', () => {
    expect(pickSigil("fix `run`")).toBeNull();
  });

  it("returns null when sigil is inside an inline code span (`full`)", () => {
    expect(pickSigil("check `full` usage")).toBeNull();
  });

  it("returns null when sigil is inside an inline code span and nothing follows", () => {
    expect(pickSigil("try `spec`")).toBeNull();
  });

  // ── Fenced code block stripping ───────────────────────────────────────────

  it("returns null when sigil appears only inside a fenced code block", () => {
    const text = "Here is the code:\n```\nrun\n```";
    expect(pickSigil(text)).toBeNull();
  });

  it("returns null when sigil appears only inside a fenced block at end", () => {
    const text = "```bash\necho full\n```";
    expect(pickSigil(text)).toBeNull();
  });

  // ── Non-terminal position — sigil must be at the END ─────────────────────

  it("returns null when sigil is not at end of message", () => {
    expect(pickSigil("run the tests please")).toBeNull();
  });

  it("returns null when sigil appears mid-sentence only", () => {
    expect(pickSigil("run this first and spec later")).toBeNull();
  });

  it("returns null when 'full' appears mid-sentence, not terminal", () => {
    expect(pickSigil("full coverage matters a lot here")).toBeNull();
  });

  // ── No sigil at all ───────────────────────────────────────────────────────

  it("returns null when there is no sigil anywhere", () => {
    expect(pickSigil("no sigil here")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(pickSigil("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(pickSigil("   ")).toBeNull();
  });

  // ── Mixed: fenced block + terminal sigil after it ─────────────────────────

  it("detects terminal sigil that appears AFTER a fenced block", () => {
    const text = "Here:\n```\nsome code\n```\nbuild it full";
    expect(pickSigil(text)).toEqual({
      sigil: "full",
      entryPoint: "full",
      floor: "H",
    });
  });

  it("detects terminal sigil after inline code span", () => {
    const text = "fix the `broken` thing run";
    expect(pickSigil(text)).toEqual({
      sigil: "run",
      entryPoint: "run",
      floor: "M",
    });
  });
});
