# 0003 - Pre-Action Target Expansion Spec

Status: draft v1

## Purpose

`pre_tool` can block governed writes only when the adapter can identify the
target before side effects occur. Territory policy already blocks unknown
targets, but runtime adapters still need a concrete target-expansion contract.

## Principle

```text
Unknown target + governed write = block.
```

Intent prose is not enough. The adapter must produce target facts from the tool
payload, command parser, manifest, or a declared native-equivalent pre-action
probe.

## Target Request

```yaml
target_expansion_request:
  runtime: "codex"
  canonical_gate: "pre_tool"
  tool_name: "Bash|apply_patch|Edit|Write|mcp__server__tool|terminal|patch"
  tool_input: {}
  cwd: "absolute path"
  route_id: "route.run-123"
  risk_class: "M"
  operation_intent: "write|read|delete|move|network|unknown"
```

## Target Expansion Output

```yaml
target_expansion:
  status: "resolved|partial|unknown|not_applicable|failed"
  operation_class: "read|write|delete|move|execute|network|unknown"
  targets:
    - path: "docs/propositions/example.md"
      target_type: "file|directory|glob|mcp_resource|external|unknown"
      action: "read|write|delete|move|execute|unknown"
      confidence: "exact|expanded|inferred|unknown"
  unresolved_segments:
    - "shell_glob"
  limitations:
    - "script_body_not_inspected"
  evidence_ref: "ev_target_expansion_001"
```

## Tool Families

| Tool family | Required expansion behavior |
|---|---|
| Structured edit/write tools | Extract explicit file path before action. |
| `apply_patch` | Parse patch headers and derive add/update/delete paths. |
| Shell command | Parse known commands, globs and redirections; block governed writes when unresolved. |
| MCP tools | Use tool schema and argument mapping; unknown mutation target blocks governed writes. |
| Web/search/read-only tools | Mark as read/external unless output is used for write mutation. |
| Delegation/subagents | Require declared allowed scope and parent intake; cannot grant new write territory silently. |

## Shell Command Policy

Shell commands are the highest-risk expansion surface.

Allowed as resolved:

- explicit file path in known safe command form;
- explicit redirection target;
- explicit copy/move/delete target when all paths are concrete;
- glob expanded against current filesystem before action and within owned
  territory.

Blocked as unknown for governed writes:

- command invokes script whose write behavior is not inspected;
- command uses dynamic variables that cannot be resolved;
- command pipes into tools that may write unknown paths;
- command contains broad delete/move patterns;
- command writes through language package scripts with unknown side effects.

## Composition With Binding Set

`pre_tool` may have `can_block=true` and still fail target expansion. In that
case the guard result is `block`, not `allow`.

```text
binding can block action
+ target expansion unknown
= governed write blocked
```

For T/F read-only work, unknown target may degrade to `warn` if Policy Set says
the gate is advisory. For M/E/C governed writes, unknown target blocks.

## Acceptance Criteria

1. MUST classify each pre-tool action as read, write, delete, move, execute,
   network, or unknown.
2. MUST block M/E/C governed writes when target expansion is `unknown`,
   `partial`, or `failed`, unless a native-equivalent fallback produces exact
   pre-action targets.
3. MUST parse `apply_patch` path headers before applying territory policy.
4. MUST expand shell globs before side effects or block governed writes.
5. MUST not infer shell write safety from user intent text.
6. MUST record target expansion evidence for every governed write decision.
7. SHOULD expose parser limitations in the Binding Set or Capability Set so
   final-state ceilings can be computed.
