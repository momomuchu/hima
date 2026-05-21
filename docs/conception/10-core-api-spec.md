# Core Package — API Specification

> **Package** : `@harness/core`
> **Statut** : Conception v1 — contrat API stable avant implémentation
> **Date** : 2026-05-03
> **Sources** : `checkpoint-implementation.md` §7.2 + §9.1.6 · `rms-runtime-sets-v1-draft.md` · `quality-model.md` · `harness-state-machine.md`

> **Cycle 75 drift note** : the module map below is the original conception contract. The current
> package barrel is `packages/core/src/index.ts`; its reviewed export inventory is
> `docs/excellence-application/05-architecture/stream-h-api-stability-review.md` plus
> `docs/goals/h2-api-row-reconciliation.md`. `@harness/core` remains private, version `0.0.0`, and
> `UNLICENSED`, so this document is not npm/public v1 API compatibility evidence.

---

## Sommaire

1. Vue d'ensemble des modules
2. Définitions de types partagés
3. Module `state-machine`
4. Module `risk-classifier`
5. Module `gates`
6. Module `planning`
7. Module `logging`
8. Interface `RuntimeAdapter`
9. Types d'erreurs
10. Exports publics du package

---

## 1. Vue d'ensemble des modules

`@harness/core` est le noyau réutilisable du harness. Il ne dépend d'aucune plateforme cible. Les adapters dépendent de `core`, jamais l'inverse.

```
@harness/core
├── state-machine/    Machine Harel — 8 cycles × 7 sous-étapes, guards, permissions territoire
│                     Dépend de : types, gates (évaluation des guards)
├── risk-classifier/  Classification T/L/M/H/C + promotion de classe en cours de cycle
│                     Dépend de : types
├── gates/            Évaluation gates RMS abstraites et politiques d'action agent
│                     Dépend de : types, risk-classifier
├── planning/         Lecture/écriture .planning/ — 3 fichiers canoniques + sections RMS logiques
│                     Dépend de : types, logging
└── logging/          Journal append-only logique — transitions, événements harness
                      Dépend de : types
```

**Règle de dépendances** : pas de cycle entre modules. `state-machine` appelle `gates` pour les guards ; `gates` n'importe jamais `state-machine`.

---

## 2. Définitions de types partagés

### 2.1 Énumérations fondamentales

```typescript
// 8 cycles + états transversaux de la Pipeline Fractale v4
export type MacroCycle =
  | "discovery" | "cadrage" | "conception" | "build"
  | "validation" | "release" | "run" | "learning";

// 7 sous-étapes du sous-cycle universel
export type SubPhase =
  | "Observer" | "Define" | "Design" | "Execute"
  | "Verify" | "Capitalize" | "Transmit";

// Pivot central — module tout le reste (profondeur, mode, gates, artefacts)
export type RiskClass = "T" | "L" | "M" | "H" | "C";

export const RISK_CLASS_RANK: Record<RiskClass, number> = {
  T: 0,
  L: 1,
  M: 2,
  H: 3,
  C: 4,
};

export type OperatingMode = "bypass" | "auto" | "pairing";

// `auto` garde checkpoints, visibilité complète et validations humaines requises
// par la classe de risque. Il n'existe aucune variante canonique de ce mode.

// Comparaison obligatoire : utiliser RISK_CLASS_RANK, jamais l'ordre lexicographique.
export declare function compareRiskClass(a: RiskClass, b: RiskClass): number;

// États finaux explicites du RMS — pas de "done" vague
export type FinalState =
  | "DONE_VERIFIED" | "DONE_WITH_GAPS" | "BLOCKED_NEEDS_USER"
  | "BLOCKED_RUNTIME_MISSING" | "BLOCKED_POLICY"
  | "MAX_ATTEMPTS_REACHED" | "LOOP_DETECTED" | "CANCELLED";

// Gates abstraites RMS — portables entre runtimes
export type GateType =
  | "session_start" | "user_prompt" | "pre_tool"
  | "post_tool" | "stop" | "subagent_start" | "subagent_stop";

// Actions agent évaluées par PolicyDecision
export type AgentAction =
  | "write_code" | "write_docs" | "write_planning" | "write_logs"
  | "read_boundaries" | "modify_boundaries" | "spawn_subagent"
  | "call_mcp" | "transition_phase" | "skip_substep"
  | "set_bypass_mode" | "override_gate";

// Types de preuves dans l'Evidence Set
export type EvidenceKind =
  | "test_results" | "lint_typecheck_build" | "files_modified"
  | "hook_decision" | "subagent_output" | "screenshot_visual"
  | "review" | "command_output" | "risk_remaining"
  | "known_gap" | "confidence_level";
```

