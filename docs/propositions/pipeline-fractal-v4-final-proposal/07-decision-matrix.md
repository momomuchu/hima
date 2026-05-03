# 07 - Decision Matrix

Status: Cycle 01 choice aid

## Options

| Option | Short name | Core idea |
|---|---|---|
| A | MCP-centric | The MCP server is the RMS authority and owns most state/control. |
| B | Runtime-native | Skills, hooks and local files are primary; MCP is optional. |
| C | Hybrid kernel | Local event-sourced kernel owns truth; MCP, hooks, skills and subagents are clients. |

## Score

Scale: 1 weak, 5 strong.

| Criterion | A MCP-centric | B Runtime-native | C Hybrid kernel |
|---|---:|---:|---:|
| Single state authority | 5 | 2 | 5 |
| Cross-runtime portability | 5 | 3 | 5 |
| Offline/local resilience | 2 | 5 | 4 |
| Guard enforceability | 4 | 3 | 5 |
| Runtime degradation clarity | 4 | 2 | 5 |
| Skills boundary clarity | 4 | 2 | 5 |
| Subagent evidence boundary | 4 | 3 | 5 |
| Books authority boundary | 3 | 3 | 5 |
| Implementation MVP complexity | 3 | 4 | 3 |
| Long-term maintainability | 3 | 2 | 5 |
| Edge-case fail-closed behavior | 4 | 2 | 5 |
| Fit with V2 state-machine model | 4 | 3 | 5 |

## Total

| Option | Score | Interpretation |
|---|---:|---|
| A MCP-centric | 45 / 60 | Strong interface, but too dependent on MCP availability if the server is the whole kernel. |
| B Runtime-native | 34 / 60 | Fast UX/MVP path, but high drift risk and weak authority boundaries. |
| C Hybrid kernel | 57 / 60 | Best convergence: one authority, portable MCP, native adapters, bounded skills/subagents/books. |

## Argument Against Each Option

### Against A

MCP is portable, but it is not enough by itself. If MCP availability becomes the
same thing as RMS availability, then an MCP outage can block even local
low-risk work or tempt agents into unsafe bypass. A also risks making the MCP
server a monolith that owns docs, procedures and execution.

### Against B

B is attractive because it matches how operators use coding agents: invoke a
skill, let hooks enforce, spawn workers. But it recreates the core problem:
each runtime has slightly different hooks, permissions, subagents and config. If
state is distributed across skills/hooks/files, the RMS will drift.

### Against C

C requires more design discipline. The kernel must be real, event-sourced and
validated; adapters must not write around it; the MCP server must not become an
independent truth. The cost is acceptable because it buys the cleanest authority
boundary.

## What To Choose

Choose C as the final architecture direction.

Use A's strongest idea:

```text
MCP is the portable interface.
```

Use B's strongest idea:

```text
Skills and hooks are the practical user/runtime interface.
```

Reject A's weak point:

```text
MCP server should not be the only possible local access path to state.
```

Reject B's weak point:

```text
Skills/hooks/files must not become independent authorities.
```

## Decision Record Draft

```text
Decision: Pipeline Fractale V4 will use a hybrid event-sourced RMS kernel.

Rationale:
The state machine needs one canonical authority for transitions, evidence,
convergence, runtime bindings and final states. MCP is the most portable
cross-runtime interface, but runtime hooks and skills remain necessary for
operator UX and enforcement. Therefore, the kernel owns truth; one MCP server
exposes it; runtime adapters enforce it where possible; skills guide it;
subagents produce evidence; books preserve durable knowledge.

Rejected:
- MCP-only RMS | too brittle when MCP is unavailable and too prone to monolith.
- Runtime-native skill/hook pack | too much semantic drift across runtimes.

Constraints:
- M/E/C cannot silently degrade when runtime enforcement is missing.
- `DONE_VERIFIED` requires fresh evidence and verified convergence.
- Subagent outputs are not authoritative until recorded as Evidence Set entries.
- Books do not override executable registries.

Confidence: medium-high
Scope-risk: broad
```

## Remaining Choice For User

The real choice is not whether to use MCP, skills, subagents or books. We need
all four.

The real choice is the authority order:

```text
recommended:
kernel > MCP/tools/resources > runtime adapters/hooks > skills > subagents > books

never:
skills/books/subagents > kernel
```

Cycle 02 should assume this order unless the user explicitly chooses A or B.
