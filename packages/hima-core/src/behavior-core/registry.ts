/**
 * behavior-core/registry.ts — simple BehaviorDescriptor registry.
 *
 * Provides a mutable registry that maps gate types to the descriptors that
 * cover them. The default export (`defaultRegistry`) is pre-seeded with all
 * behaviors shipped in this iteration (currently BEH-023).
 *
 * Consumers that need the full behavior set for a gate call:
 *
 *   import { defaultRegistry } from "./registry.js";
 *   const behaviors = defaultRegistry.getBehaviorsForGate("stop");
 *
 * Tests or custom routing logic can construct a fresh Registry instance
 * and register only the behaviors they need.
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-001,
 *      ARCHITECTURE-v3.md §3.4.
 */

import type { GateType } from "@hima/schemas";
import type { BehaviorDescriptor } from "./types.js";
import { BEH_023 } from "./beh-023-completion.js";
import { BEH_READ_BEFORE_WRITE } from "./beh-read-before-write.js";
import { BEH_FALSIFIES_IF } from "./beh-falsifies-if.js";
import { BEH_SECURITY_SCOPE } from "./beh-security-scope.js";
import { BEH_SECRET_GUARD } from "./beh-secret-guard.js";
import { BEH_RESEARCH_FIRST } from "./beh-research-first.js";
import { BEH_SPEC_GATE } from "./beh-spec-gate.js";
import { BEH_PLANNER_WRITE_GUARD } from "./beh-planner-write-guard.js";
import { BEH_DELEGATION_FIRST } from "./beh-delegation-first.js";
import { BEH_WORKER_MODEL } from "./beh-worker-model.js";
// I14b behaviors (R-016, R-022, R-023)
import { BEH_FEEDBACK_WAVE } from "./beh-feedback-wave.js";
import { BEH_ANTI_SYCOPHANCY } from "./beh-anti-sycophancy.js";
import { BEH_ADR_BEFORE_IMPL } from "./beh-adr-before-impl.js";

// ---------------------------------------------------------------------------
// Registry class
// ---------------------------------------------------------------------------

/**
 * Registry — holds the registered BehaviorDescriptors and provides indexed
 * lookup by GateType. Descriptors that cover multiple gate types are stored
 * under each gate they declare.
 */
export class Registry {
  /** Internal map: gateType → ordered list of descriptors for that gate. */
  private readonly _map: Map<GateType, BehaviorDescriptor[]> = new Map();

  /**
   * Register a BehaviorDescriptor. The descriptor is inserted under every
   * GateType listed in its `gates` array. Registering the same descriptor id
   * twice for the same gate is a no-op (idempotent, avoids duplicate checks).
   */
  registerBehavior(descriptor: BehaviorDescriptor): void {
    for (const gate of descriptor.gates) {
      const existing = this._map.get(gate) ?? [];
      // Idempotency: skip if the same id is already registered for this gate.
      if (existing.some((d) => d.id === descriptor.id)) {
        continue;
      }
      existing.push(descriptor);
      this._map.set(gate, existing);
    }
  }

  /**
   * Return all BehaviorDescriptors registered for a given GateType, in
   * registration order. Returns an empty array when no descriptors cover
   * the requested gate.
   */
  getBehaviorsForGate(gateType: GateType): BehaviorDescriptor[] {
    return this._map.get(gateType) ?? [];
  }
}

// ---------------------------------------------------------------------------
// Convenience module-level wrappers (delegate to defaultRegistry)
// ---------------------------------------------------------------------------

/**
 * The process-global default registry. Pre-seeded with behaviors shipped in
 * this iteration. Import and use directly; do NOT re-export as the canonical
 * mutable singleton across multiple test files (construct fresh Registry
 * instances in tests instead).
 */
export const defaultRegistry = new Registry();

// Seed with iteration-I8 behaviors.
defaultRegistry.registerBehavior(BEH_023);

// Seed with iteration-I9 safety invariants (always-on CRITICAL guards).
// R-003: read-before-write at M+ floor (pre_tool).
defaultRegistry.registerBehavior(BEH_READ_BEFORE_WRITE);
// R-004: Falsifies-If gate on claim-bearing files (pre_tool, all floors).
defaultRegistry.registerBehavior(BEH_FALSIFIES_IF);
// R-008: security scope enforcement for offensive Bash tools (pre_tool, all floors).
defaultRegistry.registerBehavior(BEH_SECURITY_SCOPE);
// R-009: secret content boundary guard on Write/Edit + git push (pre_tool, all floors).
defaultRegistry.registerBehavior(BEH_SECRET_GUARD);
// R-007: research-first gate — discovery must be sealed before spec-class writes (pre_tool).
defaultRegistry.registerBehavior(BEH_RESEARCH_FIRST);

// R-024 / I13: spec-gate advisory at M+ user_prompt (warns before code without spec reference).
defaultRegistry.registerBehavior(BEH_SPEC_GATE);

// R-020 part 2 / I14: planner-write-guard — blocks code writes in planner stages (pre_tool).
defaultRegistry.registerBehavior(BEH_PLANNER_WRITE_GUARD);

// SPEC-018 / V-012a: Delegation-First — blocks solo main-thread implementation writes at
// work-bearing (executor) stages on High+ tasks unless a delegated lane is active (pre_tool).
defaultRegistry.registerBehavior(BEH_DELEGATION_FIRST);

// R-028 / I10b: worker-model-explicit — blocks subagent spawn without explicit model.
// Fires at subagent_start gate on claude (canBlock=true). Hermes compensates via
// handlePreToolUse delegate_task intercept (R-038).
defaultRegistry.registerBehavior(BEH_WORKER_MODEL);

// R-016 / I14b: feedback-wave-detect advisory at user_prompt (H+).
defaultRegistry.registerBehavior(BEH_FEEDBACK_WAVE);

// R-022 / I14b: anti-sycophancy advisory at post_tool (M+).
defaultRegistry.registerBehavior(BEH_ANTI_SYCOPHANCY);

// R-023 / I14b: ADR-before-impl advisory at pre_tool (M+).
defaultRegistry.registerBehavior(BEH_ADR_BEFORE_IMPL);

/**
 * Module-level convenience: register a descriptor in the default registry.
 */
export function registerBehavior(descriptor: BehaviorDescriptor): void {
  defaultRegistry.registerBehavior(descriptor);
}

/**
 * Module-level convenience: retrieve behaviors for a gate from the default
 * registry.
 */
export function getBehaviorsForGate(gateType: GateType): BehaviorDescriptor[] {
  return defaultRegistry.getBehaviorsForGate(gateType);
}