### 2.2 État courant et contexte

```typescript
export interface MachineSnapshot {
  phase: MacroCycle;
  subPhase: SubPhase;
  mode: OperatingMode;
  riskClass: RiskClass;
  sessionId: string;
  activeItemRef: string | null;   // chemin vers le PBI actif
  activeCycleStart: string | null;
  gatesPassed: GateType[];
  gatesPending: GateType[];
  errorState: "RECOVERABLE" | "ESCALATED" | null;
  suspendReason: string | null;
  lastTransition: StateTransition | null;
  updatedAt: string; // ISO 8601
}

// Contexte passé à chaque évaluation de gate ou de politique
export interface RunContext {
  snapshot: MachineSnapshot;
  projectRoot: string;
  runtimeId: "claude" | "codex" | "hermes" | string;
  sessionId: string;
  runId: string;
}

export interface TerritoryPermissions {
  docs: "R" | "W" | "none";
  planning: "R" | "W" | "none";
  code: "R" | "W" | "none";
  logs: "R" | "W(append)" | "none";
  boundaries: "R" | "none"; // jamais W pour l'agent
}
```

### 2.3 Transitions

```typescript
export type TransitionEventType =
  | "CYCLE_START" | "CYCLE_COMPLETE" | "CYCLE_ABORT" | "CYCLE_SUSPEND"
  | "SUBSTEP_ENTER" | "SUBSTEP_COMPLETE" | "SUBSTEP_SKIP"
  | "DOR_CHECK" | "DOR_PASS" | "DOR_FAIL" | "DOD_CHECK" | "DOD_PASS" | "DOD_FAIL"
  | "MODE_SET_PAIRING" | "MODE_SET_AUTO" | "MODE_SET_BYPASS" | "MODE_OVERRIDE"
  | "RISK_CLASS_SET" | "RISK_CLASS_PROMOTE" | "RISK_CLASS_DEMOTE"
  | "ERROR_DETECTED" | "ERROR_RECOVERED" | "ERROR_UNRECOVERABLE"
  | "ROLLBACK_REQUEST" | "ROLLBACK_COMPLETE"
  | "HUMAN_VALIDATE" | "HUMAN_REJECT" | "HUMAN_OVERRIDE"
  | "SESSION_START" | "SESSION_END" | "HARNESS_SYNC";

export interface TransitionEvent {
  type: TransitionEventType;
  triggeredBy: "agent" | "human" | "ci" | "hook" | "system";
  payload?: Record<string, unknown>;
  ts: string;
}

export interface TransitionRequest {
  event: TransitionEvent;
  targetPhase?: MacroCycle;
  targetSubPhase?: SubPhase;
  reason?: string;
}

export interface TransitionResult {
  success: boolean;
  previousSnapshot: MachineSnapshot;
  newSnapshot: MachineSnapshot;
  guardsEvaluated: GuardResult[];
  blockedBy?: string;   // nom du guard bloquant si success=false
  logged: boolean;
}

export interface GuardResult {
  guardName: string;
  passed: boolean;
  reason?: string;
}

export interface StateTransition {
  ts: string;
  session: string;
  from: { phase: MacroCycle; subPhase: SubPhase };
  to: { phase: MacroCycle; subPhase: SubPhase };
  event: TransitionEventType;
  guards: Record<string, boolean>;
  mode: OperatingMode;
  riskClass: RiskClass;
  triggeredBy: "agent" | "human" | "ci" | "hook" | "system";
  item?: string;
  notes?: string | null;
}
```

### 2.4 Gates et politiques

```typescript
export type GateDecision = "allow" | "block" | "warn";

export interface GateEvent {
  gateType: GateType;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  promptContent?: string;
  metadata?: Record<string, unknown>;
}

export interface GateResult {
  decision: GateDecision;
  gateType: GateType;
  reason: string;
  contextInjection?: string;
  evidenceRequired?: boolean;
  violatedPolicy?: string;
  ts: string;
}

export interface PolicyRule {
  id: string;
  riskClasses: RiskClass[];
  action: AgentAction;
  decision: "allow" | "block" | "require_evidence" | "require_human";
  condition?: string;
  gates?: GateType[];
}

export interface PolicySet {
  version: string;
  rules: PolicyRule[];
  bypassConditions: PolicyRule[];
  escalationConditions: PolicyRule[];
  testingThresholds: Record<RiskClass, number>;
  documentationRequirements: Record<RiskClass, string[]>;
  reviewRequirements: Record<RiskClass, string[]>;
  autonomyLimits: Record<RiskClass, OperatingMode[]>;
}

export interface PolicyDecision {
  allowed: boolean;
  action: AgentAction;
  riskClass: RiskClass;
  mode: OperatingMode;
  reason: string;
  requiresHumanValidation: boolean;
  requiresEvidence: boolean;
  auditEntry: boolean;
}
```

