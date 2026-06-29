/**
 * Tests for behavior-core/beh-security-scope.ts — BEH_SECURITY_SCOPE.
 *
 * Mandated scenarios (per R-008):
 *  A. nmap command with no scope file → block (SECURITY_SCOPE)
 *  B. nmap command with scope file listing matching target → allow
 *  C. Ordinary Bash command (ls, git, npm) → allow (no false positive)
 *  D. Non-Bash tool → allow
 *
 * Additional scenarios:
 *  E. sqlmap detected → block
 *  F. hydra detected → block
 *  G. gobuster detected → block
 *  H. wfuzz detected → block
 *  I. ffuf detected → block
 *  J. masscan detected → block
 *  K. nikto detected → block
 *  L. Scope file present but authorizedTargets is empty → block
 *  M. Scope file present, target listed but NOT in command → block
 *  N. Scope file present, one of several targets matches command → allow
 *  O. toolInput is null / missing command field → allow (cannot inspect)
 *  P. toolInput is a string (malformed) → allow (cannot inspect)
 *  Q. Tool binary appears inside a path (e.g. /usr/bin/nmap-docs) → no match
 *     NOTE: /usr/bin/nmap-docs does NOT have word boundary before nmap-docs,
 *     but `nmap` itself IS whole-word in `/usr/bin/nmap ` → does match.
 *     Verify that `/usr/share/gobuster-docs` with no trailing space does not
 *     false-positive: "gobuster" without word boundary after "-" still matches
 *     because \b is between 'r' and '-'. Test carefully.
 *  R. "nmap" substring embedded in a longer word — nmapcreator → no match
 *  S. Scope file is malformed JSON → treated as absent → block
 *  T. behaviorId and gates are correctly set
 */

import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BEH_SECURITY_SCOPE } from "../src/behavior-core/beh-security-scope.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "beh-sec-scope-test-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

/**
 * Write a security-scope.json file under `root/.hima/`.
 */
async function writeScopeFile(
  root: string,
  content: unknown,
): Promise<void> {
  const dir = path.join(root, ".hima");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "security-scope.json"),
    JSON.stringify(content),
    "utf8",
  );
}

/**
 * Build a minimal BehaviorContext for a Bash pre_tool event.
 */
function makeCtx(
  command: string,
  root?: string,
): BehaviorContext {
  return {
    event: {
      gateType: "pre_tool",
      toolName: "Bash",
      toolInput: { command },
    },
    riskClass: "H",
    root: root ?? tmpRoot,
    ward: null,
  };
}

/**
 * Build a BehaviorContext for a non-Bash tool.
 */
function makeNonBashCtx(toolName: string): BehaviorContext {
  return {
    event: {
      gateType: "pre_tool",
      toolName,
      toolInput: { file_path: "/repo/foo.ts", content: "const x = 1;" },
    },
    riskClass: "H",
    root: tmpRoot,
    ward: null,
  };
}

