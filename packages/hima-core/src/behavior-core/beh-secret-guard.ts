/**
 * BEH-SECRET-GUARD — Secret content boundary gate (P-13).
 *
 * At PreToolUse, this behavior prevents secrets from being written to disk or
 * pushed via git by scanning for known credential patterns.
 *
 * Two enforcement paths:
 *
 *   (a) Write/Edit tools (Write, Edit, str_replace_editor):
 *       Scan the `content` (Write) or `new_string` (Edit) field of toolInput
 *       for secret patterns. Block if any pattern matches.
 *
 *   (b) Bash tool — git push commands:
 *       Apply the same secret scan to the inline command string. Inline secrets
 *       passed as environment variable assignments or URL credentials are caught.
 *
 *   (c) All other tool calls → allow.
 *
 * Detected patterns:
 *   - sk-[A-Za-z0-9]{16,}           → OpenAI / Anthropic API key
 *   - ghp_[A-Za-z0-9]{20,}          → GitHub personal access token
 *   - AKIA[0-9A-Z]{16}              → AWS IAM access key ID
 *   - -----BEGIN [A-Z ]*PRIVATE KEY----- → PEM private key header
 *
 * Non-pattern text (e.g. the word "secret" in prose) is NOT flagged; only
 * the specific regex patterns above trigger a block.
 *
 * Always-fires CRITICAL invariant — not criticality-gated.
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-009,
 *      BEHAVIOR-CATALOG-v3.md §2 P-13,
 *      CLAUDE.md [ALWAYS][TRUNK-PUSH-BOUNDARY]
 */

import type { BehaviorDescriptor, BehaviorContext, BehaviorVerdict } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEHAVIOR_ID = "BEH-SECRET-GUARD";

// ---------------------------------------------------------------------------
// Secret patterns
// ---------------------------------------------------------------------------

/**
 * Each entry names the credential type for a clear block message.
 * Patterns are intentionally conservative to avoid false positives.
 */
const SECRET_PATTERNS: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> =
  [
    {
      name: "OpenAI/Anthropic API key (sk- prefix)",
      pattern: /sk-[A-Za-z0-9]{16,}/,
    },
    {
      name: "GitHub personal access token (ghp_ prefix)",
      pattern: /ghp_[A-Za-z0-9]{20,}/,
    },
    {
      name: "AWS IAM access key ID (AKIA prefix)",
      pattern: /AKIA[0-9A-Z]{16}/,
    },
    {
      name: "PEM private key",
      pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    },
  ] as const;

// ---------------------------------------------------------------------------
// Tool name classification
// ---------------------------------------------------------------------------

/**
 * Tool names whose toolInput contains file content to scan.
 * Write:              { file_path, content }
 * Edit:               { file_path, old_string, new_string }
 * str_replace_editor: { file_path, old_string, new_string } (Codex variant)
 */
const WRITE_TOOL_NAMES = new Set(["Write", "Edit", "str_replace_editor"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Scan `text` for any known secret pattern.
 * Returns the human-readable credential type name on first match, or null.
 */
function detectSecret(text: string): string | null {
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      return name;
    }
  }
  return null;
}

/**
 * Extract the content strings to scan from a Write/Edit toolInput.
 * Handles both shapes: `{ content }` (Write) and `{ new_string }` (Edit).
 * Returns empty array when toolInput doesn't carry any content field.
 * Defensive: toolInput is typed as `unknown`.
 */
function extractWriteContent(toolInput: unknown): readonly string[] {
  if (typeof toolInput !== "object" || toolInput === null) return [];

  const input = toolInput as Record<string, unknown>;
  const parts: string[] = [];

  // Write tool: content field
  if (typeof input["content"] === "string") {
    parts.push(input["content"]);
  }

  // Edit / str_replace_editor tool: new_string field
  if (typeof input["new_string"] === "string") {
    parts.push(input["new_string"]);
  }

  return parts;
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
// BEH_SECRET_GUARD descriptor
// ---------------------------------------------------------------------------

export const BEH_SECRET_GUARD: BehaviorDescriptor = {
  id: BEHAVIOR_ID,

  // Only fires at the pre_tool gate.
  gates: ["pre_tool"],

  evaluate(ctx: BehaviorContext): BehaviorVerdict {
    const { event } = ctx;
    const { toolName, toolInput } = event;

    // -----------------------------------------------------------------------
    // (a) Write/Edit tools — scan file content.
    // -----------------------------------------------------------------------
    if (toolName !== undefined && WRITE_TOOL_NAMES.has(toolName)) {
      const parts = extractWriteContent(toolInput);

      for (const part of parts) {
        const detected = detectSecret(part);
        if (detected !== null) {
          return {
            decision: "block",
            reason:
              `[${BEHAVIOR_ID}] Detected "${detected}" pattern in ${toolName} content. ` +
              `Credentials must not be written to source files. ` +
              `Store secrets in environment variables or a secrets manager.`,
            behaviorId: BEHAVIOR_ID,
            violationType: "SECRET_DETECTED",
          };
        }
      }

      // Write/Edit tool — content clean.
      return {
        decision: "allow",
        reason: `no secret pattern detected in ${toolName} content`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // -----------------------------------------------------------------------
    // (b) Bash + git push — scan the inline command string.
    // -----------------------------------------------------------------------
    if (toolName === "Bash") {
      const command = extractCommand(toolInput);
      if (command !== null && /\bgit\s+push\b/.test(command)) {
        const detected = detectSecret(command);
        if (detected !== null) {
          return {
            decision: "block",
            reason:
              `[${BEHAVIOR_ID}] Detected "${detected}" pattern in git push command. ` +
              `Do not embed secrets as inline command arguments. ` +
              `Use environment variables or a credential helper instead.`,
            behaviorId: BEHAVIOR_ID,
            violationType: "SECRET_DETECTED",
          };
        }
      }

      // Bash — no inline secret detected (or not a git push).
      return {
        decision: "allow",
        reason: "no secret pattern detected in Bash command",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // -----------------------------------------------------------------------
    // (c) All other tools — out of scope, allow.
    // -----------------------------------------------------------------------
    return {
      decision: "allow",
      reason: "tool is not a write or Bash-push tool — secret scan not applicable",
      behaviorId: BEHAVIOR_ID,
    };
  },
};