### 2.5 Evidence Set logique

```typescript
export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  ts: string;
  runId: string;
  content: string;
  filePath?: string;
  passed?: boolean;
  metadata?: Record<string, unknown>;
}

export interface EvidenceSet {
  runId: string;
  riskClass: RiskClass;
  items: EvidenceItem[];
  sufficientForDoneVerified: boolean;
  confidenceLevel: "low" | "medium" | "high";
  knownGaps: string[];
  createdAt: string;
  updatedAt: string;
}
```

L'Evidence Set est une section logique du fichier `.planning/run-set.json`. Le contrat
PFV4 n'autorise pas de fichier physique séparé pour ce set.

### 2.6 Les 8 Sets canoniques RMS

Les Sets RMS sont des sections logiques stockées dans les trois fichiers canoniques :

- `.planning/state.yaml` : snapshot machine, Project Set, Intent Set, Runtime Capability Set,
  Runtime Binding Set, Policy Set et Route Set.
- `.planning/current-risk.yaml` : classification de risque courante et justification.
- `.planning/run-set.json` : Run Set, Evidence Set logique, événements et transitions du run.

Ils ne sont jamais matérialisés comme fichiers séparés.

```typescript
// Set 1 — Vérité stable du projet (vision, contraintes, politiques)
export interface ProjectSet {
  vision: string;
  architectureConstraints: string[];
  qualityStandards: string[];
  repoConventions: string[];
  securityPolicies: string[];
  responsibilityZones: Record<string, string>;
}

// Set 2 — Demande courante (créé par run)
export interface IntentSet {
  runId: string;
  objective: string;
  scope: string[];
  nonScope: string[];
  ambiguities: string[];
  initialRiskClass: RiskClass;
  authorizedAutonomy: OperatingMode;
  expectedDeliverable: string;
  definitionOfDone: string[];
  createdAt: string;
}

// Set 3 — Capacités inspectées du runtime courant
export interface RuntimeCapabilitySet {
  runtimeId: string;
  runtimeVersion: string;
  os: string;
  shell: string;
  sandboxPermissions: string[];
  availableHooks: string[];
  activeHooks: string[];
  availableSkills: string[];
  availableSubagents: string[];
  subagentMaxDepth: number;
  availableMcpServers: string[];
  knownLimitations: string[];
  inspectedAt: string;
}

// Set 4 — Traduction gates RMS → primitives runtime
export interface RuntimeBinding {
  primitive: "hook" | "skill" | "subagent" | "mcp" | "noop";
  /** Label runtime externe, ex. pre_tool_use ou user_prompt_submit. Jamais un GateType canonique. */
  adapterEvent?: string;
  canBlock?: boolean;
  format?: string;
  transport?: string[];
  limitation?: string;
}

export interface RuntimeBindingSet {
  activeTarget?: string | null;
  gates?: Partial<Record<GateType, RuntimeBinding>>;
}

// Route-required runtime assessment — pure read model, no persistence side effect
export interface RuntimeBindingAssessment {
  binding: RuntimeBinding;
  enforceable: boolean;
  blockingProblem: boolean;
  availabilityProblem: boolean;
  blockingCapabilityRequired: boolean;
}

export interface RuntimeBindingHealth {
  healthy: boolean;
  requiredGates: GateType[];
  assessments: RuntimeBindingAssessment[];
  gaps: string[];
}

export interface RouteRuntimeAssessmentInput {
  runtimeBindings: RuntimeBindingSet;
  subagents: Array<{ status?: string }>;
  policy: {
    riskPolicies?: Partial<Record<RiskClass, { requiredGates?: GateType[] }>>;
  };
}

export function assessRouteRuntimeBindings(
  runSet: RouteRuntimeAssessmentInput,
  riskClass: RiskClass,
): RuntimeBindingHealth;

// Set 5 — Règles de politique (voir PolicySet §2.4)
// Set 6 — Décision prise par le RMS pour un run
export interface RouteSet {
  phase: MacroCycle;
  subPhase: SubPhase;
  mode: OperatingMode;
  riskClass: RiskClass;
}

export interface EnterDevelopmentInput {
  phase?: MacroCycle;          // default: "build"
  subPhase?: SubPhase;         // default: "Execute"
  mode?: OperatingMode;        // default: "auto"
  riskClass?: RiskClass;       // default: current risk
  objective?: string;
  rawPrompt?: string;
  reason?: string;
  now?: Date;
}

export interface EnterDevelopmentResult {
  ok: true;
  runId: string;
  previous: {
    phase: MacroCycle;
    subPhase: SubPhase | null;
    mode: OperatingMode;
    riskClass: RiskClass;
  };
  current: RouteSet;
  objective: string | null;
}

// Set 7 — État vivant de l'exécution
export interface RunSet {
  runId: string;
  currentPhase: MacroCycle;
  openTasks: string[];
  completedTasks: string[];
  attempts: number;
  loopsDetected: number;
  activeSubagents: string[];
  writeLocks: string[];
  blockers: string[];
  lastEvent: TransitionEvent | null;
  possibleFinalStates: FinalState[];
  updatedAt: string;
}

// Set 8 — voir EvidenceSet §2.5
```

