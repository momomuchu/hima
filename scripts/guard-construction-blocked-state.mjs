import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(readRootArg(process.argv.slice(2)) ?? defaultRoot);
const issues = [];

const shortTermPath = "docs/goals/SHORT-TERM-GOAL.md";
const shortTerm = await readRequiredText(shortTermPath);

const completePath = "docs/goals/COMPLETE-CONSTRUCTION-GOAL.md";
const complete = await readRequiredText(completePath);
const rescopePacketPath = "docs/goals/master-goal-rescope-decision-packet.md";
const masterLooksCycle96Blocked =
  (complete.match(/^- \[ \]/gm) ?? []).length === 36 &&
  complete.includes("- [ ] H3 install tested on Linux + macOS + Windows") &&
  complete.includes("- [ ] I6 `docs/goals/archive/v1.0-LAUNCH-2026-08-01.md` opening snapshot");

if (!/^cycle-id:\s*cycle-96-external-authorization-required\s*$/m.test(shortTerm)) {
  if (!masterLooksCycle96Blocked) {
    process.exit(0);
  }

  issues.push(
    `${shortTermPath}: cycle-id must remain cycle-96-external-authorization-required while the master ledger still has the Cycle 96 blocked shape`,
  );
}

if (!/^status:\s*BLOCKED\s*$/m.test(shortTerm)) {
  issues.push(
    `${shortTermPath}: Cycle 96 must remain status: BLOCKED until real external evidence or a claim-bearing rescope updates this guard`,
  );
}

const requiredShortTermBoundaries = [
  "This cycle cannot reach DONE through local code or docs alone.",
  "authorization packet is explicitly provided",
  "the corresponding real evidence is produced",
  "the master goal is intentionally rescoped",
  "docs/goals/h3-macos-authorization-packet.md",
  "docs/goals/evidence/h3-install-macos.md",
  "docs/goals/master-goal-rescope-decision-packet.md",
  "Real macOS environment access",
];

for (const boundary of requiredShortTermBoundaries) {
  if (!shortTerm.includes(boundary)) {
    issues.push(
      `${shortTermPath}: missing required Cycle 96 external-evidence boundary: ${boundary}`,
    );
  }
}

if (!/\bFalsifies-If:\s*\n/u.test(shortTerm)) {
  issues.push(`${shortTermPath}: missing Falsifies-If block`);
}
if (!/local proxy artifacts/u.test(shortTerm)) {
  issues.push(`${shortTermPath}: missing local-proxy DONE falsifier`);
}

const packageJsonPath = "package.json";
const packageJson = parsePackageJson(await readRequiredText(packageJsonPath), packageJsonPath);
if (packageJson) {
  const scripts = packageJson.scripts ?? {};
  if (
    scripts["guard:construction-blocked-state"] !==
    "node scripts/guard-construction-blocked-state.mjs"
  ) {
    issues.push(`${packageJsonPath}: missing guard:construction-blocked-state script`);
  }
  if (
    scripts["guard:construction-blocked-state:test"] !==
    "node scripts/guard-construction-blocked-state.test.mjs"
  ) {
    issues.push(`${packageJsonPath}: missing guard:construction-blocked-state:test script`);
  }
  if (
    scripts["audit:construction-completion"] !== "node scripts/audit-construction-completion.mjs"
  ) {
    issues.push(`${packageJsonPath}: missing audit:construction-completion script`);
  }
  if (
    scripts["audit:construction-completion:test"] !==
    "node scripts/audit-construction-completion.test.mjs"
  ) {
    issues.push(`${packageJsonPath}: missing audit:construction-completion:test script`);
  }
  if (!String(scripts.lint ?? "").includes("node scripts/guard-construction-blocked-state.mjs")) {
    issues.push(`${packageJsonPath}: lint script must run guard-construction-blocked-state.mjs`);
  }
  if (!String(scripts.lint ?? "").includes("node scripts/audit-construction-completion.mjs")) {
    issues.push(`${packageJsonPath}: lint script must run audit-construction-completion.mjs`);
  }
}

const runTestsPath = "scripts/run-tests.mjs";
const runTests = await readRequiredText(runTestsPath);
if (!runTests.includes("scripts/guard-construction-blocked-state.test.mjs")) {
  issues.push(
    `${runTestsPath}: test runner must execute guard-construction-blocked-state.test.mjs`,
  );
}
if (!runTests.includes("scripts/audit-construction-completion.test.mjs")) {
  issues.push(`${runTestsPath}: test runner must execute audit-construction-completion.test.mjs`);
}

const openRows = complete.match(/^- \[ \]/gm) ?? [];
if (openRows.length !== 36) {
  issues.push(
    `${completePath}: expected 36 unchecked master rows while Cycle 96 is BLOCKED, found ${openRows.length}`,
  );
}

const expectedOpenRows = [
  "`packages/adapter-claude/test/e2e.test.ts` end-to-end against Claude Code real session",
  "`packages/adapter-codex/test/e2e.test.ts`",
  "`packages/adapter-hermes/test/e2e.test.ts`",
  "`packages/cli/src/commands/self-test.ts` invokes the 5-scenario suite per runtime (F1)",
  "SWE-bench Verified subset wired as a benchmark target (F2)",
  "Cross-runtime parity test harness (F3)",
  "Stress test: 100 concurrent transitions test (F4)",
  "Compliance pack generation + SIEM ingest test (F5)",
  "Saturation critic over the test results (F6)",
  "`00-idea-pmf` skills installed under `~/.hima/skills/00-idea-pmf/`",
  "`01-strategy-positioning` skills installed",
  "`02-analysis-discovery` skills installed",
  "`03-specification` skills installed",
  "`04-design-ux-ui` skills installed (lower priority for harness use case)",
  "`05-architecture` skills installed",
  "`07-build` skills installed",
  "`09-quality-release-run` skills installed",
  "HARV-01 ai-slop-cleaner (OMC)",
  "HARV-02 agnix-style linting",
  "HARV-04 OMX mode state-machine",
  "HARV-07 auto-harness 3-step evidence gate",
  "HARV-08 typed human-handoff",
  "HARV-09 prompt-injection scanner",
  "HARV-11 opencode default-deny subagent tools",
  "HARV-13 PreCompact/PostCompact hooks",
  "HARV-17 claw-code prompt-cache boundary",
  "HARV-18 opencode anti-bypass clause",
  "HARV-16 nexus-agents PreferenceRouter (evaluate-then-decide)",
  "H3 install tested on Linux + macOS + Windows",
  "H8 closed beta with 10 users + saturation survey",
  "I1 GitHub repo visibility public",
  "I2 v1.0.0 tag + release notes",
  "I3 `@hima/cli` published to npm",
  "I4 founding-cohort sale page live",
  "I5 Show HN + dev.to + r/devops + Claude Code Discord posts",
  "I6 `docs/goals/archive/v1.0-LAUNCH-2026-08-01.md` opening snapshot",
];

