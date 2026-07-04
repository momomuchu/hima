/**
 * stdin — read and parse the Claude hook JSON payload from stdin.
 *
 * Claude injects a JSON object on stdin for each hook event. We tolerate:
 *   - Empty stdin (no piped input)
 *   - Invalid / non-JSON stdin
 *   - Partial or missing fields (all optional per contract)
 *
 * The parsed result is typed as a loose subset — callers access only the
 * fields they need and must treat all of them as optional.
 */

export type StdinPayload = {
  toolName?: string;
  toolInput?: unknown;
  promptContent?: string;
  /** Claude session_id from the hook payload (snake_case in real payloads). */
  sessionId?: string;
  /** Claude hook_event_name from the hook payload (e.g. "PreToolUse"). */
  hookEventName?: string;
  /**
   * Claude transcript_path — path to the conversation .jsonl. On the Stop hook
   * the agent's final message is NOT in the payload; it lives as the last
   * assistant message in this transcript. handleStop reads it to feed BEH-023.
   */
  transcriptPath?: string;
  /**
   * Codex Stop hook: the agent's final message is delivered directly as
   * `last_assistant_message` (Claude requires reading the transcript instead).
   */
  lastAssistantMessage?: string;
  /**
   * `stop_hook_active` — set true by the runtime after a stop-hook-triggered
   * continuation, so a re-blocking hook does not loop forever. handleStop allows
   * on the second pass to avoid bricking a session.
   */
  stopHookActive?: boolean;
};

/**
 * readStdinPayload — drain stdin and parse as JSON.
 *
 * Returns an empty object on ENOENT, empty input, or parse failure.
 * Never throws.
 */
export async function readStdinPayload(): Promise<StdinPayload> {
  try {
    // Check if stdin is a TTY (interactive terminal with no piped input).
    // In that case reading would block; skip it and return {}.
    if (process.stdin.isTTY) {
      return {};
    }

    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }

    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (raw.length === 0) return {};

    return normalizePayload(JSON.parse(raw));
  } catch {
    // JSON.parse failure or stream error → treat as empty payload
    return {};
  }
}

/**
 * normalizePayload — map a parsed JSON value to the loose StdinPayload subset.
 *
 * Claude Code sends snake_case fields (`tool_name`, `tool_input`, `prompt`,
 * `session_id`, `hook_event_name`); we read those first and fall back to
 * camelCase (`toolName`, `toolInput`, `promptContent`, `sessionId`,
 * `hookEventName`) for direct/test callers.
 * Non-object input yields an empty payload. Pure + synchronous → unit-testable.
 */
export function normalizePayload(parsed: unknown): StdinPayload {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const obj = parsed as Record<string, unknown>;
  const str = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

  return {
    toolName: str(obj["tool_name"]) ?? str(obj["toolName"]),
    toolInput: obj["tool_input"] ?? obj["toolInput"],
    promptContent: str(obj["prompt"]) ?? str(obj["promptContent"]),
    sessionId: str(obj["session_id"]) ?? str(obj["sessionId"]),
    hookEventName: str(obj["hook_event_name"]) ?? str(obj["hookEventName"]),
    transcriptPath: str(obj["transcript_path"]) ?? str(obj["transcriptPath"]),
    lastAssistantMessage:
      str(obj["last_assistant_message"]) ?? str(obj["lastAssistantMessage"]),
    stopHookActive:
      obj["stop_hook_active"] === true || obj["stopHookActive"] === true,
  };
}