---

## 3. Module `state-machine`

Maintient l'état courant de la machine Harel (macro-FSM × micro-FSM), évalue les guards, produit des `TransitionResult` déterministes. Ne persiste pas sur disque (délégué à `planning`).

```typescript
export interface MachineConfig {
  projectRoot: string;
  sessionId: string;
  runtimeId: string;
  initialRiskClass?: RiskClass;   // défaut: "L"
  initialMode?: OperatingMode;    // défaut: "auto"
  initialPhase?: MacroCycle;           // défaut: "discovery"
  initialSubPhase?: SubPhase;     // défaut: "Observer"
}

export interface HarnessMachine {
  readonly config: MachineConfig;
  readonly snapshot: MachineSnapshot;
}

/** Crée la machine. Si .planning/state.yaml existe, le restaure. */
export declare function createHarnessMachine(config: MachineConfig): HarnessMachine;

/**
 * Tente une transition. Évalue tous les guards.
 * Déterministe : même snapshot + même événement → même résultat.
 * Si un guard échoue : success=false, snapshot inchangé.
 */
export declare function transition(
  machine: HarnessMachine,
  request: TransitionRequest
): TransitionResult;

/** Snapshot immutable de l'état courant. Sans effet de bord. */
export declare function getSnapshot(machine: HarnessMachine): MachineSnapshot;

/** Vérifie si une transition vers la phase cible est possible sans l'effectuer. */
export declare function canTransition(machine: HarnessMachine, target: MacroCycle): boolean;

/**
 * Vérifie si une sous-étape peut être skippée.
 * T → tout sauf Execute ; L → Observer optionnel ; M/H/C → aucun skip.
 */
export declare function canSkipSubPhase(
  machine: HarnessMachine,
  subPhase: SubPhase
): boolean;

/** Liste les TransitionEventType valides depuis l'état courant. */
export declare function getValidTransitions(
  machine: HarnessMachine
): TransitionEventType[];

/**
 * Retourne la matrice de permissions territoire × état courant.
 * Source : harness-state-machine.md §5.2 — deny-by-default.
 */
export declare function getTerritoryPermissions(
  machine: HarnessMachine
): TerritoryPermissions;
```

---

## 4. Module `risk-classifier`

Classifie un changeset en T/L/M/H/C, gère les promotions de classe, retourne la politique applicable.

