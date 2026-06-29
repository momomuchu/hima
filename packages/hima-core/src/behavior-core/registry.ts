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
