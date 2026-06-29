# hima Config — Per-User / Per-Project Customization

## Overview

hima reads a `HimaConfig` JSON file from up to two locations and merges them at startup. This lets you customize which corpus skills are hard-forced per stage, swap out the full dev cycle, or tune per-role subagent behavior — without modifying the canonical defaults.

## Config file locations

| Scope | Path | Wins over |
|---|---|---|
| User | `~/.hima/config.json` | Base defaults |
| Project | `<project-root>/.hima/config.json` | User config |

Both files are optional. Missing or malformed files are silently skipped (the CLI logs a warning to stderr but never crashes). The merge is performed left-to-right: **base < user < project**.

## Merge rules

- `stageSkills` and `roles` merge **per-key**: a stage or role present in the project config replaces that key in the user config entirely. Other keys from the user config are kept.
- `cycle` is replaced **wholesale**: if the project config defines `cycle`, the user-level `cycle` is discarded entirely.

## Three customization axes

### Axis 1 — Stage skills (`stageSkills`)

Override the `forceSkills` (hard-forced before writes) and `injectSkills` (background context) for individual stages without touching the rest of the cycle.

```json
{
  "stageSkills": {
    "discovery": {
      "force": [
        { "source": "corpus", "id": "corpus-technical-analysis-discovery" },
        { "source": "project", "id": "my-project-discovery-guide" }
      ],
      "inject": []
    },
    "impl": {
      "force": [
        { "source": "corpus", "id": "corpus-code-quality-maintainability" }
      ]
    }
  }
}
```

Setting `"force": []` explicitly suppresses any default force-skill for that stage (an empty array is a valid override, not a no-op).

### Axis 2 — Full cycle replacement (`cycle`, AMENDMENT-003)

Replace the entire `DEV_CYCLE` with your own stage sequence. Useful for projects with a different workflow (e.g., research-first, no design stage, etc.).

```json
{
  "cycle": {
    "id": "my-custom-cycle",
    "name": "My Custom Cycle",
    "stages": [
      {
        "id": "research",
        "name": "Research",
        "forceSkills": [{ "source": "corpus", "id": "corpus-ai-ml-product-engineering" }],
        "injectSkills": [],
        "entryAllowed": true
      },
      {
        "id": "impl",
        "name": "Implementation",
        "forceSkills": [{ "source": "corpus", "id": "corpus-code-quality-maintainability" }],
        "injectSkills": [],
        "entryAllowed": true
      }
    ]
  }
}
```

When `cycle` is present, **`stageSkills` overrides still apply on top of it** (stageSkills wins over cycle wins over DEV_CYCLE).

### Axis 3 — Per-role subagent overrides (`roles`, AMENDMENT-001)

Override the model, forced skills, or allowed stages for a named subagent role.

```json
{
  "roles": {
    "executor": {
      "model": "haiku",
      "stages": ["impl", "test"],
      "forcedSkills": [
        { "source": "corpus", "id": "corpus-code-quality-maintainability" }
      ]
    },
    "reviewer": {
      "model": "sonnet"
    }
  }
}
```

**Cost-guard constraint**: `model` accepts only `"sonnet"` or `"haiku"`. The value `"opus"` is rejected by the schema decoder (cost-guard §6).

## Precedence summary

```
resolveStageForceSkills(config, stageId, DEV_CYCLE):
  1. config.stageSkills[stageId].force   — explicit user/project override   (highest)
  2. config.cycle.stages[stageId].forceSkills — custom cycle stage
  3. DEV_CYCLE.stages[stageId].forceSkills    — founder default              (lowest)
  4. []                                        — stage not found in any source
```

## SkillRef sources

| `source` | Meaning |
|---|---|
| `"base"` | Built-in base skill (not yet used in v3) |
| `"corpus"` | Corpus excellence-book skill (e.g. `corpus-technical-analysis-discovery`) |
| `"user"` | User-defined skill from `~/.hima/skills/` |
| `"project"` | Project-defined skill from `<root>/.hima/skills/` |

## Example: override discovery skill in a project

`<project-root>/.hima/config.json`:

```json
{
  "stageSkills": {
    "discovery": {
      "force": [{ "source": "corpus", "id": "corpus-offensive-security-pentesting" }]
    }
  }
}
```

Result: when a ward is at the `discovery` stage, the pre-tool-use gate hard-forces `corpus-offensive-security-pentesting` instead of the default `corpus-technical-analysis-discovery`.

## Validation

The schema is enforced by Effect Schema. Invalid config files (bad JSON, wrong field types, disallowed model values) are skipped with a stderr warning — they do not crash the CLI or block the session.

To validate your config manually:

```ts
import { decodeHimaConfig } from "@hima/schemas";
const cfg = decodeHimaConfig(JSON.parse(fs.readFileSync(".hima/config.json", "utf8")));
```

## Full example

See `.hima/config.example.json` at the repo root for an annotated example covering all three axes.