```typescript
export interface Changeset {
  filesChanged: string[];
  labels?: string[];
  description?: string;
  touchesAuth?: boolean;
  touchesPayments?: boolean;
  touchesPii?: boolean;
  touchesPublicApi?: boolean;
  touchesDatabaseSchema?: boolean;
  touchesHealthData?: boolean;
  touchesArchitecture?: boolean;
  regulatoryRequirement?: string;
}

export interface RiskClassification {
  riskClass: RiskClass;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  triggeredCriteria: string[];
  bypassAllowed: boolean;
  humanValidationRequired: boolean;
  recommendedMode: OperatingMode;
}

export interface PromotionResult {
  previousClass: RiskClass;
  newClass: RiskClass;
  reason: string;
  humanValidationRequired: boolean;
  cycleSuspendRequired: boolean;
  retroActiveReauditRequired: boolean;
  ts: string;
}

export interface RiskPolicy {
  riskClass: RiskClass;
  bypassAllowed: boolean;
  autoAllowed: boolean;
  humanValidationRequired: boolean;
  skipAllowedSubPhases: SubPhase[];
  adrRequired: boolean;
  threatModelRequired: boolean;
  rollbackPlanRequired: boolean;
  rollbackPlanTestRequired: boolean;
  logLevel: "light" | "standard" | "full" | "full_audit";
  exitGate: "automatic" | "auto_spot_check" | "auto_review" | "human" | "human_pair_review";
  mandatoryArtifacts: string[];
}

/**
 * Classifie un changeset via un arbre de décision déterministe.
 * Règles clés : données santé → C minimum ; auth/paiements → H minimum ;
 * API publique / schéma DB → H ; PII → H ; fonctionnalité isolée → L ; cosmétique → T.
 * En cas d'ambiguïté, retourne la classe la plus haute (fail-safe).
 */
export declare function classifyRisk(changeset: Changeset): RiskClassification;

/**
 * Promeut la classe de risque d'un run en cours.
 * Déclenche CYCLE_SUSPEND automatique si promotion vers H/C.
 */
export declare function promoteRisk(
  current: RiskClass,
  target: RiskClass,
  reason: string
): PromotionResult;

/** Retourne la politique complète pour une classe. Source : harness-state-machine.md §8.1. */
export declare function getRiskPolicy(riskClass: RiskClass): RiskPolicy;

/** Vérifie si une reclassification à la baisse est justifiable (rare, exige HUMAN_OVERRIDE). */
export declare function canDemoteRisk(
  current: RiskClass,
  target: RiskClass,
  justification: string
): { allowed: boolean; reason: string };
```

---

## 5. Module `gates`

Évalue les gates abstraites RMS, vérifie les politiques d'action, enregistre les gates custom.

```typescript
export interface GateDefinition {
  gateType: GateType;
  name: string;
  description: string;
  canBlock: boolean;
  canInjectContext: boolean;
  requiresEvidence: boolean;
  evaluator: (context: RunContext, event: GateEvent) => GateResult;
}

/**
 * Évalue une gate RMS dans le contexte courant.
 * Consulte le PolicySet et la RiskClassification.
 * Toute évaluation est tracée dans .planning/run-set.json (append logique).
 */
export declare function evaluateGate(
  gateType: GateType,
  context: RunContext,
  event: GateEvent
): GateResult;

/**
 * Évalue si une action agent est autorisée selon la politique et l'état courant.
 * Vérifie riskPolicy, mode opératoire, état machine, Evidence Set.
 */
export declare function evaluatePolicy(
  riskClass: RiskClass,
  action: AgentAction,
  context: RunContext
): PolicyDecision;

/**
 * Enregistre une gate custom.
 * Lance une erreur si une gate du même type est déjà enregistrée (pas de silent override).
 */
export declare function registerGate(gateDefinition: GateDefinition): void;

/** Retourne les gates enregistrées, filtrées optionnellement par runtimeId. */
export declare function listGates(runtimeId?: string): GateDefinition[];

/**
 * Vérifie si l'Evidence Set est suffisant pour DONE_VERIFIED.
 * Règle RMS : pas de DONE_VERIFIED sans Evidence Set suffisant.
 */
export declare function isEvidenceSufficient(
  evidenceSet: EvidenceSet,
  riskClass: RiskClass,
  policySet: PolicySet
): { sufficient: boolean; missingKinds: EvidenceKind[]; reason: string };

/**
 * Évalue les phase-gates entre deux cycles consécutifs.
 * Ex: build/Verify → validation/Observer = dod_satisfied + critical_path_clear + no_open_critical_risk.
 */
export declare function evaluatePhaseGate(
  fromPhase: MacroCycle,
  toPhase: MacroCycle,
  context: RunContext
): { passed: boolean; guards: GuardResult[]; blockedBy?: string };
```

---

## 6. Module `planning`

Abstraction filesystem pour `.planning/` — trois fichiers canoniques et sections RMS logiques.

