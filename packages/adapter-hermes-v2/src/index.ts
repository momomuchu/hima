/**
 * @hima/adapter-hermes-v2
 *
 * Hermes runtime adapter — capability map + hook-binding surface.
 *
 * This package re-exports the Hermes capability map from @hima/storage-core
 * and provides the hook-bindings surface aligned with the Hermes runtime profile.
 *
 * Hermes gaps (from PROPOSITION.md §4):
 *   - stop/on_session_end is non-blocking (degraded)
 *   - No system-prompt hook (runtime gap)
 *   - Magic-words interception is gateway-only (runtime gap)
 *   - Sticky profiles (runtime gap, operational)
 *   - sub-agents skip context files (runtime gap)
 *   - subagent_start: absent
 *   - subagent_stop: degraded (observable, non-blocking)
 */

export {
  HERMES_CAPABILITY_MAP,
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

export { getHermesHookBindings, type HermesHookBinding } from "./hook-bindings.js";
