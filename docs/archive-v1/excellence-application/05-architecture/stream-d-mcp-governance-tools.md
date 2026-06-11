---
claim-bearing: true
status: ACCEPTED
cycle-id: cycle-23-stream-d-mcp-governance-tools
owner-stream: Stream D
---

# Stream D - MCP Governance Tools

## 1. Contract landed

Cycle 23 adds the named external HIMA governance tools required by the D-MCP checklist:

| Tool | D-M item | Implementation boundary |
|---|---|---|
| `hima_evaluate_completion` | D-M1 | Reads the current planning project, evaluates evidence sufficiency through `isEvidenceSufficient()`, evaluates convergence through `evaluateConvergence()`, and returns a non-mutating completion verdict. |
| `hima_classify_risk` | D-M2 | Thin compatibility wrapper over the existing `classifyRisk()` changeset classifier used by `rms.classify_risk`. |
| `hima_record_evidence` | D-M3 | Thin compatibility wrapper over the same governed evidence path as `rms.record_evidence`, including root confinement, canonical evidence validation, agent source attribution, and secret redaction before persistence. |
| `hima_query_compliance` | D-M4 | Reads the current project/run compliance surface: risk, phase, evidence sufficiency, finalization, and current-run ledger health. It returns ledger health metadata only, not arbitrary filesystem contents. |

The new names are compatibility surfaces for non-HIMA agents that expect the master-plan HIMA tool
contract. They do not replace the canonical `rms.*` namespace.

## 2. Non-goals

This cycle does not:

- create a second risk classifier, evidence store, convergence evaluator, or compliance ledger;
- add namespace-as-policy-unit enforcement for D-M5 during Cycle 23;
- remove existing `rms.*` tools or `harness:*` compatibility aliases;
- expose arbitrary ledger payloads or filesystem paths through `hima_query_compliance`;
- change hook/gate semantics, hard-limits policy, adapter package behavior, prompt files, or skill
  linting.

## 3. Safety properties

- All HIMA tools that accept `root` go through the existing MCP root confinement helper.
- `hima_record_evidence` persists evidence through `addEvidence()` and cannot append raw
  policy-significant events.
- Evidence summaries are redacted before storage and response.
- `hima_query_compliance` reads only the current run id from `.planning/run-set.json` and summarizes
  the corresponding `.hima/state/ledger/<runId>.jsonl` chain as `exists`, `verified`, `entryCount`,
  `lastSequence`, and `lastEventHash`.
- `docs/conception/11-mcp-tools-spec.md` remains executable-surface synchronized through the MCP
  spec parity test.

## 4. Remaining D-MCP Work

D-M1 through D-M4 are now executable. D-M5 was left open by Cycle 23 and later closed by
Cycle 26 in `docs/excellence-application/05-architecture/stream-d-mcp-namespace-policy.md`:

- namespace-as-policy-unit is implemented as an executable MCP tool namespace policy;
- no five-client external compatibility matrix has been saturated yet;
- non-HIMA client evidence is limited to JSON-RPC protocol tests inside the MCP package.

```yaml
Falsifies-If:
  kill-condition: A named HIMA MCP tool bypasses existing core services, accepts roots outside the MCP server project root, records unredacted secret-bearing evidence summaries, returns arbitrary ledger payloads/filesystem paths, or diverges from the generated MCP `tools/list` contract.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/mcp-server/test/index.test.ts
  on-fail: Reopen cycle-23 as BLOCKED_MCP_TOOL_CONTRACT and restore HIMA tool wrappers to core-backed, root-confined, spec-synchronized behavior.
```
