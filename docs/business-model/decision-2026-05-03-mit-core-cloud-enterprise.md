# Decision — MIT Core + Cloud/Enterprise Monetization

**Date**: 2026-05-03  
**Status**: Accepted founder decision

## Decision

Pipeline Fractale will use a community-first business model:

- Public local core under MIT.
- Core local/RMS experience remains free and non-frustrating.
- Paid value comes from premium packs, advanced maintained workflows, hosted cloud convenience, team governance, enterprise deployment, compliance, and support.
- Forks/copycats are an accepted trade-off. If someone copies the public core, that still validates the work, strengthens the founder's developer reputation, and can expand the ecosystem.

## License Shape

```text
LICENSE                  -> MIT for public core
enterprise/LICENSE       -> existing commercial/source-available license
TRADEMARKS.md            -> protect official name, logo, domains, cloud, marketplace
CONTRIBUTING.md          -> public contributions accepted outside enterprise-only code
```

## Public Core

The public core should include enough value to become a standard:

- local CLI and installer;
- RMS/state machine/gates/hooks;
- baseline agents and skills;
- full local risk classification;
- platform adapters for Claude, Codex, and Hermes;
- plugin/skill SDK;
- docs, examples, starter workflows.

## Paid Surfaces

Paid surfaces should be additive, maintained, hosted, or organizational:

- premium first-party packs;
- advanced maintained workflow recipes;
- cloud runtime and remote sandboxes;
- WhatsApp/Slack/GitHub/Jira-style control surfaces;
- scheduled/async agent runs;
- team shared state and dashboards;
- org policies and private registries;
- SSO, SCIM, RBAC, audit logs, compliance exports;
- VPC/self-host enterprise deployment;
- support, SLA, and custom integrations.

## Rejected

- **AGPL core as default**: good for license-led cloud protection, but too much friction for the current goal of maximum community growth.
- **MIT now, restrictive later**: creates bait-and-switch risk and cannot revoke rights already granted under MIT.
- **Risk-depth paywall**: makes the core frustrating and weakens community trust.

## Directive

Future pricing and packaging decisions must preserve the local MIT core as a useful product, not a demo. Monetization should sell convenience, maintained advanced value, cloud operations, team governance, and enterprise trust.