```typescript
export interface PlanningState {
  version: "1";
  updatedAt: string;
  sessionId: string;
  phase: MacroCycle;
  subPhase: SubPhase;
  mode: OperatingMode;
  riskClass: RiskClass;
  activeItemRef: string | null;
  activeCycleStart: string | null;
  gatesPassed: GateType[];
  gatesPending: GateType[];
  lastTransition: StateTransition | null;
  errorState: "RECOVERABLE" | "ESCALATED" | null;
  suspendReason: string | null;
}

export interface InitOptions {
  riskClass?: RiskClass;     // défaut: "L"
  mode?: OperatingMode;      // défaut: "auto"
  overwrite?: boolean;       // défaut: false
  createDocs?: boolean;      // défaut: true
}

/**
 * Lit l'état depuis .planning/state.yaml.
 * Retourne un état discovery/Observer synthétique si le fichier est absent.
 */
export declare function readState(
  projectRoot: string,
  options?: { fallbackToIdle?: boolean; validate?: boolean }
): PlanningState;

/**
 * Écrit l'état dans .planning/state.yaml (write atomique).
 * À appeler via state-machine.transition() — pas directement sauf HARNESS_SYNC.
 */
export declare function writeState(projectRoot: string, state: PlanningState): void;

/**
 * Initialise la structure .planning/ pour un nouveau projet.
 * Crée uniquement les fichiers canoniques state.yaml, current-risk.yaml et run-set.json,
 * plus docs/ si demandé.
 */
export declare function initPlanning(projectRoot: string, options?: InitOptions): void;

/** Lit la section Evidence Set logique de .planning/run-set.json. Retourne un set vide si absent. */
export declare function readEvidence(projectRoot: string, runId?: string): EvidenceSet;

/** Ajoute un EvidenceItem et recalcule sufficientForDoneVerified. */
export declare function addEvidence(
  projectRoot: string,
  item: EvidenceItem,
  runId?: string
): EvidenceSet;

/** Lit un Set RMS logique depuis les trois fichiers canoniques .planning/*. */
export declare function readRmsSet<T>(
  projectRoot: string,
  setName:
    | "project-set" | "intent-set" | "capability-set" | "binding-set"
    | "policy-set" | "route-set" | "run-set" | "evidence-set",
  runId?: string
): T;

/** Écrit un set RMS (write atomique, validation de schéma avant écriture). */
export declare function writeRmsSet<T>(
  projectRoot: string,
  setName: string,
  data: T,
  runId?: string
): void;

/** Valide la structure .planning/ (utilisé par `harness doctor`). */
export declare function validatePlanningStructure(
  projectRoot: string
): Array<{ severity: "error" | "warn"; message: string; path: string }>;
```

---

## 7. Module `logging`

Journal logique append-only dans `.planning/run-set.json` — invariant : aucune entrée
n'est modifiée ni supprimée.

```typescript
export interface HarnessEvent {
  id: string;           // UUID v4
  ts: string;           // ISO 8601
  sessionId: string;
  runId?: string;
  type: TransitionEventType | GateType | string;
  phase: MacroCycle;
  subPhase: SubPhase;
  riskClass: RiskClass;
  mode: OperatingMode;
  triggeredBy: "agent" | "human" | "ci" | "hook" | "system";
  payload?: Record<string, unknown>;
  notes?: string;
}

export interface EventFilter {
  sessionId?: string;
  runId?: string;
  types?: string[];
  phases?: MacroCycle[];
  riskClasses?: RiskClass[];
  fromTs?: string;
  toTs?: string;
  triggeredBy?: Array<"agent" | "human" | "ci" | "hook" | "system">;
  limit?: number;   // défaut: 500
  offset?: number;  // défaut: 0
}

export interface StateMachineMetrics {
  transitionsTotal: number;
  territoryViolations: number;      // cible: 0
  gateFailRate: number;             // cible: < 10 %
  errorEscalationRate: number;      // cible: < 5 %
  bypassOverrideCount: number;      // cible: 0
  riskPromotionRate: number;        // cible: < 10 %
  suspendDurationAvgHours: number;  // cible: < 24 h
  cycleCompletionRate: number;      // cible: > 85 %
  windowDays: number;
  computedAt: string;
}

/** Ajoute un événement dans la section events de .planning/run-set.json. */
export declare function appendEvent(projectRoot: string, event: HarnessEvent): void;

/** Ajoute une transition dans la section transitions de .planning/run-set.json. */
export declare function appendTransition(
  projectRoot: string,
  transition: StateTransition
): void;

/** Requête les événements passés. Scan séquentiel de la section events. */
export declare function queryEvents(
  projectRoot: string,
  filter: EventFilter
): HarnessEvent[];

/** Requête les transitions passées depuis .planning/run-set.json. */
export declare function queryTransitions(
  projectRoot: string,
  filter: Pick<EventFilter, "sessionId" | "runId" | "fromTs" | "toTs" | "limit" | "offset">
): StateTransition[];

/** Calcule les métriques de santé de la machine à états depuis .planning/run-set.json. */
export declare function computeStateMachineMetrics(
  projectRoot: string,
  options?: { windowDays?: number }
): StateMachineMetrics;
```

---

## 8. Interface `RuntimeAdapter`

Contrat que chaque adapter (`@harness/adapter-claude`, `-codex`, `-hermes`) doit implémenter. `core` n'importe aucun adapter.

