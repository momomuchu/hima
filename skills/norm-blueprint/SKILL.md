---
name: norm-blueprint
description: Produce the structural plan — component boundaries, contracts, data flow — plus a lightweight decision record, from a sealed charter.
stage: design
source: base
mode: force
---

## Purpose

Cover the cycle's **design** stage: turn a sealed charter into a structural plan — component
boundaries, contracts, data flow — before implementation starts. Every material decision gets a
lightweight decision record with rejected alternatives, so `norm-forge` never has to guess.
Force at M+ criticality; advisory at L (skip only with an explicit, reversible-default note).

## When to use

- A charter exists and is sealed, and the shape of the solution (not just its acceptance
  criteria) still needs deciding.
- The change touches ≥2 files, a schema/data-model shape, a public interface, or an
  architecture/library choice — i.e. any decision expensive to reverse after `norm-forge` starts.
- At L criticality, this stage may be skipped, but the skip itself must be logged.

## Steps

- Require a sealed charter as input — refuse to blueprint against an unsealed or missing charter.
- Define component/module boundaries and the contracts (types, interfaces) between them.
- Trace data flow end-to-end for every scenario in the charter.
- For each material decision, record: decision, rationale, at least one rejected alternative,
  and a criticality tag.
- Flag any decision that would require ≥2-file, schema, or public-interface changes to reverse —
  those need a decision record even at lower criticality.

## Done when

- Component boundaries and contracts are explicit enough that `norm-forge` needs no further
  design judgment calls.
- Every material decision has a decision record with a rejected alternative.
- The blueprint references its source charter and is readable by `norm-forge` and `norm-verdict`.
