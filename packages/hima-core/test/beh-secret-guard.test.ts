/**
 * Tests for behavior-core/beh-secret-guard.ts — BEH_SECRET_GUARD.
 *
 * Mandated scenarios (per R-009):
 *  A. Write tool with an OpenAI API key in content → block (SECRET_DETECTED)
 *  B. Write tool with clean content → allow
 *  C. Bash git push with an inline GitHub PAT → block (SECRET_DETECTED)
 *  D. Ordinary prose containing the word "secret" → allow (no false positive)
 *
 * Additional scenarios:
 *  E. Edit tool with a secret in new_string → block
 *  F. Edit tool with a secret in old_string only → allow (old_string not scanned)
 *  G. str_replace_editor tool with secret in new_string → block
 *  H. AWS access key ID in Write content → block
 *  I. PEM private key header in Write content → block
 *  J. GitHub PAT in Write content → block
 *  K. Bash git push with clean command → allow
 *  L. Bash command that is not git push (contains API key in var export) → allow
 *     (only git push is inspected for Bash)
 *  M. Non-Bash, non-write tool (Read) → allow
 *  N. toolInput is null for Write tool → allow (no content to scan)
 *  O. toolInput missing content/new_string fields → allow
 *  P. Multiple secret patterns in content → block on first match
 *  Q. sk- prefix with fewer than 16 chars → allow (below threshold, not a key)
 *  R. ghp_ prefix with fewer than 20 chars → allow (below threshold)
 *  S. AKIA prefix with correct length (16 chars uppercase alphanum) → block
 *  T. behaviorId and gates are correctly set
 *  U. Prose text "this is a secret configuration" → allow (no regex match)
 *  V. Empty content string in Write tool → allow
 *  W. Bash git push with no toolInput command field → allow (cannot inspect)
 */

import { describe, it, expect } from "vitest";
import { BEH_SECRET_GUARD } from "../src/behavior-core/beh-secret-guard.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWriteCtx(content: string, toolName = "Write"): BehaviorContext {
  return {
    event: {
      gateType: "pre_tool",
      toolName,
      toolInput: { file_path: "/repo/src/config.ts", content },
    },
    riskClass: "H",
    root: "/tmp/fake-root",
    ward: null,
  };
}

function makeEditCtx(newString: string, oldString = "const x = 1;"): BehaviorContext {
  return {
    event: {
      gateType: "pre_tool",
      toolName: "Edit",
      toolInput: {
        file_path: "/repo/src/config.ts",
        old_string: oldString,
        new_string: newString,
      },
    },
    riskClass: "H",
    root: "/tmp/fake-root",
    ward: null,
  };
}

function makeBashCtx(command: string): BehaviorContext {
  return {
    event: {
      gateType: "pre_tool",
      toolName: "Bash",
      toolInput: { command },
    },
    riskClass: "H",
    root: "/tmp/fake-root",
    ward: null,
  };
}

function makeOtherToolCtx(toolName: string): BehaviorContext {
  return {
    event: {
      gateType: "pre_tool",
      toolName,
      toolInput: {},
    },
    riskClass: "H",
    root: "/tmp/fake-root",
    ward: null,
  };
}

async function evaluate(ctx: BehaviorContext): Promise<BehaviorVerdict> {
  return BEH_SECRET_GUARD.evaluate(ctx);
}

// ---------------------------------------------------------------------------
// Known credential fixtures
// ---------------------------------------------------------------------------