```typescript
export interface HookConfig {
  [key: string]: unknown;
}

export interface InstallOptions {
  projectRoot?: string;
  force?: boolean;
  dryRun?: boolean;
  selectedGates?: GateType[];
}

export interface InstallResult {
  success: boolean;
  artifactsWritten: string[];
  artifactsSkipped: string[];
  warnings: string[];
  errors: string[];
}

export interface RuntimeAdapter {
  readonly runtimeId: "claude" | "codex" | "hermes" | string;
  readonly version: string;

  /**
   * Installe les artefacts harness dans la plateforme (settings.json, AGENTS.md…).
   * Idempotent.
   */
  install(options: InstallOptions): Promise<InstallResult>;

  /** Désinstalle les artefacts. Ne touche jamais .planning/. */
  uninstall(options?: { projectRoot?: string; dryRun?: boolean }): Promise<void>;

  /**
   * Inspecte le runtime réel pour produire un RuntimeCapabilitySet.
   * Doit utiliser l'inspection effective, pas seulement la documentation.
   */
  detectCapabilities(projectRoot: string): Promise<RuntimeCapabilitySet>;

  /**
   * Traduit une GateDefinition core en hook natif du runtime.
   * Retourne null si la gate n'est pas supportée (no-op explicite, pas silencieux).
   */
  formatHookConfig(gateDefinition: GateDefinition): HookConfig | null;

  /** Chemin absolu où installer une skill pour ce runtime. */
  getSkillPath(skillName: string): string;

  /** Chemin absolu du fichier d'instructions principal (CLAUDE.md, AGENTS.md…). */
  getInstructionsPath(): string;

  /** Table de traduction gates RMS → primitives concrètes du runtime. */
  getBindings(): RuntimeBindingSet;
}
```

---

## 9. Types d'erreurs

Toutes les erreurs héritent de `HarnessError`. Jamais de `throw new Error("string")` nu.

```typescript
export class HarnessError extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "HarnessError";
    this.code = code;
    this.context = context;
  }
}

/** Une transition a été bloquée par un guard. */
export class InvalidTransitionError extends HarnessError {
  readonly blockedByGuard: string;
  readonly currentSnapshot: MachineSnapshot;
  readonly requestedEvent: TransitionEventType;
  constructor(guard: string, snapshot: MachineSnapshot, event: TransitionEventType) {
    super(
      `Transition bloquée par "${guard}" depuis ${snapshot.phase}.${snapshot.subPhase} sur ${event}`,
      "INVALID_TRANSITION",
      { guard, event }
    );
    this.name = "InvalidTransitionError";
    this.blockedByGuard = guard;
    this.currentSnapshot = snapshot;
    this.requestedEvent = event;
  }
}

/** Une gate a bloqué une action agent. */
export class GateBlockedError extends HarnessError {
  readonly gateResult: GateResult;
  readonly agentAction?: AgentAction;
  constructor(gateResult: GateResult, agentAction?: AgentAction) {
    super(
      `Gate "${gateResult.gateType}" bloquée${agentAction ? ` sur "${agentAction}"` : ""} : ${gateResult.reason}`,
      "GATE_BLOCKED",
      { gateType: gateResult.gateType, agentAction }
    );
    this.name = "GateBlockedError";
    this.gateResult = gateResult;
    this.agentAction = agentAction;
  }
}

/** Evidence Set insuffisant pour autoriser DONE_VERIFIED. */
export class InsufficientEvidenceError extends HarnessError {
  readonly missingKinds: EvidenceKind[];
  readonly currentEvidenceSet: EvidenceSet;
  constructor(missingKinds: EvidenceKind[], evidenceSet: EvidenceSet) {
    super(
      `Evidence Set insuffisant — manquants : ${missingKinds.join(", ")}`,
      "INSUFFICIENT_EVIDENCE",
      { missingKinds }
    );
    this.name = "InsufficientEvidenceError";
    this.missingKinds = missingKinds;
    this.currentEvidenceSet = evidenceSet;
  }
}

/** Une action viole une règle du PolicySet. */
export class PolicyViolationError extends HarnessError {
  readonly violatedRule: PolicyRule;
  readonly action: AgentAction;
  readonly riskClass: RiskClass;
  constructor(rule: PolicyRule, action: AgentAction, riskClass: RiskClass) {
    super(
      `Action "${action}" interdite pour la classe ${riskClass} par la règle "${rule.id}"`,
      "POLICY_VIOLATION",
      { ruleId: rule.id, action, riskClass }
    );
    this.name = "PolicyViolationError";
    this.violatedRule = rule;
    this.action = action;
    this.riskClass = riskClass;
  }
}

/** Runtime non supporté ou capacités insuffisantes pour la route choisie. */
export class RuntimeNotSupportedError extends HarnessError {
  readonly runtimeId: string;
  readonly missingCapabilities: string[];
  constructor(runtimeId: string, missingCapabilities: string[]) {
    super(
      `Runtime "${runtimeId}" — capacités manquantes : ${missingCapabilities.join(", ")}`,
      "RUNTIME_NOT_SUPPORTED",
      { runtimeId, missingCapabilities }
    );
    this.name = "RuntimeNotSupportedError";
    this.runtimeId = runtimeId;
    this.missingCapabilities = missingCapabilities;
  }
}

/** Tentative d'écriture hors territoire autorisé — invariant absolu de la matrice §5.2. */
export class TerritoryViolationError extends HarnessError {
  readonly territory: string;
  readonly currentPhase: MacroCycle;
  readonly currentSubPhase: SubPhase | null;
  constructor(territory: string, phase: MacroCycle, subPhase: SubPhase | null) {
    super(
      `Écriture interdite dans "${territory}" depuis ${phase}.${subPhase ?? "–"}`,
      "TERRITORY_VIOLATION",
      { territory, phase, subPhase }
    );
    this.name = "TerritoryViolationError";
    this.territory = territory;
    this.currentPhase = phase;
    this.currentSubPhase = subPhase;
  }
}
```

