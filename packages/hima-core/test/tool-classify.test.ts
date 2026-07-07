/**
 * Tests for behavior-core/tool-classify.ts — shared cross-runtime write-tool
 * classification (the Codex apply_patch fix).
 *
 * canonicalWriteTool:
 *   A. "Write" / "Edit" / "MultiEdit" → true
 *   B. "apply_patch" → true
 *   C. "applypatch" (no underscore) → true
 *   D. "APPLY_PATCH" (upper-case) → true
 *   E. "apply-patch" (hyphen) → true
 *   F. "str_replace_editor" / "str_replace_based_edit_tool" → true
 *   G. "Bash" / "Read" / "Glob" → false
 *   H. undefined / "" / non-string → false
 *
 * extractApplyPatchTargets:
 *   I. single "Add File:" header → [path]
 *   J. single "Update File:" header → [path]
 *   K. single "Delete File:" header → [path]
 *   L. multiple headers → all paths, in order
 *   M. missing command field → [UNKNOWN_WRITE_TARGET]
 *   N. blank command → [UNKNOWN_WRITE_TARGET]
 *   O. command with no recognizable header → [UNKNOWN_WRITE_TARGET]
 *   P. non-object toolInput → [UNKNOWN_WRITE_TARGET]
 *
 * extractWriteTargets:
 *   Q. apply_patch routes to extractApplyPatchTargets
 *   R. Write with file_path → [path]
 *   S. Write with no file_path → [] (preserves "allow defensively" signal)
 *
 * pickRepresentativeTarget:
 *   T. empty targets → undefined
 *   U. picks first notable target
 *   V. no notable target → falls back to first
 *   W. UNKNOWN_WRITE_TARGET always selected when isNotable treats it as notable
 *
 * isUnknownWriteTarget:
 *   X. sentinel → true
 *   Y. real path → false
 */

import { describe, expect, it } from "vitest";
import {
  canonicalWriteTool,
  extractApplyPatchTargets,
  extractWriteTargets,
  isApplyPatchTool,
  isUnknownWriteTarget,
  pickRepresentativeTarget,
  UNKNOWN_WRITE_TARGET,
} from "../src/behavior-core/tool-classify.js";

describe("canonicalWriteTool", () => {
  it("A. recognizes Write / Edit / MultiEdit", () => {
    expect(canonicalWriteTool("Write")).toBe(true);
    expect(canonicalWriteTool("Edit")).toBe(true);
    expect(canonicalWriteTool("MultiEdit")).toBe(true);
  });

  it("B. recognizes apply_patch", () => {
    expect(canonicalWriteTool("apply_patch")).toBe(true);
  });

  it("C. recognizes applypatch (no underscore)", () => {
    expect(canonicalWriteTool("applypatch")).toBe(true);
  });

  it("D. recognizes APPLY_PATCH (upper-case)", () => {
    expect(canonicalWriteTool("APPLY_PATCH")).toBe(true);
  });

  it("E. recognizes apply-patch (hyphen)", () => {
    expect(canonicalWriteTool("apply-patch")).toBe(true);
  });

  it("F. recognizes str_replace_editor and str_replace_based_edit_tool", () => {
    expect(canonicalWriteTool("str_replace_editor")).toBe(true);
    expect(canonicalWriteTool("str_replace_based_edit_tool")).toBe(true);
  });

  it("G. rejects non-write tools", () => {
    expect(canonicalWriteTool("Bash")).toBe(false);
    expect(canonicalWriteTool("Read")).toBe(false);
    expect(canonicalWriteTool("Glob")).toBe(false);
  });

  it("H. rejects undefined / empty / non-string", () => {
    expect(canonicalWriteTool(undefined)).toBe(false);
    expect(canonicalWriteTool("")).toBe(false);
    expect(canonicalWriteTool(42)).toBe(false);
    expect(canonicalWriteTool(null)).toBe(false);
  });
});

describe("isApplyPatchTool", () => {
  it("recognizes apply_patch case/separator-insensitively", () => {
    expect(isApplyPatchTool("apply_patch")).toBe(true);
    expect(isApplyPatchTool("APPLYPATCH")).toBe(true);
    expect(isApplyPatchTool("apply-patch")).toBe(true);
  });
  it("rejects other write tools", () => {
    expect(isApplyPatchTool("Write")).toBe(false);
    expect(isApplyPatchTool("str_replace_editor")).toBe(false);
  });
});

