#!/usr/bin/env node
/**
 * Root entry for the consommable -> hima catalog generator.
 * GOAL-3 §10.4. Thin wrapper over the built @harness/generator lib.
 *
 * Usage:
 *   node scripts/generate-consommable-artifacts.mjs \
 *     --corpus <otherskill>/dist/excellence-pack/skills \
 *     --activation-rules <otherskill>/.planning/term-universe/_activation/ACTIVATION-RULES.md \
 *     [--dry-run] [--canary-only] [--out-dir <dir>]
 */
import { main } from "../packages/generator/dist/index.js";

process.exit(main(process.argv.slice(2)));