const actualOpenRows = new Set(
  Array.from(complete.matchAll(/^- \[ \] (?<row>.+)$/gmu), (match) => match.groups?.row ?? ""),
);
const expectedOpenRowSet = new Set(expectedOpenRows);

for (const row of expectedOpenRows) {
  if (!complete.includes(`- [ ] ${row}`)) {
    issues.push(`${completePath}: expected blocked open row is not unchecked: ${row}`);
  }
  if (complete.includes(`- [x] ${row}`)) {
    issues.push(
      `${completePath}: expected blocked open row is checked while Cycle 96 is BLOCKED: ${row}`,
    );
  }
}

for (const row of actualOpenRows) {
  if (!expectedOpenRowSet.has(row)) {
    issues.push(`${completePath}: unexpected unchecked row while Cycle 96 is BLOCKED: ${row}`);
  }
}

const forbiddenCompletePatterns = [
  {
    label: "ledger progress above 119/155 claim",
    pattern: /\b(?:12[0-9]|1[3-9]\d|[2-9]\d{2,})\/155\b/u,
  },
  { label: "Cycle 96 DONE archive claim", pattern: /cycle-96-DONE/iu },
  { label: "Cycle 96 DONE status claim", pattern: /^status:\s*DONE\s*$/imu },
  {
    label: "H3 all-OS completion claim",
    pattern:
      /H3\b[^\n]*(?:complete|closed|PASS)[^\n]*(?:Linux\s*\+\s*macOS\s*\+\s*Windows|all three OS)/iu,
  },
];

for (const check of forbiddenCompletePatterns) {
  if (check.pattern.test(complete)) {
    issues.push(`${completePath}: forbidden ${check.label} while Cycle 96 is BLOCKED`);
  }
}

const staleClaimDocs = new Map([
  [shortTermPath, shortTerm],
  [completePath, complete],
  ["docs/goals/external-authorization-packet-coverage-audit.md", undefined],
  ["docs/goals/archive/cycle-96-BLOCKED-2026-05-15.md", undefined],
  [rescopePacketPath, undefined],
]);