// OpenAI-style API key (≥16 alnum after sk-)
const OPENAI_KEY = "sk-AbCdEfGhIjKlMnOpQrSt";
// GitHub personal access token (≥20 alnum after ghp_)
const GITHUB_PAT = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
// AWS access key ID (exactly 16 uppercase alnum after AKIA)
const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
// PEM private key header
const PEM_HEADER = "-----BEGIN RSA PRIVATE KEY-----";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BEH_SECRET_GUARD — secret content boundary gate", () => {
  // --- Mandated scenarios ---

  it("A. Write tool with OpenAI API key in content → block (SECRET_DETECTED)", async () => {
    const result = await evaluate(makeWriteCtx(`const apiKey = "${OPENAI_KEY}";`));
    expect(result.decision).toBe("block");
    expect(result.behaviorId).toBe("BEH-SECRET-GUARD");
    expect(result.violationType).toBe("SECRET_DETECTED");
    expect(result.reason).toMatch(/OpenAI/i);
  });

  it("B. Write tool with clean content → allow", async () => {
    const result = await evaluate(makeWriteCtx("const greeting = 'hello world';"));
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-SECRET-GUARD");
    expect(result.violationType).toBeUndefined();
  });

  it("C. Bash git push with inline GitHub PAT → block (SECRET_DETECTED)", async () => {
    const result = await evaluate(
      makeBashCtx(`git push https://${GITHUB_PAT}@github.com/org/repo.git`),
    );
    expect(result.decision).toBe("block");
    expect(result.behaviorId).toBe("BEH-SECRET-GUARD");
    expect(result.violationType).toBe("SECRET_DETECTED");
    expect(result.reason).toMatch(/GitHub/i);
  });

  it("D. Prose containing the word 'secret' → allow (no false positive)", async () => {
    const result = await evaluate(
      makeWriteCtx(
        "This is a secret configuration file. Keep the secrets safe. " +
          "Secrets management is important.",
      ),
    );
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-SECRET-GUARD");
  });

  // --- Edit tool ---

  it("E. Edit tool with secret in new_string → block", async () => {
    const result = await evaluate(makeEditCtx(`const token = "${GITHUB_PAT}";`));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECRET_DETECTED");
  });

  it("F. Edit tool with secret in old_string only → allow (old_string not scanned)", async () => {
    // old_string is what we're removing — the harmful content is leaving, not arriving.
    const result = await evaluate(makeEditCtx("const token = 'cleaned';", `"${OPENAI_KEY}"`));
    expect(result.decision).toBe("allow");
  });

  it("G. str_replace_editor tool with secret in new_string → block", async () => {
    const ctx: BehaviorContext = {
      event: {
        gateType: "pre_tool",
        toolName: "str_replace_editor",
        toolInput: {
          file_path: "/repo/config.ts",
          old_string: "const key = '';",
          new_string: `const key = "${OPENAI_KEY}";`,
        },
      },
      riskClass: "H",
      root: "/tmp/fake-root",
      ward: null,
    };
    const result = await evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECRET_DETECTED");
  });

  // --- Pattern coverage ---

  it("H. AWS access key ID in Write content → block", async () => {
    const result = await evaluate(
      makeWriteCtx(`const awsKey = process.env["AWS_KEY"] ?? "${AWS_KEY}";`),
    );
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECRET_DETECTED");
    expect(result.reason).toMatch(/AWS/i);
  });

  it("I. PEM private key header in Write content → block", async () => {
    const result = await evaluate(
      makeWriteCtx(`${PEM_HEADER}\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----`),
    );
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECRET_DETECTED");
    expect(result.reason).toMatch(/PEM/i);
  });

  it("J. GitHub PAT in Write content → block", async () => {
    const result = await evaluate(makeWriteCtx(`const token = "${GITHUB_PAT}";`));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECRET_DETECTED");
    expect(result.reason).toMatch(/GitHub/i);
  });

  // --- Bash tool cases ---

  it("K. Bash git push with clean command → allow", async () => {
    const result = await evaluate(makeBashCtx("git push origin main"));
    expect(result.decision).toBe("allow");
  });

  it("L. Bash command (not git push) that exports an API key env var → allow", async () => {
    // Only git push is inspected for Bash; env var exports are not scanned.
    const result = await evaluate(
      makeBashCtx(`export OPENAI_API_KEY="${OPENAI_KEY}" && npm run dev`),
    );
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no secret/i);
  });

  // --- Other tools ---

  it("M. Non-Bash, non-write tool (Read) → allow", async () => {
    const result = await evaluate(makeOtherToolCtx("Read"));
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/not a write/i);
  });

  it("M2. Non-Bash, non-write tool (Glob) → allow", async () => {
    const result = await evaluate(makeOtherToolCtx("Glob"));
    expect(result.decision).toBe("allow");
  });

  // --- toolInput edge cases ---

  it("N. toolInput is null for Write tool → allow (no content to scan)", async () => {
    const ctx: BehaviorContext = {
      event: { gateType: "pre_tool", toolName: "Write", toolInput: null },
      riskClass: "H",
      root: "/tmp/fake-root",
      ward: null,
    };
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no secret/i);
  });

  it("O. toolInput missing content/new_string fields → allow", async () => {
    const ctx: BehaviorContext = {
      event: {
        gateType: "pre_tool",
        toolName: "Write",
        toolInput: { file_path: "/repo/foo.ts" },
      },
      riskClass: "H",
      root: "/tmp/fake-root",
      ward: null,
    };
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  // --- Pattern threshold guards ---

  it("Q. sk- prefix with fewer than 16 chars → allow (below key length threshold)", async () => {
    const result = await evaluate(makeWriteCtx('const shortKey = "sk-shortkey";'));
    expect(result.decision).toBe("allow");
  });

  it("R. ghp_ prefix with fewer than 20 chars → allow (below PAT length threshold)", async () => {
    const result = await evaluate(makeWriteCtx('const tok = "ghp_short";'));
    expect(result.decision).toBe("allow");
  });

  it("S. AKIA prefix with exactly 16 uppercase alphanumeric chars → block", async () => {
    // AKIA + 16 chars = 20 total. AWS key format: AKIA[A-Z0-9]{16}
    const result = await evaluate(makeWriteCtx(`accessKeyId = "${AWS_KEY}"`));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECRET_DETECTED");
  });

  // --- Multiple secrets ---

  it("P. Multiple secret patterns in content → block on first match", async () => {
    const result = await evaluate(
      makeWriteCtx(
        `const a = "${OPENAI_KEY}";\nconst b = "${GITHUB_PAT}";\nconst c = "${AWS_KEY}";`,
      ),
    );
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECRET_DETECTED");
  });

  // --- Empty content ---

  it("V. Empty content string in Write tool → allow", async () => {
    const result = await evaluate(makeWriteCtx(""));
    expect(result.decision).toBe("allow");
  });

  // --- Bash + git push toolInput edge case ---

  it("W. Bash git push with no toolInput command field → allow (cannot inspect)", async () => {
    const ctx: BehaviorContext = {
      event: {
        gateType: "pre_tool",
        toolName: "Bash",
        toolInput: { args: ["git", "push", `https://${GITHUB_PAT}@github.com/org/repo`] },
      },
      riskClass: "H",
      root: "/tmp/fake-root",
      ward: null,
    };
    const result = await evaluate(ctx);
    // No 'command' string field → extractCommand returns null → allow.
    expect(result.decision).toBe("allow");
  });

  // --- False positive guards ---

  it("U. Prose 'this is a secret configuration' → allow (no regex match)", async () => {
    const result = await evaluate(
      makeWriteCtx(
        "// This module handles secret configuration.\n" +
          "// Never log secrets to the console.\n" +
          "export function getConfig() { return {}; }",
      ),
    );
    expect(result.decision).toBe("allow");
  });

  // --- Descriptor meta ---

  it("T. behaviorId is BEH-SECRET-GUARD and gates is [pre_tool]", () => {
    expect(BEH_SECRET_GUARD.id).toBe("BEH-SECRET-GUARD");
    expect(BEH_SECRET_GUARD.gates).toEqual(["pre_tool"]);
    expect(BEH_SECRET_GUARD.gates).not.toContain("stop");
    expect(BEH_SECRET_GUARD.gates).not.toContain("user_prompt");
  });
});
