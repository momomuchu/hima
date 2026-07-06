/**
 * norm-opencode-plugin.mjs — the actual @opencode-ai/plugin factory OpenCode
 * loads. This is the file install.mjs copies into `.opencode/plugins/`.
 *
 * DELIBERATELY MINIMAL — exports EXACTLY ONE function value (as a named
 * export AND as `export default`, both the same reference). All real logic
 * lives in the sibling core.mjs. See core.mjs's header for WHY this split is
 * load-bearing: OpenCode's plugin loader iterates every export in this file
 * and throws (discarding the WHOLE plugin) if any of them isn't a function —
 * a previous version that also exported plain-object helper constants (for
 * unit-testability) failed to load for exactly that reason, live-verified via
 * opencode's own log (`error="Plugin export is not a function"`).
 *
 * Do not add any other top-level export to this file. Add new logic to
 * core.mjs and import it here instead.
 */

import {
  NormBlockError,
  runToolExecuteBefore,
  runSessionEvent,
  createRealSpawnNorm,
} from "./core.mjs";

/**
 * NormOpenCodePlugin — named export per opencode.ai/docs/plugins convention:
 * `export const X = async (ctx) => ({...})`. Root resolution uses
 * `pluginInput.directory` (the real invoking project directory) — NOT
 * `pluginInput.worktree`, which was observed to be "/" in a plain
 * (non-git-worktree) `opencode run` (see core.mjs header for the live-probe
 * detail).
 */
export const NormOpenCodePlugin = async (pluginInput) => {
  const root = pluginInput?.directory || pluginInput?.worktree || process.cwd();
  const spawnNorm = createRealSpawnNorm();

  return {
    "tool.execute.before": async (input, output) => {
      try {
        await runToolExecuteBefore({ input, output, root, spawnNorm });
      } catch (err) {
        if (err instanceof NormBlockError) throw err;
        // Any other failure (a bug in this bridge, an unexpected input shape)
        // fails open — governance must never crash the host tool call.
      }
    },

    event: async ({ event }) => {
      await runSessionEvent({ event, root, spawnNorm }).catch(() => {
        // Advisory only — never break the session on a tracing failure.
      });
    },
  };
};

export default NormOpenCodePlugin;