const forbiddenStaleClaimPatterns = [
  {
    label: "ledger progress above 119/155 claim",
    pattern: /\b(?:12[0-9]|1[3-9]\d|[2-9]\d{2,})\/155\b/u,
  },
  {
    label: "construction progress above 76.8% claim",
    pattern:
      /\b(?:construction\s+(?:ledger|goal|progress)|ledger|completion\s+audit|progress)\b[^\n]{0,80}\b(?:7[7-9]|[89]\d|100)(?:\.\d+)?%/iu,
  },
  {
    label: "current open-row count below 36 claim",
    pattern:
      /\b(?:current|Cycle[-\s]*96|completion\s+audit|audit\s+reports)\b[^\n]{0,100}\b(?:[0-9]|[12]\d|3[0-5])\s+(?:open|unchecked)(?:\s+(?:master|checklist))?\s+rows\b/iu,
  },
  {
    label: "macOS transcript artifact existence claim",
    pattern:
      /docs\/goals\/evidence\/h3-install-macos\.md[^\n]*(?:exists|created|present|PASS|passes|passed)/iu,
  },
  {
    label: "macOS install proof complete claim",
    pattern:
      /\b(?:H3\s+)?macOS\s+(?:install(?:\s+(?:test|matrix))?|transcript|proof)\b[^.\n]{0,80}\b(?:is|now|has been|was|were)\s+(?:complete|completed|done|passed|captured|verified|accepted|present|available)\b/iu,
  },
  {
    label: "manual CI H3 workflow success claim",
    pattern:
      /\b(?:manual\s+CI\s+(?:workflow|run|execution)|h3-install-matrix\s+(?:workflow|run)|H3\s+(?:CI|manual-CI)\s+(?:workflow|run|execution))\b[^.\n]{0,100}\b(?:is|now|has\s+been|have\s+been|was|were)\s+(?:run|executed|completed|passed|successful|verified|accepted|green)\b/iu,
  },
  {
    label: "partial Linux/Windows H3 evidence satisfies H3 claim",
    pattern:
      /(?:\b(?:Linux\s*(?:\+|and|\/)\s*Windows|Windows\s*(?:\+|and|\/)\s*Linux)\b[^.\n]{0,120}\b(?:transcripts?|evidence|proof)\b[^.\n]{0,80}\b(?:satisf(?:y|ies|ied)|complete(?:s|d)?|close(?:s|d)?|prove(?:s|d)?|accepted|sufficient)\b[^.\n]{0,80}\bH3\b|\bH3\b[^.\n]{0,100}\b(?:satisf(?:ied|ies)|complete(?:d|s)?|closed|proved|accepted)\b[^.\n]{0,120}\b(?:Linux\s*(?:\+|and|\/)\s*Windows|Windows\s*(?:\+|and|\/)\s*Linux)\b)/iu,
  },
  {
    label: "adapter E2E artifact existence or pass claim",
    pattern:
      /packages\/adapter-(?:claude|codex|hermes)\/test\/e2e\.test\.ts[^\n]*(?:exists|created|present|PASS|passes|passed)/iu,
  },
  {
    label: "adapter E2E completion claim",
    pattern:
      /\b(?:(?:Claude|Codex|Hermes)\s+adapter\s+E2E|adapter\s+(?:real\s+)?E2E|adapter-E2E)\b[^.\n]{0,80}\b(?:is|now|has(?:\s+been)?|was|were)\s+(?:complete|completed|done|passed|verified|accepted|green)\b/iu,
  },
  {
    label: "adapter production readiness claim",
    pattern:
      /\b(?:3\s+adapters|three\s+adapters|Claude\/Codex\/Hermes\s+adapters?|Claude\s+Code,\s+Codex,\s+and\s+Hermes\s+adapters?|adapter\s+production\s+readiness|adapters?\s+production[-\s]ready)\b[^.\n]{0,100}\b(?:are|is|now|has\s+been|have\s+been|was|were)\s+(?:production[-\s]ready|ready\s+for\s+production|verified|accepted|complete|completed|done|shipped)\b/iu,
  },
  {
    label: "adapter hook firing or behavior proof claim",
    pattern:
      /\b(?:adapter\s+hook\s+(?:firing|wiring)\s+proof|adapter\s+behavior|runtime\s+permission\s+enforcement|live\s+bypass-attempt\s+proof)\b[^.\n]{0,100}\b(?:is|are|now|has\s+been|have\s+been|was|were)\s+(?:captured|verified|validated|complete|completed|done|passed|proven)\b/iu,
  },
  {
    label: "unsupported or degraded adapter hooks blocking-control claim",
    pattern:
      /\b(?:unsupported|degraded|non[-\s]?blocking)\s+(?:adapter\s+)?hooks?\b[^.\n]{0,100}\b(?:are|is|now|have\s+been|has\s+been|were|was)\s+(?:blocking|production[-\s]?blocking|enforced|upgraded|promoted|treated\s+as\s+blocking|made\s+blocking)\b/iu,
  },
  {
    label: "five-client compatibility complete claim",
    pattern:
      /\b(?:five|5)[-\s]?client\s+compatibility\b[^.\n]{0,100}\b(?:is|now|has\s+been|was|were)\s+(?:complete|completed|done|passed|verified|accepted|green|ready)\b/iu,
  },
  {
    label: "GitHub repository public or released claim",
    pattern:
      /\b(?:GitHub\s+repo(?:sitory)?|repository|github\.com\/\[user\]\/hima)\b[^\n]{0,80}\b(?:is|now|has been|was)\s+(?:public|released)\b/iu,
  },
  {
    label: "GitHub repository visibility flipped public claim",
    pattern:
      /\b(?:GitHub\s+repo(?:sitory)?|repository)\s+visibility\b[^.\n]{0,80}\b(?:has\s+been|was|is\s+now|now)\s+(?:flipped|changed|set|made)\s+to\s+public\b/iu,
  },
  {
    label: "v1 release tag or notes published claim",
    pattern:
      /\b(?:v1\.0\.0\s+(?:tag|release)|release\s+(?:tag|notes)|tag\s+\+\s+release\s+notes)\b[^.\n]{0,80}\b(?:is|are|now|has been|have been|was|were)\s+(?:created|tagged|published|released|complete|completed|done|live|available)\b/iu,
  },
  {
    label: "npm publication complete claim",
    pattern:
      /(?:@hima\/cli\b|\bnpm\s+(?:package|publication|publish)\b)[^\n]{0,80}\b(?:is|now|has been|was)\s+(?:published|complete|completed|done|live)\b/iu,
  },
  {
    label: "npm registry lookup returns package claim",
    pattern:
      /\b(?:v1\.0\.0\s+)?npm\s+registry\s+lookup\b[^.\n]{0,80}\b(?:now\s+returns|has\s+returned|returned|was\s+verified\s+returning|is\s+returning)\b[^.\n]{0,80}\b(?:@hima\/cli|package)\b/iu,
  },
  {
    label: "global npm install works claim",
    pattern:
      /\b(?:npm\s+install\s+-g\s+@hima\/cli|global\s+@hima\/cli\s+install|@hima\/cli\s+global\s+install)\b[^.\n]{0,80}\b(?:now\s+works|has\s+been\s+verified|was\s+verified|is\s+working|is\s+complete|completed\s+successfully|passes?)\b/iu,
  },
  {
    label: "sale page or Stripe payment live claim",
    pattern:
      /\b(?:founding-cohort\s+sale\s+page|sale\s+page|Stripe(?:\s+Connect)?|payment\s+flow)\b[^\n]{0,80}\b(?:is|now|has been|was)\s+(?:live|wired|complete|completed|done|processing|launched)\b/iu,
  },
  {
    label: "sale page test transaction accepted claim",
    pattern:
      /\b(?:founding(?:-cohort)?\s+sale\s+page|sale\s+page|Stripe(?:\s+Connect)?|payment\s+flow)\b[^.\n]{0,80}\b(?:now\s+accepts|has\s+accepted|accepted|was\s+verified\s+accepting)\b[^.\n]{0,80}\b(?:real\s+)?(?:Stripe\s+)?test\s+transaction\b/iu,
  },
  {
    label: "founding-cohort sales or cap reached claim",
    pattern:
      /\b(?:founding[-\s]cohort|1000[-\s]license|1000\s+(?:perpetual\s+)?(?:v1\.x\s+)?licenses?)\b[^.\n]{0,100}\b(?:has\s+been|have\s+been|has|have|is|was|were|now)\s+(?:sold|closed|capped|filled|reached|completed)\b/iu,
  },
  {
    label: "closed beta or saturation survey complete claim",
    pattern:
      /\b(?:closed\s+beta|beta\s+users?|10\s+users|saturation\s+survey)\b[^\n]{0,80}\b(?:is|now|has been|was)\s+(?:complete|completed|done|collected|validated)\b/iu,
  },
  {
    label: "beta users participated or completed scenarios claim",
    pattern:
      /\b(?:closed\s+beta|beta\s+cohort|beta\s+users?|10\s+(?:beta\s+)?users|(?:beta|saturation)\s+survey\s+responses?)\b[^.\n]{0,80}\b(?:has\s+been|have\s+been|are\s+now|were|was|now)\s+(?:recruited|enrolled|contacted|surveyed|collected|completed|participated|submitted|validated)\b/iu,
  },
  {
    label: "beta survey met scenario or pay-intent criteria claim",
    pattern:
      /\b(?:beta|saturation)\s+survey\b[^.\n]{0,100}\b(?:has\s+reported|has\s+shown|showed|confirmed|validated|met)\b[^.\n]{0,100}\b(?:completed\s+all\s+3\s+scenarios|pay\s+\$?249|pay\s+\$?249-299|would\s+pay|I'd\s+pay|I['’]d\s+pay)\b/iu,
  },
  {
    label: "launch posts published claim",
    pattern:
      /\b(?:Show\s+HN|dev\.to|r\/devops|Claude\s+Code\s+Discord|launch\s+posts?)\b[^\n]{0,80}\b(?:are|now|have been|were)\s+(?:posted|published|live|complete|completed|done)\b/iu,
  },
  {
    label: "launch-post links captured claim",
    pattern:
      /\b(?:Show\s+HN|dev\.to|r\/devops|Claude\s+Code\s+Discord|launch\s+post(?:s)?|public-post)\s+(?:link|links|URL|URLs|evidence)\b[^.\n]{0,80}\b(?:has\s+been|have\s+been|was|were|now)\s+(?:captured|collected|recorded|linked|published|posted)\b/iu,
  },
  {
    label: "runtime/model sessions executed claim",
    pattern:
      /(?<!no\s)\b(?:Claude\s+Code|Codex|Hermes|runtime\/model|model-backed)\s+(?:session|sessions|execution|run)\b[^\n]{0,80}\b(?:now|has been|have been|was|were)\s+(?:launched|executed|run|completed|passed)\b/iu,
  },
  {
    label: "runtime suite, parity, or final critic completion claim",
    pattern:
      /\b(?:5-scenario\s+suite|per-runtime\s+5-scenario\s+suite|cross-runtime\s+parity\s+test\s+harness|runtime\s+suite\s+and\s+parity|saturation\s+critic\s+over\s+the\s+test\s+results|Final\s+Stream\s+F\s+critic)\b[^.\n]{0,100}\b(?:is|are|now|has\s+been|have\s+been|was|were)\s+(?:complete|completed|done|green|passed|verified|accepted|executed|run)\b/iu,
  },
  {
    label: "runtime preflight allows execution claim",
    pattern: /["`]?(?:executionAllowed|externalSessionsLaunched)["`]?\s*:\s*true\b/iu,
  },
  {
    label: "self-test external runtime launch claim",
    pattern: /["`]?externalRuntimeSessionsLaunched["`]?\s*:\s*true\b/iu,
  },
  {
    label: "benchmark dry-run unblocked claim",
    pattern:
      /\b(?:benchmark|SWE-bench)\s+(?:plan|dry[-\s]?run)\b[^.\n]{0,100}\b(?:status|state)\b[^.\n]{0,80}\b(?:authorized|ready|unblocked|execution[-_\s]?allowed|executable|green)\b/iu,
  },
  {
    label: "real user-home install complete claim",
    pattern:
      /\b(?:real\s+`?~\/\.hima`?|real\s+user-home|~\/\.hima\/skills)\b[^\n]{0,80}\b(?:now|has been|was)\s+(?:installed|written|complete|completed|done|proven|validated)\b/iu,
  },
  {
    label: "real user-home dry-run wrote files claim",
    pattern:
      /\b(?:real\s+`?~\/\.hima`?|real\s+user-home|~\/\.hima\/skills)\b[^.\n]{0,100}\b(?:dry[-\s]?run|planning\s+run)\b[^.\n]{0,100}\b(?<!not\s)(?:wrote|applied|installed|created|modified|changed)\b/iu,
  },
  {
    label: "real user-home backup or restore proof complete claim",
    pattern:
      /\b(?:real\s+`?~\/\.hima`?|real\s+user-home|~\/\.hima\/skills)\b[^.\n]{0,120}\b(?:backup|restore|rollback)\b[^.\n]{0,120}\b(?:is|are|now|has\s+been|have\s+been|was|were)\s+(?:complete|completed|done|proven|validated|verified|accepted|captured)\b/iu,
  },
  {
    label: "book skills installed in real user-home claim",
    pattern:
      /\b(?:00-idea-pmf|01-strategy-positioning|02-analysis-discovery|03-specification|04-design-ux-ui|05-architecture|07-build|09-quality-release-run|book[-\s]skills?|excellence[-\s]book\s+skills?)\b[^.\n]{0,100}\b(?:have\s+been|has\s+been|are\s+now|were|now)\s+(?:installed|written|validated|available|invokable)\b/iu,
  },
  {
    label: "harvested skills installed or invoked claim",
    pattern:
      /\b(?:HARV-\d{2}|ai-slop-cleaner|agnix-style|OMX\s+mode\s+state-machine|auto-harness\s+3-step\s+evidence\s+gate|typed\s+human-handoff|prompt-injection\s+scanner|opencode\s+default-deny|PreCompact\/PostCompact|claw-code\s+prompt-cache|opencode\s+anti-bypass|PreferenceRouter)\b[^.\n]{0,120}\b(?:has\s+been|have\s+been|is\s+now|are\s+now|was|were|now)\s+(?:installed|written|available|invokable|invoked|used|tested|validated)\b/iu,
  },
  {
    label: "SWE-bench or benchmark execution complete claim",
    pattern:
      /\b(?:SWE-bench|benchmark)\b[^\n]{0,80}\b(?:now|has been|was)\s+(?:executed|run|completed|passed)\b/iu,
  },
  {
    label: "stress execution complete claim",
    pattern:
      /\b(?:stress\s+test|100\s+concurrent|stress)\b[^\n]{0,80}\b(?:now|has been|was)\s+(?:executed|run|completed|passed)\b/iu,
  },
  {
    label: "external SIEM ingest complete claim",
    pattern:
      /\b(?:external\s+SIEM|SIEM\s+ingest)\b[^\n]{0,80}\b(?:now|has been|was)\s+(?:ingested|transmitted|executed|completed|passed)\b/iu,
  },
  {
    label: "SIEM fixture external transmission claim",
    pattern: /["`]?externalTransmissions["`]?\s*:\s*true\b/iu,
  },
  {
    label: "fresh-machine external harness init complete claim",
    pattern:
      /\b(?:external\s+`?harness\s+init`?\s+run|`?harness\s+init`?\s+run\s+on\s+a\s+fresh\s+machine|fresh[-\s]machine\s+`?harness\s+init`?\s+run)\b[^.\n]{0,80}\b(?:is|now|has been|was|were)\s+(?:complete|completed|successful|verified|passed)\b/iu,
  },
  {
    label: "business/legal/market/revenue proof complete claim",
    pattern:
      /\b(?:revenue|legal\s+certification|market\s+validation|market\s+evidence|legal\/market\s+evidence|compliance[-\s]+certification)\b[^\n]{0,80}\b(?:is|now|has been|was|are|were)\s+(?:proven|validated|certified|complete|completed|done|collected|created|achieved)\b/iu,
  },
  {
    label: "external authorization granted claim",
    pattern:
      /\b(?:(?:external|macOS|CI|runtime\/model|runtime|model-backed|user-home|~\/\.hima|SWE-bench|benchmark|stress|SIEM|beta|user-contact|public\s+release|GitHub|npm|Stripe|payment|launch)\b[^.\n]{0,80}\bauthorization\b|\bauthorization\b(?![-\s]+(?:packet|prep|field|surface|branch|blocker|class|route))[^.\n]{0,80}\b(?:external|macOS|CI|runtime\/model|runtime|model-backed|user-home|~\/\.hima|SWE-bench|benchmark|stress|SIEM|beta|user-contact|public\s+release|GitHub|npm|Stripe|payment|launch)\b)[^.\n]{0,80}\b(?:is|now|has been|was|were)\s+(?:granted|approved|obtained|provided|cleared|authorized|available)\b/iu,
  },
  {
    label: "authorization packet execution-ready claim",
    pattern:
      /\b(?:authorization[-\s]?packet|packet\/prep|packet\s+coverage|coverage\s+audit|local\s+packet)\b[^.\n]{0,100}\b(?<!not\s)(?<!no\s)(?:is|are|now|has\s+been|have\s+been|was|were)\s+(?:ready|sufficient|accepted|approved|cleared|complete|completed|green|valid)\b[^.\n]{0,100}\b(?:to|for)\s+(?:run|execute|launch|proceed|start|publish|contact|transmit|write)\b/iu,
  },
  {
    label: "external blockers resolved claim",
    pattern:
      /\b(?:external\s+(?:evidence\s+)?blockers?|macOS\s+blocker|runtime\/model\s+blocker|user-home\s+blocker|benchmark\s+blocker|stress(?:\/SIEM)?\s+blocker|SIEM\s+blocker|beta(?:\/user)?\s+blocker|release(?:\/payment\/launch)?\s+blocker|public\s+release\s+blocker|blocked\s+lanes?)\b[^.\n]{0,80}\b(?:are|now|have been|were|is|has been|was)\s+(?:resolved|cleared|removed|unblocked|closed|satisfied|lifted)\b/iu,
  },
  {
    label: "Cycle 96 unblocked claim",
    pattern:
      /(?:\b(?:Cycle[-\s]*96|current\s+cycle|construction\s+goal|master\s+goal)\b[^.\n]{0,80}\b(?:is|now|has\s+been|was|were)?\s*(?:unblocked|blocker[-\s]?free|no\s+longer\s+blocked)\b|\b(?:no|zero|0)\s+(?:external\s+)?(?:evidence\s+)?blockers?\s+(?:remain|remaining|left|open)\b)/iu,
  },
  {
    label: "external evidence present claim",
    pattern:
      /(?<!no\s)(?<!not\s)\b(?:external\s+evidence|macOS\s+evidence|runtime\s+evidence|model-backed\s+evidence|user-home\s+evidence|benchmark\s+evidence|stress\s+evidence|SIEM\s+evidence|beta\s+evidence|release\s+evidence|launch\s+evidence)\b[^.\n]{0,80}\b(?:is|are|now|has been|have been|was|were)\s+(?:present|created|collected|captured|available|accepted|verified|ready|complete|completed)\b/iu,
  },
  {
    label: "Cycle 96 closure-ready claim",
    pattern:
      /\b(?:Cycle[-\s]*96|current\s+cycle|this\s+cycle)\b[^.\n]{0,80}\b(?:is|now|has been|was|were|are)?\s*(?:ready|clear|safe|eligible|approved|permitted|allowed)\s+to\s+close\b/iu,
  },
  {
    label: "require-complete success claim",
    pattern:
      /(?:--require-complete|\brequire-complete\b)[^.\n]{0,100}\b(?:succeeded|succeeds|returned\s+0|exit(?:ed)?\s+0|passes?\s+as\s+complete|reports?\s+complete|completed\s+successfully)\b/iu,
  },
  {
    label: "construction goal achieved claim",
    pattern:
      /\b(?:construction\s+goal|master\s+goal|complete\s+construction\s+goal|full\s+construction\s+goal)\b\s+(?:(?:is|was|were)\s+|has\s+been\s+|has\s+now\s+been\s+|is\s+now\s+|now\s+)(?!not\b)(?:achieved|fulfilled|satisfied|complete|completed|done|closed|shipped)\b/iu,
  },
  {
    label: "green local tests prove construction completion claim",
    pattern:
      /\b(?:root\s+)?(?:tests?|test\s+suite|full\s+suite|lint|build|green\s+gates|local\s+gates)\b[^.\n]{0,100}\b(?:pass(?:ed|es)?|green|succeed(?:ed|s)?|clean)\b[^.\n]{0,100}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
  },
  {
    label: "empty audit issues prove construction completion claim",
    pattern:
      /\b(?:audit\s+issues?|issues\s*(?::\s*)?\[\]|issue\s+list|aggregate\s+audit\s+issue\s+list)\b[^.\n]{0,100}\b(?:empty|clear|clean|zero|0|none|no\s+issues?|no\s+findings?)\b[^.\n]{0,100}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
  },
  {
    label: "row mapping completeness proves construction completion claim",
    pattern:
      /\b(?:36\/36\s+)?(?:row-to-external-blocker\s+mappings?|external-blocker\s+mappings?|open-row\s+mappings?|row\s+mappings?|coverage[-\s]?map\s+rows?)\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
  },
  {
    label: "packet coverage completeness proves construction completion claim",
    pattern:
      /\b(?:36\/36\s+)?(?:open|unchecked|remaining)\s+(?:master\s+|checklist\s+)?rows?\b[^.\n]{0,80}\b(?:have|has|with|are|were)\s+(?:packet\/prep|packet\s+and\s+prep|packet[-\s]prep|authorization[-\s]packet|packet)\s+coverage\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
  },
  {
    label: "blocker-list exactness proves construction completion claim",
    pattern:
      /\b(?:machine[-\s]readable\s+)?(?:external[-\s]?blocker\s+list|blocker\s+list|external\s+blocker\s+classes?|blocker\s+classes?)\b[^.\n]{0,120}\b(?:exact|complete|clean|verified|mapped|pass(?:es|ed)?)\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
  },
  {
    label: "Falsifies-If validation proves construction completion claim",
    pattern:
      /\b(?:claim-bearing\s+(?:Falsifies-If\s+)?(?:validation|scan|checks?)|Falsifies-If\s+(?:validation|field\s+checks?|gate\s+checks?|checks?)|runtime\s+post_tool\s+Falsifies-If\s+gate)\b[^.\n]{0,120}\b(?:pass(?:es|ed)?|green|clean|complete|valid|verified)\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
  },
  {
    label: "completion-artifact absence proves construction completion claim",
    pattern:
      /\b(?:completion[-\s]artifact\s+absence|required\s+completion\s+artifacts?|missing\s+completion\s+artifacts?|artifact[-\s]absence\s+checks?)\b[^.\n]{0,120}\b(?:absent|missing|pass(?:es|ed)?|green|clean|verified)\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
  },
  {
    label: "status-blocker checks prove construction completion claim",
    pattern:
      /\b(?:status[-\s]blocker\s+checks?|completion[-\s]status\s+blocker\s+checks?|blocked[-\s]status\s+checks?)\b[^.\n]{0,120}\b(?:pass(?:es|ed)?|green|clean|verified|satisfied)\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
  },
  {
    label: "DONE-criteria checks prove construction completion claim",
    pattern:
      /\b(?:active\s+)?DONE[-\s]criteria\s+(?:checks?|requirements?|criteria)\b[^.\n]{0,120}\b(?:pass(?:es|ed)?|green|clean|verified|satisfied|strict)\b[^.\n]{0,120}\b(?:prove(?:s|d)?|confirms?|means|establish(?:es|ed)?|closes?|completes?|satisf(?:y|ies|ied))\b[^.\n]{0,100}\b(?:construction\s+goal|master\s+goal|Cycle[-\s]*96|external\s+evidence|row\s+closure|ledger\s+advance|DONE|complete)\b/iu,
  },
  {
    label: "open-row closure claim",
    pattern:
      /\b(?:open|unchecked|remaining)\s+(?:master\s+|checklist\s+)?rows\b[^.\n]{0,80}\b(?:are|now|have been|were|are now)\s+(?:closed|resolved|cleared|completed|done|satisfied)\b/iu,
  },
  {
    label: "local packet/prep/audit surface proves external completion claim",
    pattern:
      /\b(?:packet\s+coverage(?:\s+audit)?|coverage\s+audit|authorization[-\s]+prep|prep\s+surface|packet\/audit\s+artifact|local\s+proxy\s+artifacts?)\b[^.\n]{0,100}\b(?<!not\s)(?<!no\s)(?:proof|proves?|authorizes?|authorized|confirms?|(?:is|are|accepted|used)\s+as\s+evidence\s+of)\b[^.\n]{0,80}\b(?:external\s+(?:execution|evidence)|completion|DONE|row\s+closure|ledger\s+advance)/iu,
  },
  { label: "Cycle 96 DONE archive claim", pattern: /cycle-96-DONE/iu },
  { label: "Cycle 96 DONE status claim", pattern: /^status:\s*DONE\s*$/imu },
  {
    label: "stale 9/9 blocked-state guard claim",
    pattern: /\b9\/9 blocked-state guard checks\b/iu,
  },
  {
    label: "stale 10/10 blocked-state guard claim",
    pattern: /\b10\/10 blocked-state guard checks\b/iu,
  },
  {
    label: "stale blockedStateGuardChecks field-count claim",
    pattern: /\b(?:9|10)\s+`?blockedStateGuardChecks`?\b/iu,
  },
  {
    label: "stale 11 runtime Falsifies gate invariants claim",
    pattern: /\b11 runtime Falsifies gate invariants\b/iu,
  },
  {
    label: "stale runtimeFalsifiesGateChecks field-count claim",
    pattern: /\b(?:11|12)\s+`?runtimeFalsifiesGateChecks`?\b/iu,
  },
  {
    label: "stale runtime gate check ratio claim",
    pattern: /\b(?:11|12)\/(?:11|12)\s+runtime gate checks\b/iu,
  },
  {
    label: "stale falsifiesFieldChecks field-count claim",
    pattern: /\b(?:74|75)\s+`?falsifiesFieldChecks`?\b/iu,
  },
  {
    label: "stale falsifies-field check ratio claim",
    pattern: /\b(?:74|75)\/(?:74|75)\s+falsifies-field checks\b/iu,
  },
  {
    label: "stale artifactTermChecks field-count claim",
    pattern: /\b(?:47|48)\s+`?artifactTermChecks`?\b/iu,
  },
  {
    label: "stale required-term check ratio claim",
    pattern: /\b(?:47|48)\/(?:47|48)\s+required-term checks\b/iu,
  },
  {
    label: "stale artifactSurfaceChecks field-count claim",
    pattern: /\b(?:19|20)\s+`?artifactSurfaceChecks`?\b/iu,
  },
  {
    label: "stale surface check ratio claim",
    pattern: /\b(?:19|20)\/(?:19|20)\s+surface checks\b/iu,
  },
  {
    label: "stale coverageSurfacePathChecks field-count claim",
    pattern: /\b(?:10|11)\s+`?coverageSurfacePathChecks`?\b/iu,
  },
  {
    label: "stale referenced-surface check ratio claim",
    pattern: /\b(?:10|11)\/(?:10|11)\s+referenced surfaces\b/iu,
  },
  {
    label: "H3 all-OS completion claim",
    pattern:
      /H3\b[^\n]*(?:complete|closed|PASS)[^\n]*(?:Linux\s*\+\s*macOS\s*\+\s*Windows|all three OS)/iu,
  },
  {
    label: "launch snapshot existence claim",
    pattern: /v1\.0-LAUNCH-2026-08-01\.md[^\n]*(?:exists|created|present)/iu,
  },
  {
    label: "launch snapshot captured claim",
    pattern:
      /\b(?:opening\s+snapshot|launch\s+snapshot)\b[^.\n]{0,80}\b(?:has\s+been|was|is\s+now|now)\s+(?:captured|created|written|archived|completed|done)\b/iu,
  },
];

for (const [staleClaimPath, knownContent] of staleClaimDocs) {
  const content = knownContent ?? (await readRequiredText(staleClaimPath));
  for (const check of forbiddenStaleClaimPatterns) {
    if (check.pattern.test(content)) {
      issues.push(`${staleClaimPath}: forbidden ${check.label} while Cycle 96 is BLOCKED`);
    }
  }
}

const rescopeEnactedClaimDocs = new Map([
  [shortTermPath, shortTerm],
  [completePath, complete],
  ["docs/goals/external-authorization-packet-coverage-audit.md", undefined],
  ["docs/goals/archive/cycle-96-BLOCKED-2026-05-15.md", undefined],
]);
const rescopeEnactedClaimPattern =
  /\b(?:master\s+goal|construction\s+goal|Cycle[-\s]*96)\b[^\n]{0,80}\b(?:now|has been|was)\s+(?:rescoped|rescop(?:e|ed)\s+approved|rescop(?:e|ed)\s+enacted)\b/iu;

for (const [rescopeClaimPath, knownContent] of rescopeEnactedClaimDocs) {
  const content = knownContent ?? (await readRequiredText(rescopeClaimPath));
  if (rescopeEnactedClaimPattern.test(content)) {
    issues.push(
      `${rescopeClaimPath}: forbidden master-goal rescope enacted claim while Cycle 96 is BLOCKED`,
    );
  }
}

await requireMissing("docs/goals/evidence/h3-install-macos.md");
await requireMissing("docs/goals/archive/v1.0-LAUNCH-2026-08-01.md");
await requireMissing("packages/adapter-claude/test/e2e.test.ts");
await requireMissing("packages/adapter-codex/test/e2e.test.ts");
await requireMissing("packages/adapter-hermes/test/e2e.test.ts");

const requiredPartialH3Evidence = [
  { path: "docs/goals/evidence/h3-install-linux.md", osLabel: "linux" },
  { path: "docs/goals/evidence/h3-install-windows.md", osLabel: "windows" },
];

for (const evidence of requiredPartialH3Evidence) {
  const content = await readRequiredText(evidence.path);
  if (!content.includes(`H3 Install Matrix Transcript - ${evidence.osLabel}`)) {
    issues.push(`${evidence.path}: missing H3 ${evidence.osLabel} transcript title`);
  }
  if (!content.includes("partial H3 evidence only")) {
    issues.push(`${evidence.path}: missing partial-evidence boundary`);
  }
  if (!/\|\s*Failure count\s*\|\s*0\s*\|/u.test(content)) {
    issues.push(`${evidence.path}: missing zero-failure H3 transcript summary`);
  }
}

const requiredPackets = [
  "docs/goals/h3-macos-authorization-packet.md",
  "docs/goals/beta-release-authorization-packet.md",
  "docs/goals/stress-siem-authorization-packet.md",
];

for (const packet of requiredPackets) {
  const content = await readRequiredText(packet);
  if (!/^status:\s*BLOCKED_AUTHORIZATION_PACKET\s*$/m.test(content)) {
    issues.push(`${packet}: missing status: BLOCKED_AUTHORIZATION_PACKET`);
  }
  if (!/\bFalsifies-If:\s*\n/u.test(content)) {
    issues.push(`${packet}: missing Falsifies-If block`);
  }
  if (!/not authorization|not .*evidence/iu.test(content)) {
    issues.push(`${packet}: missing explicit non-authorization/non-evidence boundary`);
  }
}

const requiredPacketTerms = new Map([
  [
    "docs/goals/h3-macos-authorization-packet.md",
    [
      "Authorized Route A: Real macOS Host",
      "Authorized Route B: Manual GitHub Actions CI",
      "workflow_dispatch",
      "macos-latest",
      "docs/goals/evidence/h3-install-macos.md",
      "Failure count | 0",
      "No proxy evidence",
    ],
  ],
  [
    "docs/goals/beta-release-authorization-packet.md",
    [
      "Authorization Route A: Closed Beta H8",
      "Authorization Route B: Public Release I1-I3",
      "Authorization Route C: Sale Page, Payment, and Launch Posts I4-I5",
      "Authorization Route D: Opening Snapshot I6",
      "10 external users",
      "Stripe test transaction",
      "docs/goals/archive/v1.0-LAUNCH-2026-08-01.md",
    ],
  ],
  [
    "docs/goals/stress-siem-authorization-packet.md",
    [
      "Authorization Route A: F4 Concurrent Stress",
      "Authorization Route B: F5 External SIEM Ingest",
      "Authorization Route C: F6 Post-Execution Critic",
      "100 intended transition attempts",
      "External SIEM ingest command or API transcript",
      "real H-class run",
      "F6 is requested before real F1-F5 evidence exists",
    ],
  ],
]);

for (const [packet, terms] of requiredPacketTerms) {
  const content = await readRequiredText(packet);
  for (const term of terms) {
    if (!content.includes(term)) {
      issues.push(`${packet}: missing required authorization-packet term: ${term}`);
    }
  }
}

const requiredPrepSurfaces = [
  "docs/goals/runtime-evidence-authorization-prep.md",
  "docs/goals/adapter-e2e-authorization-blocker-review.md",
  "docs/goals/real-user-home-install-authorization-prep.md",
];

for (const prepSurface of requiredPrepSurfaces) {
  const content = await readRequiredText(prepSurface);
  if (!/^status:\s*COMPLETE\s*$/m.test(content)) {
    issues.push(`${prepSurface}: missing status: COMPLETE`);
  }
  if (!/\bFalsifies-If:\s*\n/u.test(content)) {
    issues.push(`${prepSurface}: missing Falsifies-If block`);
  }
  if (!hasNonExecutionBoundary(content)) {
    issues.push(`${prepSurface}: missing explicit non-execution/non-proof boundary`);
  }
}

const requiredPrepSurfaceTerms = new Map([
  [
    "docs/goals/runtime-evidence-authorization-prep.md",
    [
      "RuntimeParityAuthorizationSchema",
      "BenchmarkAuthorizationSchema",
      "executionAllowed: false",
      "externalSessionsLaunched: false",
      "transcriptRetentionPath",
      "Do not launch the runtime binary until the authorization packet exists",
      "Cost/accounting record",
    ],
  ],
  [
    "docs/goals/adapter-e2e-authorization-blocker-review.md",
    [
      "packages/adapter-claude/test/e2e.test.ts",
      "packages/adapter-codex/test/e2e.test.ts",
      "packages/adapter-hermes/test/e2e.test.ts",
      "Explicit runtime/model authorization is absent",
      "transcript; before/after tests; HIMA events/ledger excerpts",
      "unsupported/degraded hooks being upgraded in claims",
    ],
  ],
  [
    "docs/goals/real-user-home-install-authorization-prep.md",
    [
      "No real user-home write was performed",
      "Real `~/.hima/skills/00-idea-pmf",
      "Target home",
      "Backup path",
      "Restore plan",
      "no write on dry-run",
      "A platform\n`install-artifacts` run alone is not enough",
    ],
  ],
]);

