# SPEC-001 — Contrats d'interface inter-packages

status: draft
date: 2026-06-11
owner: noyau
source: PROPOSITION.md §1/§3, ADR-0003, ADR-0002,
        packages/behavior-core/src/index.ts,
        packages/behavior-core/src/types.ts,
        packages/behavior-core/src/behavior-registry.ts,
        packages/behavior-core/src/ledger.ts,
        packages/behavior-core/src/risk-classifier.ts,
        packages/gates-core/src/index.ts,
        packages/gates-core/src/evaluate-gate.ts,
        packages/storage-core/src/index.ts,
        packages/storage-core/src/capability-map.ts,
        packages/hima-cli/src/index.ts,
        packages/hima-cli/src/commands/hook.ts
cross-refs: SPEC-003-gates-runtime-matrix.md, SPEC-007-adapter-hermes.md

---

## Objet

Ce document spécifie les contrats d'interface TypeScript entre les packages
`@hima/behavior-core`, `@hima/gates-core`, `@hima/storage-core`, `@hima/hima-cli`
et les adapters v2 (adapter-hermes-v2, adapter-claude-v2).

Les signatures TS ci-dessous sont extraites du code réel de la branche
`restructure/v2` et constituent le contrat de départ pour la Wave 2/3.

Chaque exigence est taggée sur deux axes :
- importance : `[CRITICAL]` `[HIGH]` `[MEDIUM]` `[LOW]`
- ordre : `[BLOCKS:critical]` `[BLOCKS:high]` `[BLOCKS:low]` `[BLOCKS:none]`

---

## CRITICAL items

- [CRITICAL][BLOCKS:critical] Le jeu canonique de `GateType` est exactement 9 valeurs,
  défini dans `@hima/behavior-core` (types.ts) ET dupliqué dans `@hima/storage-core`
  (capability-map.ts). Les deux définitions doivent rester identiques à tout instant.
  Source autoritaire : ADR-0002.

  ```ts
  export type GateType =
    | "session_start" | "user_prompt" | "pre_tool" | "post_tool"
    | "pre_compact"   | "post_compact" | "stop"
    | "subagent_start" | "subagent_stop";
  ```

- [CRITICAL][BLOCKS:critical] Le type `GateDecision` est l'union exacte
  `"allow" | "warn" | "block"`. Aucune valeur supplémentaire sans ADR.
  Défini dans `@hima/behavior-core/src/types.ts`.

- [CRITICAL][BLOCKS:critical] Le type `RiskClass` est l'union ordonnée
  `"T" | "L" | "M" | "H" | "C"` (T < L < M < H < C). La comparaison se fait
  **uniquement** via `riskAtLeast(current, minimum)` exporté de `@hima/behavior-core`.
  Toute comparaison directe par chaîne est INTERDITE.

- [CRITICAL][BLOCKS:critical] La frontière `@hima/behavior-core` → adapters est
  unidirectionnelle : les packages `*-core` ne dépendent d'aucun adapter. Les imports
  croisés `behavior-core → adapter-*` ou `gates-core → adapter-*` sont INTERDITS.
  L'unique chemin légal est adapter → core.

- [CRITICAL][BLOCKS:critical] Le dispatch de gate central est
  `evaluateGate(context: GateEvaluationContext, event: GateEvent): GateResult`
  exporté de `@hima/gates-core`. La gate `stop` utilise `evaluateStop` local (bug fix
  `requiresEvidenceBeforeStop`) ; toutes les autres délèguent à `@harness/core`.
  Aucun appelant externe ne doit contourner ce dispatch pour appeler directement
  `@harness/core`.

- [CRITICAL][BLOCKS:high] `GateEvaluationContext` (défini dans `@hima/behavior-core/
  src/behavior-registry.ts`) contient exactement :

  ```ts
  interface GateEvaluationContext {
    projectRoot: string;
    currentRisk: CurrentRiskFile;   // { risk_class: RiskClass }
    runSet: RunSetFile;              // evidence[], events[], policy, runtimeBindings
    sessionReadSet?: ReadonlySet<string>;
    sessionReadHashMap?: ReadonlyMap<string, string>;
  }
  ```

  Tout package qui appelle `evaluateGate` doit construire ce contexte complet.
  Les champs `sessionReadSet` et `sessionReadHashMap` sont optionnels mais requis
  pour les gates `pre_tool` et `post_tool` qui contrôlent les writes.

