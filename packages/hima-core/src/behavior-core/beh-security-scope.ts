/**
 * BEH-SECURITY-SCOPE — Security scope enforcement gate (L-01).
 *
 * At PreToolUse Bash events: inspect the command string for offensive security
 * tool binaries (nmap, sqlmap, hydra, gobuster, wfuzz, ffuf, masscan, nikto).
 * If a tool is detected AND no authorized-scope file at
 * `.hima/security-scope.json` lists a matching target present in the command,
 * the behavior blocks with violationType "SECURITY_SCOPE".
 *
 * Scope file shape (populated via `norm setup --security-scope`):
 *   { "authorizedTargets": ["192.168.1.0/24", "example.com", "localhost"] }
 *
 * Resolution logic:
 *   - File absent or unreadable → block (no declared scope).
 *   - File present, authorizedTargets empty → block (empty scope = no auth).
 *   - File present, ≥1 target appears verbatim in the command → allow.
 *   - File present, no target appears in the command → block.
 *
 * Always-fires CRITICAL invariant — not criticality-gated.
 * Non-Bash tool calls are always allowed by this behavior.
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-008,
 *      BEHAVIOR-CATALOG-v3.md §6 L-01,
 *      CLAUDE.md [SECURITY-WORK-AUTHORIZED]
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BehaviorDescriptor, BehaviorContext, BehaviorVerdict } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEHAVIOR_ID = "BEH-SECURITY-SCOPE";

/**
 * Offensive security tool pattern. Whole-word anchors prevent false positives
 * on arguments or path segments that contain the tool name as a substring
 * (e.g. "/usr/share/ffuf-docs" must NOT match).
 */
const OFFENSIVE_TOOL_PATTERN =
  /\b(nmap|sqlmap|hydra|gobuster|wfuzz|ffuf|masscan|nikto)\b/;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type SecurityScopeFile = {
  authorizedTargets: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read and parse `.hima/security-scope.json` from `root`.
 * Returns null on any I/O or parse error — callers treat null as "no scope".
 */
async function readScopeFile(root: string): Promise<SecurityScopeFile | null> {
  const scopePath = join(root, ".hima", "security-scope.json");
  try {
    const raw = await readFile(scopePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "authorizedTargets" in parsed &&
      Array.isArray((parsed as Record<string, unknown>)["authorizedTargets"])
    ) {
      const authorizedTargets = (
        (parsed as Record<string, unknown>)["authorizedTargets"] as unknown[]
      ).filter((t): t is string => typeof t === "string");
      return { authorizedTargets };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely extract the command string from a Bash toolInput.
 * Returns null when the shape does not match `{ command: string }`.
 */
function extractCommand(toolInput: unknown): string | null {
  if (typeof toolInput !== "object" || toolInput === null) return null;
  const input = toolInput as Record<string, unknown>;
  const cmd = input["command"];
  return typeof cmd === "string" ? cmd : null;
}

// ---------------------------------------------------------------------------
// BEH_SECURITY_SCOPE descriptor
// ---------------------------------------------------------------------------

export const BEH_SECURITY_SCOPE: BehaviorDescriptor = {
  id: BEHAVIOR_ID,

  // Only fires at the pre_tool gate.
  gates: ["pre_tool"],

  async evaluate(ctx: BehaviorContext): Promise<BehaviorVerdict> {
    const { event, root } = ctx;

    // Only inspect Bash tool calls; all others are irrelevant.
    if (event.toolName !== "Bash") {
      return {
        decision: "allow",
        reason: "not a Bash tool call — security scope check skipped",
        behaviorId: BEHAVIOR_ID,
      };
    }

    const command = extractCommand(event.toolInput);
    if (command === null) {
      // toolInput doesn't carry a command string — cannot inspect, allow.
      return {
        decision: "allow",
        reason: "toolInput is not {command:string} — cannot inspect Bash command",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // Check for offensive tool binary in the command.
    const match = OFFENSIVE_TOOL_PATTERN.exec(command);
    if (match === null) {
      return {
        decision: "allow",
        reason: "no offensive security tool detected in Bash command",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // Use nullish coalescing to handle noUncheckedIndexedAccess.
    const detectedTool = match[1] ?? match[0] ?? "unknown";

    // Offensive tool detected — look for an authorized scope.
    const scope = await readScopeFile(root);

    if (scope !== null && scope.authorizedTargets.length > 0) {
      const authorized = scope.authorizedTargets.some((target) =>
        command.includes(target),
      );
      if (authorized) {
        return {
          decision: "allow",
          reason:
            `[${BEHAVIOR_ID}] Offensive tool "${detectedTool}" authorized: ` +
            `matching target found in .hima/security-scope.json.`,
          behaviorId: BEHAVIOR_ID,
        };
      }
    }

    // No authorized scope file, empty scope, or no target match → block.
    const scopeHint =
      scope === null
        ? "No .hima/security-scope.json file found."
        : scope.authorizedTargets.length === 0
          ? ".hima/security-scope.json exists but authorizedTargets is empty."
          : "No authorized target from .hima/security-scope.json matches the command.";

    return {
      decision: "block",
      reason:
        `[${BEHAVIOR_ID}] Bash command uses offensive security tool ` +
        `"${detectedTool}" outside an authorized engagement scope. ${scopeHint} ` +
        `Run \`norm setup --security-scope\` to declare authorized targets before ` +
        `using offensive tooling.`,
      behaviorId: BEHAVIOR_ID,
      violationType: "SECURITY_SCOPE",
    };
  },
};