for (const [prepSurface, terms] of requiredPrepSurfaceTerms) {
  const content = await readRequiredText(prepSurface);
  for (const term of terms) {
    if (!content.includes(term)) {
      issues.push(`${prepSurface}: missing required authorization-prep term: ${term}`);
    }
  }
}

const rescopePacket = await readRequiredText(rescopePacketPath);
if (!/^status:\s*BLOCKED_RESCOPE_PACKET\s*$/m.test(rescopePacket)) {
  issues.push(`${rescopePacketPath}: missing status: BLOCKED_RESCOPE_PACKET`);
}
if (!/\bFalsifies-If:\s*\n/u.test(rescopePacket)) {
  issues.push(`${rescopePacketPath}: missing Falsifies-If block`);
}
if (
  !/not a rescope\s+decision[\s\S]*not external evidence[\s\S]*no row, ledger count, or completion status changes/iu.test(
    rescopePacket,
  )
) {
  issues.push(
    `${rescopePacketPath}: missing explicit non-rescope/non-evidence/no-ledger-change boundary`,
  );
}

const requiredRescopePacketTerms = [
  "Required Rescope Decision Fields",
  "Decision owner",
  "Removed rows",
  "Replacement claims",
  "Evidence downgrade",
  "Falsifiers",
  "Ledger update",
  "This packet does not",
];