describe("extractApplyPatchTargets", () => {
  it("I. single Add File header → [path]", () => {
    const command = "*** Begin Patch\n*** Add File: src/x.ts\n+export const x=1\n*** End Patch";
    expect(extractApplyPatchTargets({ command })).toEqual(["src/x.ts"]);
  });

  it("J. single Update File header → [path]", () => {
    const command = "*** Begin Patch\n*** Update File: src/y.ts\n@@\n-old\n+new\n*** End Patch";
    expect(extractApplyPatchTargets({ command })).toEqual(["src/y.ts"]);
  });

  it("K. single Delete File header → [path]", () => {
    const command = "*** Begin Patch\n*** Delete File: src/z.ts\n*** End Patch";
    expect(extractApplyPatchTargets({ command })).toEqual(["src/z.ts"]);
  });

  it("L. multiple headers → all paths in order", () => {
    const command =
      "*** Begin Patch\n" +
      "*** Add File: src/a.ts\n+a\n" +
      "*** Update File: src/b.ts\n@@\n-b\n+b2\n" +
      "*** Delete File: src/c.ts\n" +
      "*** End Patch";
    expect(extractApplyPatchTargets({ command })).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
  });

  it("M. missing command field → [UNKNOWN_WRITE_TARGET]", () => {
    expect(extractApplyPatchTargets({})).toEqual([UNKNOWN_WRITE_TARGET]);
  });

  it("N. blank command → [UNKNOWN_WRITE_TARGET]", () => {
    expect(extractApplyPatchTargets({ command: "   " })).toEqual([UNKNOWN_WRITE_TARGET]);
  });

  it("O. command with no recognizable header → [UNKNOWN_WRITE_TARGET]", () => {
    expect(extractApplyPatchTargets({ command: "not a real patch body" })).toEqual([
      UNKNOWN_WRITE_TARGET,
    ]);
  });

  it("P. non-object toolInput → [UNKNOWN_WRITE_TARGET]", () => {
    expect(extractApplyPatchTargets(null)).toEqual([UNKNOWN_WRITE_TARGET]);
    expect(extractApplyPatchTargets(undefined)).toEqual([UNKNOWN_WRITE_TARGET]);
    expect(extractApplyPatchTargets("string")).toEqual([UNKNOWN_WRITE_TARGET]);
  });

  it("does not leak regex lastIndex state across repeated calls", () => {
    const command = "*** Begin Patch\n*** Add File: src/x.ts\n+x\n*** End Patch";
    expect(extractApplyPatchTargets({ command })).toEqual(["src/x.ts"]);
    expect(extractApplyPatchTargets({ command })).toEqual(["src/x.ts"]);
    expect(extractApplyPatchTargets({ command })).toEqual(["src/x.ts"]);
  });
});

describe("extractWriteTargets", () => {
  it("Q. apply_patch routes to extractApplyPatchTargets", () => {
    const command = "*** Begin Patch\n*** Add File: src/x.ts\n+x\n*** End Patch";
    expect(extractWriteTargets("apply_patch", { command })).toEqual(["src/x.ts"]);
  });

  it("R. Write with file_path → [path]", () => {
    expect(extractWriteTargets("Write", { file_path: "src/x.ts" })).toEqual(["src/x.ts"]);
  });

  it("S. Write with no file_path → [] (preserves allow-defensively signal)", () => {
    expect(extractWriteTargets("Write", { content: "x" })).toEqual([]);
    expect(extractWriteTargets("Write", undefined)).toEqual([]);
  });
});

describe("pickRepresentativeTarget", () => {
  it("T. empty targets → undefined", () => {
    expect(pickRepresentativeTarget([], () => true)).toBeUndefined();
  });

  it("U. picks first notable target", () => {
    const targets = ["docs/a.md", "src/b.ts", "src/c.ts"];
    expect(pickRepresentativeTarget(targets, (t) => t.endsWith(".ts"))).toBe("src/b.ts");
  });

  it("V. no notable target → falls back to first", () => {
    const targets = ["docs/a.md", "docs/b.md"];
    expect(pickRepresentativeTarget(targets, (t) => t.endsWith(".ts"))).toBe("docs/a.md");
  });

  it("W. UNKNOWN_WRITE_TARGET is selected when isNotable treats it as notable", () => {
    const targets = ["docs/a.md", UNKNOWN_WRITE_TARGET, "docs/b.md"];
    const isNotable = (t: string) => isUnknownWriteTarget(t) || t.endsWith(".ts");
    expect(pickRepresentativeTarget(targets, isNotable)).toBe(UNKNOWN_WRITE_TARGET);
  });
});

describe("isUnknownWriteTarget", () => {
  it("X. sentinel → true", () => {
    expect(isUnknownWriteTarget(UNKNOWN_WRITE_TARGET)).toBe(true);
  });
  it("Y. real path → false", () => {
    expect(isUnknownWriteTarget("src/x.ts")).toBe(false);
    expect(isUnknownWriteTarget("")).toBe(false);
  });
});