- [CRITICAL][BLOCKS:high] `GateResult` (défini dans `@hima/behavior-core/src/
  behavior-registry.ts`) est la seule forme de réponse d'une gate :

  ```ts
  interface GateResult {
    decision: GateDecision;          // "allow" | "warn" | "block"
    gateType?: GateType;
    reason: string;                  // message humain, obligatoire
    contextInjection?: string;       // injection optionnelle au prompt suivant
    violationType?: GateViolationType;
    qualityDimension?: QualityDimension;
    finalState?: FinalState;
    missingEvidenceItems?: string[];
    abortReport?: unknown;
  }
  ```

---

## HIGH items

- [HIGH][BLOCKS:high] Signature exacte de `classifyRisk` (`@hima/behavior-core`
  /risk-classifier.ts) :

  ```ts
  function classifyRisk(changeset: Changeset): ClassificationResult
  ```

  `ClassificationResult` inclut `riskClass`, `justification`, `activeSignals`,
  `operatingMode`, `deploymentStrategy`, `mandatoryActivities`, `bypassEligible`,
  `classifiedAt`, `proposedBy`.

  Le classifieur vit dans `@hima/behavior-core` et est appelé par `@hima/hima-cli`
  à chaque hook event. Il ne dépend d'aucun adapter.

- [HIGH][BLOCKS:high] Signature exacte du ledger (`@hima/behavior-core`/ledger.ts) :

  ```ts
  // Append (async, atomic via appendFile)
  function appendLedgerEntry(projectRoot: string, runId: string, payload: unknown): Promise<LedgerEntry>

  // Read
  function readLedger(projectRoot: string, runId: string): Promise<LedgerEntry[]>

  // Verify hash-chain integrity
  function verifyLedgerChain(entries: LedgerEntry[]): boolean
  ```

  `LedgerEntry` contient `{ id, ts, runId, sequence, prevHash, eventHash, payload }`.
  Le `prevHash` du premier entry vaut `GENESIS_HASH = "0".repeat(64)`.
  L'`eventHash` est `sha256Hex(stableJson(payload))`.
  **INTERDIT** : les champs `signature` et `publicKey` (supprimés, ed25519 retiré per
  lane-triage : zéro authenticité avec clé éphémère par entrée).

- [HIGH][BLOCKS:high] Ownership de l'état `.hima/` :

  | Chemin                              | Package propriétaire        | Accès autorisé          |
  |-------------------------------------|-----------------------------|-------------------------|
  | `.hima/state/ledger/<runId>.jsonl`  | `@hima/behavior-core`       | append-only via `appendLedgerEntry` |
  | `.hima/state/current-risk.json`     | `@hima/hima-cli`            | lecture par tous, écriture CLI seul |
  | `.hima/state/run-set.json`          | `@hima/hima-cli`            | lecture par tous, écriture CLI seul |
  | `.hima/boulder.json`                | futur `@hima/boulder-state` | non applicable Wave 1.5 |
  | `.hima/rules/`                      | futur `@hima/rules-engine`  | non applicable Wave 1.5 |

  Les packages `*-core` lisent `.hima/` via les objets passés dans `GateEvaluationContext` ;
  ils n'accèdent **jamais** directement au système de fichiers pour ces chemins.

- [HIGH][BLOCKS:high] Signature de `@hima/hima-cli` hook command :

  ```
  hima hook <event> [--format claude|hermes|native] [--root <dir>]
  ```

  - `<event>` : l'un des 9 GateTypes (ou alias natifs : `pretooluse`, `pre_tool_call`, etc.)
  - stdin : JSON du payload event
  - stdout : verdict formaté selon `--format` (défaut : `native`)
  - exit code : 0 = allow/warn, 2 = block

  Le mapping d'alias est défini dans `hima-cli/src/commands/hook.ts` :
  `NATIVE_EVENT_MAP`. Les adapters DOIVENT utiliser ce mapping, pas inventer
  les leurs.

- [HIGH][BLOCKS:low] Signature de `evaluateBehaviors` (`@hima/behavior-core`
  /behavior-registry.ts) :

  ```ts
  function evaluateBehaviors(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict
  function evaluateBehaviorsWithOverrides(context, event): { perBehavior, netVerdict }
  ```

  La logique de résolution : `block` > `warn` > `null`. Le premier `block` rencontré
  court-circuite les behaviors suivants. `evaluateBehaviorsWithOverrides` applique
  `BehaviorOverride` depuis `runSet.policy.behaviorOverrides` avant d'appeler `classify`.

- [HIGH][BLOCKS:low] Signatures de `@hima/storage-core` (atomic I/O, sans logique métier) :

  ```ts
  function atomicWriteFile(path: string, content: string): Promise<void>
  function withFileLock<T>(path: string, fn: () => Promise<T>): Promise<T>
  function readJsonFile<T>(path: string): Promise<T>
  function writeJsonFile(path: string, value: unknown): Promise<void>
  function safeAtomicWriteFile(path: string, content: string): Promise<void>
  function assertSafeWriteTarget(path: string, projectRoot: string): void
  function assertSafeDeleteTarget(path: string, projectRoot: string): void
  ```

  Ces fonctions sont les seuls points d'écriture légaux pour les fichiers `.hima/`.
  L'écriture directe via `fs.writeFile` hors de ces wrappers est INTERDITE dans
  tout package hima.