for (const term of requiredRescopePacketTerms) {
  if (!rescopePacket.includes(term)) {
    issues.push(`${rescopePacketPath}: missing required rescope-packet term: ${term}`);
  }
}

const coverageAuditPath = "docs/goals/external-authorization-packet-coverage-audit.md";
const coverageAudit = await readRequiredText(coverageAuditPath);
if (!/^status:\s*COMPLETE\s*$/m.test(coverageAudit)) {
  issues.push(`${coverageAuditPath}: missing status: COMPLETE`);
}
if (!/^ledger:\s*119\/155\s*$/m.test(coverageAudit)) {
  issues.push(`${coverageAuditPath}: missing ledger: 119/155`);
}
if (!/36 unchecked rows/u.test(coverageAudit)) {
  issues.push(`${coverageAuditPath}: missing 36 unchecked rows assertion`);
}
if (!/\bFalsifies-If:\s*\n/u.test(coverageAudit)) {
  issues.push(`${coverageAuditPath}: missing Falsifies-If block`);
}

const expectedCoverageFamilies = [
  {
    family: "Adapter real E2E",
    rows: 3,
    surfaces: [
      "docs/goals/runtime-evidence-authorization-prep.md",
      "docs/goals/adapter-e2e-authorization-blocker-review.md",
    ],
  },
  {
    family: "Runtime suite and parity",
    rows: 2,
    surfaces: ["docs/goals/runtime-evidence-authorization-prep.md"],
  },
  {
    family: "SWE-bench benchmark",
    rows: 1,
    surfaces: ["docs/goals/runtime-evidence-authorization-prep.md"],
  },
  {
    family: "Stress/concurrency",
    rows: 1,
    surfaces: ["docs/goals/stress-siem-authorization-packet.md"],
  },
  {
    family: "Compliance/SIEM",
    rows: 1,
    surfaces: ["docs/goals/stress-siem-authorization-packet.md"],
  },
  {
    family: "Final Stream F critic",
    rows: 1,
    surfaces: ["docs/goals/stress-siem-authorization-packet.md"],
  },
  {
    family: "Book-skill real installs",
    rows: 8,
    surfaces: ["docs/goals/real-user-home-install-authorization-prep.md"],
  },
  {
    family: "Harvested-skill original rows",
    rows: 11,
    surfaces: [
      "docs/goals/real-user-home-install-authorization-prep.md",
      "docs/goals/runtime-evidence-authorization-prep.md",
    ],
  },
  {
    family: "H3 OS install matrix",
    rows: 1,
    surfaces: ["docs/goals/h3-macos-authorization-packet.md"],
  },
  {
    family: "Closed beta",
    rows: 1,
    surfaces: ["docs/goals/beta-release-authorization-packet.md"],
  },
  {
    family: "Public release",
    rows: 3,
    surfaces: ["docs/goals/beta-release-authorization-packet.md"],
  },
  {
    family: "Sale page, payment, launch posts",
    rows: 2,
    surfaces: ["docs/goals/beta-release-authorization-packet.md"],
  },
  {
    family: "Launch snapshot",
    rows: 1,
    surfaces: ["docs/goals/beta-release-authorization-packet.md"],
  },
];

