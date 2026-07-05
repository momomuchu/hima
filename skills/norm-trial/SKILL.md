---
name: norm-trial
description: Write and run the tests that prove each charter scenario; accumulate the evidence no completion claim may skip.
stage: test
source: base
mode: force
---

## Purpose

Cover the cycle's **test** stage: prove every charter scenario with real tests (unit,
integration, e2e as appropriate) and accumulate the evidence set that `norm-verdict` will check.
Force at M+ criticality — no DONE claim is trusted without trial evidence behind it.

## When to use

- A sealed charter exists and its scenarios need a corresponding test before (RED) or after
  (confirming GREEN) `norm-forge` writes code.
- A completion claim is about to be made and no test evidence has been collected yet for one or
  more charter scenarios.

## Steps

- For every Gherkin scenario in the charter, write (or confirm) a corresponding test — no
  scenario without a test.
- Write tests RED first when practical; otherwise confirm they fail for the right reason before
  `norm-forge` makes them pass.
- Prefer integration-level tests for behavior, unit tests for pure domain logic — never test
  mocks in place of real behavior.
- Run the full relevant suite, not just the new tests, to catch regressions.
- Record the evidence set (which scenario → which test → pass/fail) so `norm-verdict` can audit
  it without re-deriving it.

## Done when

- Every charter scenario has a passing test that exercises real behavior, not a mock of itself.
- The full relevant test suite is green, not just the newly added tests.
- The evidence set is written down and ready for `norm-verdict`'s independent check.
