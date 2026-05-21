---
name: "strategy-thesis"
version: "1.0.0"
type: task
triggers:
  - "strategy"
  - "thesis"
  - "choice"
expected_outputs:
  - "strategy_thesis: strategic choice and tradeoff"
  - "rejected_option: option not pursued and reason"
requires_tools: []
fallback_for_toolsets: []
description: "Express strategy as a choice with an explicit rejected alternative."
---

<!-- HIMA:SKILL-ARTIFACT name=strategy-thesis source=book/01-strategy-positioning -->

# Strategy Thesis

State the strategic choice and the option being rejected.

## Guardrails

- A strategy without a rejected alternative is not a strategy.
- Tie the choice to scarce resources.
- Record the risk if the thesis is wrong.