const coverageMap = extractCoverageMap(coverageAudit);
const coverageRowSum = Array.from(coverageMap.values()).reduce((sum, entry) => sum + entry.rows, 0);
if (coverageRowSum !== 36) {
  issues.push(`${coverageAuditPath}: expected coverage-map row sum 36, found ${coverageRowSum}`);
}

for (const expected of expectedCoverageFamilies) {
  const actual = coverageMap.get(expected.family);
  if (!actual) {
    issues.push(`${coverageAuditPath}: missing coverage family: ${expected.family}`);
    continue;
  }

  if (actual.rows !== expected.rows) {
    issues.push(
      `${coverageAuditPath}: coverage family ${expected.family} expected ${expected.rows} rows, found ${actual.rows}`,
    );
  }

  for (const surface of expected.surfaces) {
    if (!actual.surfaceCell.includes(surface)) {
      issues.push(`${coverageAuditPath}: coverage family ${expected.family} missing ${surface}`);
    }
  }
}

for (const family of coverageMap.keys()) {
  if (!expectedCoverageFamilies.some((expected) => expected.family === family)) {
    issues.push(
      `${coverageAuditPath}: unexpected coverage family while Cycle 96 is BLOCKED: ${family}`,
    );
  }
}

const archivePath = "docs/goals/archive/cycle-96-BLOCKED-2026-05-15.md";
const archive = await readRequiredText(archivePath);
if (!/^status:\s*BLOCKED\s*$/m.test(archive)) {
  issues.push(`${archivePath}: missing status: BLOCKED`);
}
if (/status:\s*DONE/iu.test(archive)) {
  issues.push(`${archivePath}: must not be marked DONE`);
}
if (!/not a DONE archive/u.test(complete) && !/not DONE/u.test(shortTerm)) {
  issues.push(`${completePath}: missing Cycle 96 blocked-archive non-DONE boundary`);
}
if (/53 Vitest files \/ 698 tests/iu.test(archive)) {
  issues.push(`${archivePath}: stale root-test count; expected 53 Vitest files / 702 tests`);
}

