/**
 * @hima/adapter-claude-v2
 *
 * Claude Code runtime adapter — capability map + hook-binding surface.
 *
 * Claude Code has full coverage of all 9 GateTypes.
 * Three gates are degraded (observable but non-blocking):
 *   - session_start (SessionStart)
 *   - post_tool (PostToolUse)
 *   - post_compact (PostCompact)
 */

export {
  CLAUDE_CAPABILITY_MAP,
  getCapabilityMap,
  getGateCapability,
  getLimitedGates,
  GATE_TYPES,
  type GateType,
  type CapabilityLevel,
  type GateCapability,
  type RuntimeCapabilityMap,
  type RuntimeGap,
} from "@hima/storage-core";

export { getClaudeHookBindings, type ClaudeHookBinding } from "./hook-bindings.js";