---

## MEDIUM items (convergence detail)

- [MEDIUM][BLOCKS:low] `BehaviorDescriptor` (interface pour enregistrer un behavior) :

  ```ts
  interface BehaviorDescriptor {
    readonly id: string;
    readonly name: string;
    readonly gates: readonly GateType[];
    readonly classify: (context: GateEvaluationContext, event: GateEvent) => BehaviorVerdict;
  }
  ```

  L'enregistrement se fait via `registerBehavior(descriptor)` ; idempotent (double
  registration ignorée si même `id`). Les 12 behaviors v2 sont enregistrés en
  side-effect à l'import de `@hima/behavior-core`.

- [MEDIUM][BLOCKS:low] `FinalState` est l'union :
  `"DONE_VERIFIED" | "DONE_WITH_GAPS" | "BLOCKED_NEEDS_USER" | "BLOCKED_RUNTIME_MISSING"
  | "BLOCKED_POLICY" | "MAX_ATTEMPTS_REACHED" | "LOOP_DETECTED" | "CANCELLED"`.
  Seul `DONE_VERIFIED` indique une complétion avec preuve suffisante.

- [MEDIUM][BLOCKS:none] `EvidenceItem` (élément du runSet.evidence) :

  ```ts
  interface EvidenceItem {
    id: string; key: string;
    status?: "candidate" | "accepted" | "rejected";
    claimSource?: "verified" | "inferred" | "external" | "training";
    completionStatus?: "DONE_VERIFIED" | "DONE_UNTESTED" | "ATTEMPTED_UNCONFIRMED";
    createdAt: string;
    source?: string;
    metadata?: Record<string, unknown>;
  }
  ```

- [MEDIUM][BLOCKS:none] `BehaviorOverride` permet de désactiver ou plafonner un behavior
  par rôle/risque :

  ```ts
  interface BehaviorOverride {
    behaviorId: string;
    mode: "enabled" | "warn-only" | "disabled";
    riskFloorOverride?: RiskClass;
  }
  ```

  `resolveOverride(behaviorId, overrides, riskClass)` retourne `{ skip, capAtWarn,
  forbiddenReason }`. Un override `disabled` sur un behavior `OVERRIDE_FORBIDDEN_FOR_RISK_CLASS`
  renvoie `forbiddenReason` non-null et ne skipe pas.

---

## LOW items (convergence detail)

- [LOW][BLOCKS:none] `CapabilityLevel` dans `@hima/storage-core` est
  `"supported" | "degraded" | "absent"`. Ces trois valeurs sont utilisées dans la
  capability-map (voir SPEC-003) et dans les bindings Hermes (voir SPEC-007).

- [LOW][BLOCKS:none] Les fonctions `getCapabilityMap(runtime)`, `getGateCapability(runtime,
  gateType)` et `getLimitedGates(runtime)` sont exportées de `@hima/storage-core` ET
  ré-exportées de `@hima/adapter-hermes-v2`. Les adapters utilisent la version
  `storage-core` comme source canonique.

- [LOW][BLOCKS:none] `QualityDimension` est
  `"security" | "tests" | "review" | "evidence" | "suppression"`.
  Présent dans `GateResult` pour orienter le diagnostic, jamais décisionnel.

---

## Falsifies-If

```
kill-condition: Un package *-core importe depuis un adapter-* (import croisé interdit),
  ou deux packages définissent GateType avec des valeurs différentes, ou evaluateGate est
  contourné pour appeler @harness/core directement dans un adapter.
checkpoint-date: 2026-07-15
evidence-anchor: packages/*/src/index.ts + tsconfig paths + pnpm-workspace.yaml
on-fail: Bloquer la PR contenant l'import croisé ; ouvrir un ADR si le contournement est
  justifié architecturalement ; mettre à jour ce document avant toute Wave suivante.

kill-condition: Les signatures TS de GateEvaluationContext, GateResult, LedgerEntry,
  ou classifyRisk divergent entre ce document et le code réel de restructure/v2
  sans mise à jour de cette spec.
checkpoint-date: 2026-07-01
evidence-anchor: packages/behavior-core/src/behavior-registry.ts,
  packages/behavior-core/src/ledger.ts, packages/behavior-core/src/risk-classifier.ts
on-fail: Mettre à jour cette spec en S-commit avant tout B-commit qui change les signatures.
```