const requiredArchiveBlockedStateTerms = [
  "blockedStateGuardChecks",
  "archiveDeliveredArtifactChecks",
  "aggregate audit issue-list checks",
  "completion-status blocker checks that include audit issues",
  "synthetic completion-with-issues drift",
  "stale 9/9 blocked-state guard count drift",
  "stale 10/10 blocked-state guard count drift",
  "authorization-packet execution-ready drift",
  "required authorization packet/prep/rescope terms",
  "required packet/prep/rescope surfaces",
  "rescope packet boundary",
  "53 Vitest files / 702 tests",
  "215 claim-bearing files / 1,405 checks",
  "Preparation-only packet: `docs/goals/master-goal-rescope-decision-packet.md`.",
];

for (const term of requiredArchiveBlockedStateTerms) {
  if (!archive.includes(term)) {
    issues.push(`${archivePath}: missing required archived blocked-state term: ${term}`);
  }
}

if (issues.length > 0) {
  console.error("Construction blocked-state guard failed.");
  console.error(
    "Cycle 96 is still BLOCKED, so packet/prep/rescope coverage must not be promoted to evidence.",
  );
  console.error("");

  for (const issue of issues) {
    console.error(`- ${issue}`);
  }

  process.exitCode = 1;
}

function readRootArg(args) {
  const index = args.indexOf("--root");
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

async function readRequiredText(relativePath) {
  try {
    return await readFile(path.join(root, relativePath), "utf8");
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      issues.push(`${relativePath}: required file is missing`);
      return "";
    }

    throw error;
  }
}