---

## 10. Exports publics du package

```typescript
// packages/core/src/index.ts

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  // Énumérations
  MacroCycle, SubPhase, RiskClass, OperatingMode, FinalState,
  GateType, AgentAction, EvidenceKind,
  // Machine
  MachineSnapshot, MachineConfig, HarnessMachine,
  RunContext, TerritoryPermissions,
  // Transitions
  TransitionEventType, TransitionEvent, TransitionRequest,
  TransitionResult, StateTransition, GuardResult,
  // Gates et politiques
  GateEvent, GateResult, GateDecision, GateDefinition,
  PolicyRule, PolicySet, PolicyDecision,
  // Evidence + RMS sets
  EvidenceItem, EvidenceSet,
  ProjectSet, IntentSet, RuntimeCapabilitySet,
  RuntimeBindingSet, RuntimeBinding, RouteSet, RunSet,
  // Risk
  Changeset, RiskClassification, PromotionResult, RiskPolicy,
  // Planning
  PlanningState, InitOptions,
  // Logging
  HarnessEvent, EventFilter, StateMachineMetrics,
  // Adapter
  RuntimeAdapter, InstallOptions, InstallResult, HookConfig,
} from "./types";

// ─── Modules ─────────────────────────────────────────────────────────────────
export {
  createHarnessMachine, transition, getSnapshot,
  canTransition, canSkipSubPhase, getValidTransitions, getTerritoryPermissions,
} from "./state-machine";

export {
  RISK_CLASS_RANK,
  classifyRisk, promoteRisk, getRiskPolicy, canDemoteRisk, compareRiskClass,
} from "./risk-classifier";

export {
  evaluateGate, evaluatePolicy, registerGate,
  listGates, isEvidenceSufficient, evaluatePhaseGate,
} from "./gates";

export {
  readState, writeState, initPlanning,
  readEvidence, addEvidence, readRmsSet, writeRmsSet,
  validatePlanningStructure,
} from "./planning";

export {
  enterDevelopment,
} from "./services/enter-development";

export {
  appendEvent, appendTransition, queryEvents,
  queryTransitions, computeStateMachineMetrics,
} from "./logging";

// ─── Erreurs ─────────────────────────────────────────────────────────────────
export {
  HarnessError, InvalidTransitionError, GateBlockedError,
  InsufficientEvidenceError, PolicyViolationError,
  RuntimeNotSupportedError, TerritoryViolationError,
} from "./errors";

// ─── Internals (NON exportés) ────────────────────────────────────────────────
// guards/      — fonctions de garde individuelles (dor_satisfied, bypass_allowed…)
// schema/      — schémas Zod/Valibot pour validation YAML/JSON
// utils/       — helpers filesystem, atomic write, parsers YAML/JSON
// constants/   — chemins par défaut (.planning/state.yaml, current-risk.yaml, run-set.json)
//               les adapters utilisent getSkillPath() / getInstructionsPath()
```

---

*Contrat API v1 — stable. Toute modification breaking exige un ADR et un bump de version majeure. Les adapters et le CLI compilent contre ce contrat uniquement, jamais contre les internals.*