/** Resolve synchronous or async evaluate() result. */
async function evaluate(ctx: BehaviorContext): Promise<BehaviorVerdict> {
  return BEH_SECURITY_SCOPE.evaluate(ctx);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BEH_SECURITY_SCOPE — security scope enforcement gate", () => {
  // --- Mandated scenarios ---

  it("A. nmap command with no scope file → block (SECURITY_SCOPE)", async () => {
    const result = await evaluate(makeCtx("nmap -sV 192.168.1.1"));
    expect(result.decision).toBe("block");
    expect(result.behaviorId).toBe("BEH-SECURITY-SCOPE");
    expect(result.violationType).toBe("SECURITY_SCOPE");
    expect(result.reason).toMatch(/nmap/);
  });

  it("B. nmap command with scope file listing matching target → allow", async () => {
    await writeScopeFile(tmpRoot, { authorizedTargets: ["192.168.1.1", "10.0.0.0/8"] });
    const result = await evaluate(makeCtx("nmap -sV 192.168.1.1"));
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-SECURITY-SCOPE");
  });

  it("C. Ordinary Bash command (git status) → allow", async () => {
    const result = await evaluate(makeCtx("git status"));
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-SECURITY-SCOPE");
  });

  it("C2. npm install → allow (no false positive)", async () => {
    const result = await evaluate(makeCtx("npm install && npm run build"));
    expect(result.decision).toBe("allow");
  });

  it("C3. ls -la and grep → allow", async () => {
    const result = await evaluate(makeCtx("ls -la && grep -r 'TODO' src/"));
    expect(result.decision).toBe("allow");
  });

  it("D. Non-Bash tool (Write) → allow", async () => {
    const result = await evaluate(makeNonBashCtx("Write"));
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-SECURITY-SCOPE");
  });

  it("D2. Non-Bash tool (Edit) → allow", async () => {
    const result = await evaluate(makeNonBashCtx("Edit"));
    expect(result.decision).toBe("allow");
  });

  // --- Additional offensive tool patterns ---

  it("E. sqlmap detected → block", async () => {
    const result = await evaluate(makeCtx("sqlmap -u http://target.example.com/page?id=1"));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECURITY_SCOPE");
    expect(result.reason).toMatch(/sqlmap/);
  });

  it("F. hydra detected → block", async () => {
    const result = await evaluate(makeCtx("hydra -l admin -P /wordlist.txt ssh://target"));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECURITY_SCOPE");
    expect(result.reason).toMatch(/hydra/);
  });

  it("G. gobuster detected → block", async () => {
    const result = await evaluate(makeCtx("gobuster dir -u http://example.com -w wordlist.txt"));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECURITY_SCOPE");
  });

  it("H. wfuzz detected → block", async () => {
    const result = await evaluate(makeCtx("wfuzz -c -z file,wordlist.txt http://target/FUZZ"));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECURITY_SCOPE");
  });

  it("I. ffuf detected → block", async () => {
    const result = await evaluate(makeCtx("ffuf -u http://target/FUZZ -w wordlist.txt"));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECURITY_SCOPE");
  });

  it("J. masscan detected → block", async () => {
    const result = await evaluate(makeCtx("masscan -p1-65535 192.168.1.0/24 --rate=1000"));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECURITY_SCOPE");
  });

  it("K. nikto detected → block", async () => {
    const result = await evaluate(makeCtx("nikto -h http://target.example.com"));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECURITY_SCOPE");
  });

  // --- Scope file edge cases ---

  it("L. Scope file present but authorizedTargets is empty → block", async () => {
    await writeScopeFile(tmpRoot, { authorizedTargets: [] });
    const result = await evaluate(makeCtx("nmap 10.0.0.1"));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECURITY_SCOPE");
  });

  it("M. Scope file present, listed target NOT in command → block", async () => {
    await writeScopeFile(tmpRoot, { authorizedTargets: ["192.168.99.1"] });
    const result = await evaluate(makeCtx("nmap 10.0.0.1"));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECURITY_SCOPE");
  });

  it("N. Scope file present, one of several targets matches command → allow", async () => {
    await writeScopeFile(tmpRoot, {
      authorizedTargets: ["10.10.10.5", "192.168.1.0/24", "example.com"],
    });
    const result = await evaluate(makeCtx("nmap -sS example.com"));
    expect(result.decision).toBe("allow");
  });

  // --- toolInput edge cases ---

  it("O. toolInput is null → allow (cannot inspect)", async () => {
    const ctx: BehaviorContext = {
      event: { gateType: "pre_tool", toolName: "Bash", toolInput: null },
      riskClass: "H",
      root: tmpRoot,
      ward: null,
    };
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/cannot inspect/i);
  });

  it("O2. toolInput has no command field → allow (cannot inspect)", async () => {
    const ctx: BehaviorContext = {
      event: { gateType: "pre_tool", toolName: "Bash", toolInput: { args: ["nmap"] } },
      riskClass: "H",
      root: tmpRoot,
      ward: null,
    };
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  it("P. toolInput is a string (malformed) → allow (cannot inspect)", async () => {
    const ctx: BehaviorContext = {
      event: { gateType: "pre_tool", toolName: "Bash", toolInput: "nmap 10.0.0.1" },
      riskClass: "H",
      root: tmpRoot,
      ward: null,
    };
    const result = await evaluate(ctx);
    // String is not {command:string}, extractCommand returns null → allow.
    expect(result.decision).toBe("allow");
  });

  // --- Word boundary / false positive guards ---

  it("R. nmapcreator (nmap embedded in longer word) → allow (no match)", async () => {
    const result = await evaluate(makeCtx("node scripts/nmapcreator.js --output report.xml"));
    expect(result.decision).toBe("allow");
  });

  // --- JSON parse errors ---

  it("S. Scope file contains malformed JSON → treated as absent → block", async () => {
    const dir = path.join(tmpRoot, ".hima");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "security-scope.json"), "{ NOT JSON }", "utf8");

    const result = await evaluate(makeCtx("nmap 10.0.0.1"));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("SECURITY_SCOPE");
  });

  // --- Descriptor meta ---

  it("T. behaviorId is BEH-SECURITY-SCOPE and gates is [pre_tool]", () => {
    expect(BEH_SECURITY_SCOPE.id).toBe("BEH-SECURITY-SCOPE");
    expect(BEH_SECURITY_SCOPE.gates).toEqual(["pre_tool"]);
    expect(BEH_SECURITY_SCOPE.gates).not.toContain("stop");
    expect(BEH_SECURITY_SCOPE.gates).not.toContain("user_prompt");
  });
});