async function requireMissing(relativePath) {
  try {
    await access(path.join(root, relativePath));
    issues.push(`${relativePath}: must be absent while Cycle 96 is BLOCKED`);
  } catch (error) {
    if (!isNodeErrorWithCode(error, "ENOENT")) {
      throw error;
    }
  }
}

function isNodeErrorWithCode(error, code) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function parsePackageJson(content, relativePath) {
  try {
    return JSON.parse(content);
  } catch (error) {
    issues.push(`${relativePath}: invalid JSON (${error.message})`);
    return undefined;
  }
}

function hasNonExecutionBoundary(content) {
  return /does not authorize|does not execute|without launching|No real|not .*proof|not .*evidence|not .*execution|did not .*launch|did not .*write/iu.test(
    content,
  );
}

function extractCoverageMap(content) {
  const map = new Map();
  const section = content.match(
    /## Open-Row Packet Map\s+(?<table>[\s\S]*?)\n## Non-Row External Mentions/u,
  );

  if (!section?.groups?.table) {
    issues.push(
      "docs/goals/external-authorization-packet-coverage-audit.md: missing Open-Row Packet Map section",
    );
    return map;
  }

  for (const line of section.groups.table.split(/\r?\n/u)) {
    const cells = line
      .trim()
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length !== 4 || cells[0] === "Open row family" || cells[0].startsWith("---")) {
      continue;
    }

    const rows = Number.parseInt(cells[1], 10);
    if (!Number.isInteger(rows)) {
      issues.push(
        `docs/goals/external-authorization-packet-coverage-audit.md: invalid row count for coverage family ${cells[0]}`,
      );
      continue;
    }

    map.set(cells[0], { rows, surfaceCell: cells[2] });
  }

  return map;
}
