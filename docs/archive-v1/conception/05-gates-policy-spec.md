# Gates & Policy Specification — Pipeline Fractale v4

> **Statut** : conception v1 — prêt pour implémentation
> **Date** : 2026-05-03
> **Scope** : harness TypeScript, toutes plateformes (Claude Code / Codex / Hermes)
> **Sources** : `rms-runtime-sets-v1-draft.md`, `checkpoint-implementation.md`, `risk-classification.md`, `cross-cutting-activities.md`

---

## Sommaire

1. [Catalogue des gates](#1-catalogue-des-gates)
2. [Sémantique des gates](#2-sémantique-des-gates)
3. [Modèle d'implémentation](#3-modèle-dimplémentation)
4. [Règles de politique par classe de risque](#4-règles-de-politique-par-classe-de-risque)
5. [Hard-block vs Warning](#5-hard-block-vs-warning)
6. [Conditions de bypass](#6-conditions-de-bypass)
7. [Protocole d'escalade](#7-protocole-descalade)
8. [Exigences de preuve par gate](#8-exigences-de-preuve-par-gate)
9. [Format des fichiers de politique](#9-format-des-fichiers-de-politique)
10. [API TypeScript](#10-api-typescript)

---

## 1. Catalogue des gates

Neuf `GateType` canoniques constituent le noyau portable du RMS. Chaque gate a une sémantique RMS stable ; le binding vers la primitive native (hook Claude, hook Codex, wrapper shell) est délégué au Runtime Binding Set. Les noms natifs tels que `PreToolUse` ou `pre_tool_call` sont des événements d'adaptateur externes, pas des valeurs canoniques de `GateType`.

| GateType | Événement déclencheur | Peut bloquer l'action courante | Peut injecter contexte | Peut exiger preuve | Peut signaler violation |
|---|---|:---:|:---:|:---:|:---:|
| `session_start` | Ouverture d'une session agent | non | oui | non | oui |
| `user_prompt` | Réception d'un prompt utilisateur | oui | oui | non | oui |
| `pre_tool` | Avant exécution de tout outil | oui | oui | non | oui |
| `post_tool` | Après exécution de tout outil | non | oui | oui | oui |
| `pre_compact` | Avant compaction du contexte | oui | oui | non | oui |
| `post_compact` | Après restauration du contexte compacté | non | oui | non | oui |
| `stop` | Tentative de fin de run | oui | non | oui | oui |
| `subagent_start` | Avant lancement d'un sous-agent | oui | oui | oui | oui |
| `subagent_stop` | Fin d'un sous-agent | oui | non | oui | oui |

### 1.1 Détail par gate

#### `session_start`

- **Primitive native** : `SessionStart` (Claude), `SessionStart` (Codex), `on_session_start` plugin hook (Hermes)
- **Peut bloquer** : non — une session ne peut pas être empêchée d'ouvrir, mais son contexte est enrichi
- **Peut injecter contexte** : oui — charge `.planning/state.yaml`, `.planning/current-risk.yaml`, classe de risque courante, mode opératoire actif
- **Peut exiger preuve** : non — pas encore en phase d'exécution
- **Peut signaler violation** : oui — signale si état incohérent (phase inconnue, classe manquante, run orphelin)

#### `user_prompt`

- **Primitive native** : `UserPromptSubmit` (Claude), `UserPromptSubmit` (Codex), `pre_llm_call` plugin hook (Hermes)
- **Peut bloquer** : oui — bloque si le prompt demande une action interdite pour la classe courante (ex : bypass sur H/C)
- **Peut injecter contexte** : oui — ajoute la classe de risque, le mode autorisé, les gates actives, les activités transversales obligatoires
- **Peut exiger preuve** : non
- **Peut signaler violation** : oui — signale si le prompt contient une demande de bypass non autorisé

#### `pre_tool`

- **Primitive native** : `PreToolUse` (Claude), `PreToolUse` (Codex), `pre_tool_call` plugin hook (Hermes)
- **Peut bloquer** : oui — bloque toute écriture dans une zone interdite selon la phase courante
- **Peut injecter contexte** : oui — enrichit l'événement avec la zone d'écriture autorisée, la phase, le mode
- **Peut exiger preuve** : non — la preuve est collectée, pas encore évaluée
- **Peut signaler violation** : oui — signale écriture hors-zone, pattern interdit, accès privilégié non autorisé

#### `post_tool`

- **Primitive native** : `PostToolUse` (Claude), `PostToolUse` (Codex), `post_tool_call` plugin hook (Hermes)
- **Peut bloquer** : non pour l'action déjà exécutée — peut bloquer une finalisation future, forcer une route de correction, ou durcir l'état du run si le résultat contient un pattern interdit
- **Peut injecter contexte** : oui — persiste un événement de gate redigé et des références `evidenceAnchors`, sans ajouter de preuve acceptée
- **Peut exiger preuve** : oui — peut signaler qu'une preuve ou un ADR est requis ; ne collecte ni n'accepte automatiquement la preuve
- **Peut signaler violation** : oui — signale pattern interdit, écriture hors-zone effectuée, secret détecté

#### `pre_compact`

- **Primitive native** : `PreCompact` (Claude), `PreCompact` (Codex), `pre_compact` plugin hook (Hermes)
- **Peut bloquer** : oui — bloque/fail-closed si l'état planning requis est absent avant compaction
- **Peut injecter contexte** : oui — injecte un snapshot borné et redigé de la route, du risque, des gates actives et du contexte de reprise
- **Peut exiger preuve** : non — prépare la continuité de contexte, sans finaliser le run
- **Peut signaler violation** : oui — signale état illisible ou contexte de compaction incohérent

#### `post_compact`

- **Primitive native** : `PostCompact` (Claude), `PostCompact` (Codex), `post_compact` plugin hook (Hermes)
- **Peut bloquer** : non pour la compaction déjà effectuée — peut bloquer la suite du run si la route restaurée diverge sous M/H/C
- **Peut injecter contexte** : oui — réinjecte le contexte de route/risk courant après compaction
- **Peut exiger preuve** : non — vérifie la continuité plutôt que la suffisance de preuve
- **Peut signaler violation** : oui — signale mismatch run/phase/subphase/mode/risk fourni par le runtime

#### `stop`

- **Primitive native** : `Stop` (Claude), `Stop` (Codex), `on_session_end` plugin hook (Hermes)
- **Peut bloquer** : oui — bloque `DONE_VERIFIED` si l'Evidence Set est insuffisant pour la classe de risque
- **Peut injecter contexte** : non — stop est terminal
- **Peut exiger preuve** : oui — vérifie la suffisance de l'Evidence Set avant d'autoriser la transition vers un final state terminal
- **Peut signaler violation** : oui — signale `DONE_VERIFIED` prématuré, Evidence Set incomplet, gaps non documentés

#### `subagent_start`

- **Primitive native** : `SubagentStart` ou wrapper de spawn (Claude), aucun hook natif pour les lancements non maîtrisés Codex, aucun hook natif dans le profil exécutable Hermes v0.1
- **Peut bloquer** : selon capacité runtime — oui pour Claude, oui pour Codex seulement quand le harness possède le spawn, non pour les lancements non interceptables ; Hermes reste `supported=false` dans `runtime-profiles.ts`
- **Peut injecter contexte** : oui — transmet au sous-agent le scope autorisé, les fichiers accessibles, la classe de risque et les preuves attendues
- **Peut exiger preuve** : oui — enregistre le contrat de preuve attendu avant lancement
- **Peut signaler violation** : oui — signale lancement non autorisé, profondeur dépassée, scope absent

#### `subagent_stop`

- **Primitive native** : `SubagentStop` (Claude), no equivalent (Codex), `subagent_stop` plugin hook (Hermes)
- **Peut bloquer** : selon capacité runtime — oui pour Claude ; non pour Codex ; Hermes expose un événement observable mais non bloquant (`canBlock=false`)
- **Peut injecter contexte** : non — stop est terminal
- **Peut exiger preuve** : oui — le résultat d'un sous-agent doit remonter dans `.planning/run-set.json`
- **Peut signaler violation** : oui — signale sous-agent sans trace, résultat non versé dans l'Evidence Set, ou livrable déclaré absent

**Note Cycle 75 drift** : this section follows the executable profile in
`packages/core/src/runtime/runtime-profiles.ts`. Future Hermes plugin or gateway support remains a
candidate extension until it appears in that profile with accepted runtime proof.

---

## 2. Sémantique des gates

### 2.1 `pre_tool` — contrôle des permissions d'écriture par subphase

`pre_tool` est la gate pré-action principale : elle injecte le contexte nécessaire et bloque avant exécution les actions interdites. Elle lit le `MacroCycle` et la `SubPhase` courants dans `.planning/state.yaml` et la classe de risque dans `.planning/current-risk.yaml`, puis applique la matrice suivante :

| SubPhase courante | Zones d'écriture autorisées | Zones interdites |
|---|---|---|
| Observer | `.planning/01-discovery/`, `.planning/09-logs/` | `src/`, `tests/`, `docs/` (hors note discovery) |
| Define | `.planning/02-backlog/`, `.planning/09-logs/` | `src/`, `migrations/`, `auth/` |
| Design | `docs/13-decisions/`, `.planning/04-conception/`, `.planning/09-logs/` | `src/`, `migrations/` |
| Execute | `src/`, `tests/`, `.planning/09-logs/` | `docs/` (hors inline doc), `migrations/` (sauf classe H approuvée) |
| Verify | `tests/`, `.planning/05-validation/`, `.planning/09-logs/` | `src/` |
| Capitalize | `.planning/06-release/`, `releases/`, `.planning/09-logs/` | `src/`, `tests/` |
| Transmit | `docs/`, `.planning/08-learning/`, `.planning/09-logs/` | `src/`, `tests/` |

Violation de zone : `HARD_BLOCK` pour H/C, `WARN` pour T/L/M avec enregistrement dans `.planning/run-set.json`.

### 2.2 `post_tool` — détection de patterns interdits

`post_tool` inspecte le résultat de chaque outil pour les patterns suivants. Il ne peut pas annuler l'action outil déjà effectuée ; il enregistre et évalue l'output, peut bloquer une future finalisation `stop`, et peut router le run vers une correction.

| Pattern | Détection | Effet PFV4 |
|---|---|---|
| Secret en clair (clé API, token, mot de passe) | Regex + gitleaks intégré | Marque le run `BLOCKED_POLICY`, bloque `stop` tant que non corrigé |
| Bypass de gate explicite (`--no-verify`, override forcé) | Signature de commande | Marque violation, bloque `stop` si H/C |
| Écriture hors-zone effectuée malgré `pre_tool` | Diff de fichiers touchés | Marque violation, bloque `stop` si H/C, `WARN` si T/L |
| Migration DB sans expand/contract documenté | Nom de fichier dans `migrations/` sans ADR lié | Marque le run `BLOCKED_POLICY`, bloque `stop` toutes classes |
| Assertion-bearing artifact sans bloc `Falsifies-If:` | Path dans `docs/business-model/` (hors `research-*`/`verification-*`), `docs/decisions/`, ou frontmatter `claim-bearing: true` ; absence du bloc dans le corps post-écriture | Marque le run `BLOCKED_POLICY`, bloque `stop` toutes classes (voir §8.4) |
| `DONE_VERIFIED` avant Evidence Set suffisant | Texte dans output agent | Bloque `stop` toutes classes |

Les violations critiques détectées après action sont persistées dans le payload `GATE_EVALUATED`
sous `policyEvent` avec `source: "post_tool"`, `status: "unresolved"`, `severity: "critical"`,
le type de violation, et `resolvableByEvidence` lorsque des preuves acceptées ultérieures peuvent
lever le blocage. Les fichiers Markdown claim-bearing avec un `Falsifies-If` valide exposent aussi
leurs références sous `evidenceAnchors`; ces références ne créent jamais de preuve acceptée par
elles-mêmes.

### 2.3 `stop` — suffisance de l'Evidence Set

`stop` évalue l'Evidence Set contre les exigences minimales de la classe de risque courante. La règle est absolue :

```
Pas de DONE_VERIFIED sans Evidence Set suffisant.
```

Un Evidence Set insuffisant produit un final state `DONE_WITH_GAPS` (autorisé si les gaps sont documentés) ou `BLOCKED_POLICY` (si un item obligatoire est absent).

### 2.4 `subagent_start` — autorisation du scope de sous-agent

`subagent_start` autorise le lancement d'un sous-agent avant exécution. Il exige un `agentId`,
une tâche explicite, un scope de fichiers, une profondeur portable (`depth <= 1`) et un contrat de
preuve (`expectedEvidenceKeys` ou livrables attendus). Si le lancement déclare une classe de risque
inférieure à la route courante, la gate bloque avec `CLASS_UNDERESTIMATED`. Si le scope sort des
zones autorisées pour la sous-phase courante, la gate bloque avec `FORBIDDEN_WRITE_ZONE`.

Quand la gate autorise le lancement, le runtime persiste un événement redigé et un enregistrement
`runSet.subagents[]` en statut `requested`. Cet enregistrement capture le scope, les livrables
attendus, la tâche et les clés d'évidence attendues ; il ne crée pas d'évidence acceptée dans
`runSet.evidence`. `subagent_stop` reste responsable de valider la trace réelle et les livrables.

### 2.5 `subagent_stop` — traçabilité des résultats de sous-agents

Tout résultat de sous-agent doit être versé explicitement dans `.planning/run-set.json`. Un sous-agent qui termine sans trace visible est une violation : son résultat devient une mémoire implicite invisible, incompatible avec le principe de traçabilité du RMS.

Si le run-set déclare des livrables pour le sous-agent, `subagent_stop` vérifie aussi que
chaque chemin déclaré existe sous la racine projet. Un chemin vide, absolu, qui sort de la
racine projet, ou un fichier absent produit `SUBAGENT_DELIVERABLES_MISSING` et bloque la gate.
Le hook peut recevoir les mêmes chemins via `deliverables`, `expectedDeliverables`, ou
`expected_deliverables`, mais le run-set reste la surface d'autorité.

---

## 3. Modèle d'implémentation

### 3.1 Interface générale

Chaque gate est un script TypeScript exécuté via `harness hook <GateType>`. Il reçoit un événement JSON sur stdin, produit une décision JSON sur stdout, et met à jour les fichiers d'état stricts : `.planning/state.yaml`, `.planning/current-risk.yaml`, `.planning/run-set.json`.

```
stdin  → { event: GateEvent }
stdout ← { decision: GateDecision }
side-effect → .planning/run-set.json (run event/evidence update)
```

### 3.2 Flux de traitement

```
[plateforme] → harness hook <gate> → stdin
                                        │
                              ┌─────────▼──────────┐
                              │  1. Lire état       │
                              │  .planning/state.yaml         │
                              │  .planning/current-risk.yaml  │
                              │  .planning/run-set.json       │
                              └─────────┬──────────┘
                                        │
                              ┌─────────▼──────────┐
                              │  2. Évaluer policy  │
                              │  evaluateGate(...)  │
                              └─────────┬──────────┘
                                        │
                              ┌─────────▼──────────┐
                              │  3. Produire        │
                              │  allow/block/warn   │
                              │  + reason           │
                              └─────────┬──────────┘
                                        │
                              ┌─────────▼──────────┐
                              │  4. Mettre à jour   │
                              │  run-set.json       │
                              └─────────┬──────────┘
                                        │
                                     stdout
                                  ← GateDecision
```

### 3.3 Format de l'événement entrant

```typescript
interface GateEvent {
  gateType: GateType;
  timestamp: string;            // ISO 8601 UTC
  runId: string;
  riskClass: RiskClass;
  phase: MacroCycle;
  subPhase: SubPhase;
  mode: OperatingMode;
  toolName?: string;            // pre_tool / post_tool uniquement
  toolInput?: unknown;          // pre_tool uniquement
  toolOutput?: unknown;         // post_tool uniquement
  agentId?: string;             // subagent_stop uniquement
  evidenceSummary?: EvidenceSummary; // stop / subagent_stop uniquement
}
```

### 3.4 Format de la décision sortante

```typescript
interface GateDecision {
  gateType: GateType;
  verdict: "allow" | "block" | "warn";
  reason: string;               // Message human-readable
  violationType?: ViolationType;
  finalState?: FinalState;      // stop uniquement
  injectedContext?: Record<string, unknown>; // si can-inject-context
  timestamp: string;
}
```

### 3.5 Entrée dans `.planning/run-set.json`

```jsonc
{
  "ts": "2026-05-03T14:32:00.000Z",
  "gate": "pre_tool",
  "verdict": "block",
  "runId": "run-abc123",
  "riskClass": "H",
  "phase": "Execute",
  "reason": "Écriture dans migrations/ détectée sans ADR lié — classe H requiert plan expand/contract documenté",
  "violationType": "FORBIDDEN_WRITE_ZONE",
  "toolName": "Write",
  "toolInput": { "file_path": "src/migrations/0042_add_sessions.sql" }
}
```

### 3.6 Contrat de stockage strict

Ces trois fichiers sont le contrat physique PFV4 dans cette spec :

| Fichier | Rôle | Écriture par gates |
|---|---|---|
| `.planning/state.yaml` | `MacroCycle`, `SubPhase`, statut courant, compteur de WARN, dernière violation, mode opératoire | `session_start`, `user_prompt`, `pre_tool`, `post_tool`, `stop` |
| `.planning/current-risk.yaml` | `RiskClass` courante, signaux de forçage actifs, justification de classification | `session_start`, `user_prompt`, `pre_tool` |
| `.planning/run-set.json` | Runs, événements, preuves, contrats et résultats de sous-agents | toutes gates |

Tout autre fichier de run, d'évidence, d'événements ou de registry est hors contrat physique pour cette specification.

---

## 4. Règles de politique par classe de risque

### 4.1 Matrice complète

| Dimension | T (Trivial) | L (Low) | M (Medium) | H (High) | C (Critical) |
|---|---|---|---|---|---|
| **Gates obligatoires** | post_tool (secrets) | pre_tool + post_tool | pre_tool + post_tool + stop | toutes | toutes |
| **Evidence minimale** | CI verts | CI verts + review ≥1 | CI + review + tests intégration + validation produit | CI + review ≥2 + DAST + ADR + threat model + canary plan + rollback testé | tout H + AIPD + audit sécurité + tests charge + rollback répété + log validation humaine |
| **Approbation requise** | aucune | review automatique ou humain ≥1 | humain ≥1 | humain ≥2 (ou solo+agent antagoniste tracé) + validation explicite avant merge | humain ≥2 + signature explicite + log horodaté |
| **Modes autorisés** | bypass, auto, pairing | bypass (conditions RED-04), auto, pairing | auto, pairing ; bypass interdit | auto (checkpoints + visibilité complète + validation humaine), pairing ; bypass interdit | auto (checkpoints + visibilité complète + validation humaine), pairing ; bypass interdit absolu |
| **Profondeur de cycle** | Chemin court (secondes–minutes) | Chemin allégé (minutes–heures) | Chemin standard (heures) | Chemin renforcé (heures–jours) | Chemin maximal (jours) |
| **Tests requis** | Tests existants verts | Tests unitaires + intégration nouveaux | Pyramide/Trophée + mutation testing ○ | Pyramide + E2E + mutation >70 % zones critiques + contrats inter-services | Tout H + property-based + charge + fuzzing endpoints |
| **Review requise** | ◔ self-review | ≥1 reviewer ou checklist | ≥1 reviewer + checklist complète | ≥2 reviewers (ou solo + agent antagoniste tracé) | ≥2 reviewers + signature + revue sécurité indépendante |
| **Stratégie déploiement** | Direct | Direct | Canary 10 % | Canary 5 %→25 %→50 %→100 % + gates SLO | Canary + feature flag obligatoire + communication parties prenantes |

### 4.2 Activités transversales obligatoires par classe

| Activité | T | L | M | H | C |
|---|:---:|:---:|:---:|:---:|:---:|
| SAST + SCA + secrets scan (CI) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Threat modeling STRIDE | — | — | ○ | ✅ | ✅ |
| DAST sur preprod | — | — | ○ | ✅ | ✅ |
| SBOM généré | ◔ | ✅ | ✅ | ✅ | ✅ |
| SLSA provenance + signature | — | — | — | ✅ | ✅ |
| ADR documenté | — | ◔ | ○ | ✅ | ✅ |
| AIPD / DPIA | — | — | ≈ si données perso | ✅ si PII | ✅ |
| axe-core CI (si UI) | ◔ | ✅ | ✅ | ✅ | ✅ |
| Tests de charge (staging) | — | — | — | ✅ | ✅ |
| Feature flag | — | ○ | ○ | ✅ | ✅ |
| Plan de rollback testé | implicite | ✅ | ✅ | ✅ tracé | ✅ tracé + répété |
| Log validation humaine | — | — | — | ✅ | ✅ + signature |

### 4.3 Signaux de forçage de classe (non négociables)

Ces signaux surclassent toute estimation manuelle. Ils sont détectés automatiquement par `pre_tool` sur les chemins de fichiers touchés.

| Signal détecté (chemin ou pattern) | Classe minimale forcée |
|---|---|
| `auth/`, `authorization/`, `sessions/`, `*.session.*` | H |
| `payment/`, `billing/`, `stripe/`, `checkout/` | H |
| `migrations/`, `schema/`, `*.migration.*`, `*.schema.*` | H |
| `api/public/`, `openapi.yaml`, contrat inter-services | H |
| `infra/`, `terraform/`, `k8s/`, `.env.production` | H |
| champ `pii`, `email`, `phone`, `address`, `personal_data` dans diff | H |
| `health/`, `biometric/`, `medical/`, `financial/regulated/` | C |
| diff touchant ≥ 3 services distincts | C |
| keyword `refonte`, `strangler`, `big-bang`, `architecture-pivot` dans message commit | C |
| fichier de compliance RGPD, NIS2, EAA, DORA financier | C |

---

## 5. Hard-block vs Warning

### 5.1 Principe directeur

```
H/C violations → toujours HARD_BLOCK
T/L violations → WARN par défaut (sauf secrets et bypass explicite)
M violations → WARN si première occurrence, HARD_BLOCK si récidive dans le même run
```

### 5.2 Matrice hard-block / warning

| Violation | T | L | M | H | C |
|---|:---:|:---:|:---:|:---:|:---:|
| Secret en clair détecté | BLOCK | BLOCK | BLOCK | BLOCK | BLOCK |
| Écriture hors-zone de phase | WARN | WARN | WARN | BLOCK | BLOCK |
| Bypass tenté sans autorisation | WARN | WARN | BLOCK | BLOCK | BLOCK |
| Evidence Set insuffisant au stop | WARN | WARN | BLOCK | BLOCK | BLOCK |
| Migration DB sans ADR/expand-contract | BLOCK | BLOCK | BLOCK | BLOCK | BLOCK |
| Sous-agent sans trace dans Evidence Set | WARN | WARN | WARN | BLOCK | BLOCK |
| Livrable déclaré de sous-agent absent | BLOCK | BLOCK | BLOCK | BLOCK | BLOCK |
| Validation humaine absente avant merge | — | — | WARN | BLOCK | BLOCK |
| Signal de forçage ignoré (classe sous-estimée) | — | WARN | WARN | BLOCK | BLOCK |
| Pattern interdit dans output (DONE sans preuve) | BLOCK | BLOCK | BLOCK | BLOCK | BLOCK |
| Assertion-bearing artifact sans `Falsifies-If:` | BLOCK | BLOCK | BLOCK | BLOCK | BLOCK |

### 5.3 Comportement sur WARN

Un WARN ne bloque pas l'action, mais :
1. Enregistre l'événement dans `.planning/run-set.json` avec `verdict: "warn"`
2. Incrémente le compteur `warn_count` dans `.planning/state.yaml`
3. Si `warn_count` dépasse le seuil par run (défaut : 5), déclenche une escalade automatique
4. Le final state `DONE_VERIFIED` reste possible avec WARNs documentés, mais est déclassé en `DONE_WITH_GAPS`

---

## 6. Conditions de bypass

### 6.1 Définition du bypass

Le bypass est le mode où l'agent fait tout sans validation humaine active. Il est distinct du bypass de gate (contournement d'une vérification spécifique). Les deux sont régis par des règles différentes.

### 6.2 Bypass de mode opératoire

| Classe | Bypass autorisé | Conditions |
|---|:---:|---|
| T | oui | Aucune condition supplémentaire |
| L | oui (conditionnel) | CI 100 % verts + aucun signal de forçage + diff < 100 lignes + aucune modification dans `auth/`, `migrations/`, `payments/`, `.env*`, `config/security*` + pas de nouveaux endpoints exposés |
| M | non | Bypass interdit — mode `auto` ou `pairing` obligatoire |
| H | non | Bypass interdit — validation humaine obligatoire avant merge |
| C | non (absolu) | Bypass absolument interdit, quelle que soit la confiance dans l'agent |

### 6.3 Bypass de gate individuelle

Un gate individuel peut être contourné uniquement dans les cas suivants :

| GateType | Bypass autorisé | Condition | Enregistrement requis |
|---|:---:|---|:---:|
| `session_start` | jamais | — | — |
| `user_prompt` | T/L uniquement | Mode bypass autorisé actif | Oui — `.planning/run-set.json` |
| `pre_tool` | T/L uniquement | Mode bypass actif + pas de signal de forçage | Oui — `.planning/run-set.json` |
| `post_tool` (secrets) | jamais | — | — |
| `post_tool` (autres) | T/L uniquement | Mode bypass actif | Oui — `.planning/run-set.json` |
| `pre_compact` | jamais | La continuité de contexte doit être capturée avant compaction | — |
| `post_compact` | jamais | La continuité de route/run doit être vérifiée après compaction | — |
| `stop` | jamais | L'Evidence Set reste toujours évalué | — |
| `subagent_start` | jamais | Tout lancement de sous-agent doit être autorisé | — |
| `subagent_stop` | jamais | Toute trace de sous-agent doit remonter | — |

### 6.4 Override HUMAN avec garde-fou M

La classe M peut recevoir un `HUMAN_OVERRIDE` explicite dans des circonstances documentées (urgence de production, hotfix critique). Conditions :

1. Le développeur saisit un message de justification (≥ 20 caractères)
2. L'override est enregistré dans `.planning/run-set.json` avec timestamp, justification et identifiant session
3. Un item de dette est automatiquement créé dans `.planning/02-backlog/tech-debt/`
4. L'audit aléatoire hebdomadaire est déclenché pour ce run

H/C ne supportent pas `HUMAN_OVERRIDE` — seul un gate bloque définitivement.

---

## 7. Protocole d'escalade

### 7.1 Déclencheurs d'escalade

| Déclencheur | Seuil | Action |
|---|---|---|
| HARD_BLOCK en H/C | 1 occurrence | Pause du run + notification développeur + final state = `BLOCKED_POLICY` |
| WARN count > seuil | 5 WARNs par run | Escalade automatique vers développeur + événement dans `.planning/run-set.json` |
| Promotion de classe détectée | Signal de forçage découvert en cours de run | Pause PR + re-classification + log dans `escalation_history` |
| Evidence Set insuffisant au stop | Tout item obligatoire absent | Blocage stop + description des items manquants |
| Sous-agent sans trace | Tout subagent_stop sans evidence | WARN sous H, BLOCK en H/C |
| Livrable sous-agent absent | Tout deliverable déclaré absent ou hors racine projet | BLOCK + chemin explicite |
| Secret détecté | Toute occurrence | BLOCK immédiat + alert développeur |

### 7.2 Qui est notifié

Le harness n'envoie pas de notifications push (pas de daemon). La notification est :
1. **Synchrone** : le verdict `block` renvoyé à la plateforme arrête l'action et affiche la raison dans l'interface
2. **Persistée** : enregistrée dans `.planning/run-set.json` et dans `.planning/state.yaml` (`last_violation`)
3. **Consultable** : `harness status` affiche les violations actives du run courant

### 7.3 Ce qui se passe au run après une violation H/C

```
HARD_BLOCK H/C
  │
  ├── Final state intermédiaire : BLOCKED_POLICY
  ├── .planning/state.yaml mis à jour : { "status": "blocked", "blocked_by": "<gate>", "reason": "..." }
  ├── .planning/run-set.json : événement avec détail
  │
  └── Le run ne peut reprendre que si :
        1. La violation est corrigée (preuve ajoutée, zone respectée, etc.)
        2. Le développeur relance `harness hook <gate>` avec l'événement corrigé
        3. Le gate réévalue et retourne `allow`
```

### 7.4 Promotion de classe en cours de run

Format d'événement obligatoire dans `.planning/run-set.json` :

```jsonc
{
  "ts": "2026-05-05T14:32:00.000Z",
  "type": "class_escalation",
  "runId": "run-abc123",
  "from_class": "L",
  "to_class": "H",
  "trigger": "Fichier auth/session.ts modifié dans commit abc123 — signal de forçage auth/ actif",
  "detected_by": "pre_tool_gate",
  "action": "run_paused — ADR + threat model requis avant reprise",
  "new_mandatory_gates": ["all"],
  "new_mandatory_evidence": ["adr", "threat_model", "dast_report", "canary_plan", "rollback_plan"]
}
```

---

## 8. Exigences de preuve par gate

### 8.1 Evidence Set minimum par classe — évalué par `stop`

| Item de preuve | T | L | M | H | C |
|---|:---:|:---:|:---:|:---:|:---:|
| CI verts (lint, types, tests unitaires) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tests d'intégration passants | — | ✅ | ✅ | ✅ | ✅ |
| Tests E2E sur parcours critiques | — | — | ○ | ✅ | ✅ |
| SAST sans finding Critical/High | ✅ | ✅ | ✅ | ✅ | ✅ |
| SCA sans CVE Critical/High non triée | ✅ | ✅ | ✅ | ✅ | ✅ |
| Secrets scan propre | ✅ | ✅ | ✅ | ✅ | ✅ |
| Review ≥1 (trace dans evidence) | — | ✅ | ✅ | ✅ | ✅ |
| Review ≥2 ou solo+agent antagoniste tracé | — | — | — | ✅ | ✅ |
| ADR référencé dans evidence | — | — | ○ | ✅ | ✅ |
| Threat model (STRIDE) complété | — | — | — | ✅ | ✅ |
| DAST report (staging) | — | — | — | ✅ | ✅ |
| AIPD / DPIA si PII impliquées | — | — | ≈ | ✅ | ✅ |
| Plan canary documenté | — | — | — | ✅ | ✅ |
| Rollback plan testé | — | — | — | ✅ | ✅ (répété) |
| Log validation humaine horodatée | — | — | — | ✅ | ✅ |
| SBOM généré | — | ✅ | ✅ | ✅ | ✅ |
| SLSA provenance + signature artefact | — | — | — | ✅ | ✅ |
| Tests de charge (staging) | — | — | — | ✅ | ✅ |
| Audit sécurité indépendant | — | — | — | — | ✅ |
| Log signature humaine explicite | — | — | — | — | ✅ |

### 8.2 Structure minimale de l'Evidence Set pour `DONE_VERIFIED`

```jsonc
{
  "runId": "run-abc123",
  "riskClass": "H",
  "completedAt": "2026-05-03T18:00:00.000Z",
  "ciResults": {
    "lint": "pass",
    "typecheck": "pass",
    "unitTests": "pass",
    "integrationTests": "pass",
    "e2eTests": "pass",
    "sast": "pass",
    "sca": "pass",
    "secretsScan": "pass",
    "sbom": "generated"
  },
  "securityArtifacts": {
    "threatModelRef": "docs/13-decisions/threat-model-auth-v2.md",
    "dastReport": ".planning/05-validation/dast-report-2026-05-03.html",
    "slsaProvenance": "releases/run-abc123/provenance.json",
    "cosignSignature": "releases/run-abc123/artifact.sig"
  },
  "reviewEvidence": {
    "reviewer1": "developer-self-review-2026-05-02",
    "reviewer2": "agent-antagonist-trace-2026-05-03"
  },
  "humanValidation": {
    "validatedBy": "developer",
    "validatedAt": "2026-05-03T17:55:00.000Z",
    "signature": "sha256:abcdef..."
  },
  "deploymentPlan": {
    "strategy": "canary",
    "stages": ["5%", "25%", "50%", "100%"],
    "rollbackPlan": ".planning/06-release/rollback-plan-run-abc123.md",
    "rollbackTested": true
  },
  "gaps": [],
  "confidenceLevel": "high"
}
```

### 8.3 Ce que `subagent_stop` exige

Un sous-agent doit verser dans `.planning/run-set.json` au minimum :
- Son `agentId` et `runId` parent
- La tâche accomplie (description en 1 ligne)
- Les fichiers modifiés (liste)
- Les livrables déclarés, quand la tâche en promet
- Le résultat de vérification (commande lancée + exit code)
- Les décisions prises (si revieweur ou threat-modeler)

### 8.4 Bloc `Falsifies-If:` pour artefacts à assertions

Les artefacts qui portent des assertions externes — claims publics, bets stratégiques, conclusions d'analyse, décisions architecturales — doivent inclure un bloc `Falsifies-If:` à proximité de chaque assertion. Cette règle bascule la documentation en gouvernance : sans falsifieur explicite, une assertion n'est pas un engagement, c'est une opinion.

**Périmètre — fichiers concernés** :
- `docs/business-model/*.md` (sauf `research-*` et `verification-*` qui sont déjà fact-anchored)
- `docs/decisions/*.md` (tous les ADR)
- Tout fichier hors de ces paths portant en frontmatter `claim-bearing: true`

**Format du bloc** :

```yaml
Falsifies-If:
  kill-condition: <métrique observable, événement, ou état futur qui invalide l'assertion>
  checkpoint-date: <YYYY-MM-DD — date à laquelle le falsifieur doit être ré-évalué>
  evidence-anchor: <référence file:line ou URL vers la donnée qui démontre ou réfute l'assertion>
  on-fail: <action requise si la kill-condition se réalise : pivot / amend / retract>
```

**Exemple** — pour une assertion comme « le harness occupe un gap qu'aucun produit ne comble » :

```yaml
Falsifies-If:
  kill-condition: Apparition d'un produit avec ≥3 des 4 traits (session-scoped risk classification + evidence-based gates + multi-runtime portability + compliance artifact generation) en GA, avant 2026-12-31
  checkpoint-date: 2026-09-01
  evidence-anchor: docs/business-model/verification-02-competitive-matrix.md:20
  on-fail: amend positioning — moat narrows to "depth of integrated quality discipline" only
```

**Validation par le gate `post_tool`** : à chaque écriture dans un fichier du périmètre, le gate parse le contenu pour la présence d'au moins un bloc `Falsifies-If:` valide (kill-condition + checkpoint-date + evidence-anchor non vides, on-fail présent). Absence ou bloc incomplet → violation `MISSING_FALSIFIES_IF` → blocage de `stop`. Détection minimale : présence littérale de la chaîne `Falsifies-If:` suivie des 4 champs nommés dans le fichier post-écriture.

**Resolve check obligatoire sur `evidence-anchor`** : lorsque l'ancre pointe vers le dépôt local, le gate vérifie syntaxiquement que la cible existe. Pour `path/to/file.md`, le fichier doit exister. Pour `path/to/file.md:20` ou `path/to/file.md:20-30`, le fichier doit exister et la ligne ou plage doit être incluse dans la longueur réelle du fichier. Pour une référence de section (`path/to/file.md §8.4`), le fichier doit exister et la section doit être retrouvée par recherche textuelle. Une ancre locale qui ne résout pas vers du contenu réel est traitée comme `MISSING_FALSIFIES_IF`, car elle rend le falsifieur non vérifiable.

**Évaluation par le gate `stop`** : le `stop` du run vérifie que toutes les `checkpoint-date` passées dans les fichiers du périmètre ont été ré-évaluées (preuve = commit récent ≤ 30 jours sur le fichier OU entrée dans `.planning/run-set.json` de type `falsifies_if_review`). Une date passée sans ré-évaluation → `WARN` (T/L), `BLOCK` (M/H/C).

**Anti-patterns** :
- Bloc présent mais champ `kill-condition` vide ou tautologique ("si on échoue", "si ça ne marche pas") → `MISSING_FALSIFIES_IF`
- `checkpoint-date` en futur indéfini (>12 mois sans étape intermédiaire) → `WARN`
- `evidence-anchor` local inexistant, ligne hors plage, ou section introuvable → `MISSING_FALSIFIES_IF`
- `evidence-anchor` pointant vers une référence externe non-versionnée (URL marketing, blog, tweet) → `WARN`
- `on-fail` = "we'll figure it out" ou équivalent non actionnable → `WARN`

**Rationale** : cette règle est la couche de gouvernance qui empêche le harness lui-même de produire ses propres claims non falsifiables. Sans elle, la promesse "evidence-based completion" du harness s'arrête à la frontière de ses propres documents stratégiques — incohérence rédhibitoire pour un produit qui vend la discipline d'evidence.

---

## 9. Format logique des politiques

Ces schémas sont des structures logiques embarquées ou sérialisées dans `.planning/run-set.json` selon l'implémentation. Ils ne définissent aucun fichier de registry physique.

### 9.1 Catalogue logique des gates

```yaml
# Catalogue canonique des gates RMS — version 1
# Ne pas modifier sans ADR correspondant

version: "1"
gates:
  session_start:
    description: "Enrichit le contexte au démarrage de session"
    canBlock: false
    canInjectContext: true
    canRequireEvidence: false
    canSignalViolation: true
    bindings:
      claude: { primitive: hook, event: SessionStart }
      codex:  { primitive: hook, event: SessionStart }
      hermes: { primitive: plugin_hook, event: on_session_start }

  user_prompt:
    description: "Contrôle les demandes de bypass et enrichit le contexte de risque"
    canBlock: true
    canInjectContext: true
    canRequireEvidence: false
    canSignalViolation: true
    bindings:
      claude: { primitive: hook, event: UserPromptSubmit }
      codex:  { primitive: hook, event: UserPromptSubmit }
      hermes: { primitive: plugin_hook, event: pre_llm_call }

  pre_tool:
    description: "Contrôle les permissions d'écriture par phase et détecte les signaux de forçage"
    canBlock: true
    canInjectContext: true
    canRequireEvidence: false
    canSignalViolation: true
    bindings:
      claude: { primitive: hook, event: PreToolUse }
      codex:  { primitive: hook, event: PreToolUse }
      hermes: { primitive: plugin_hook, event: pre_tool_call }

  post_tool:
    description: "Détecte les patterns interdits et signale les preuves requises sans les collecter ni les accepter automatiquement"
    canBlock: false
    canBlockFutureFinalization: true
    canInjectContext: true
    canRequireEvidence: true
    canSignalViolation: true
    bindings:
      claude: { primitive: hook, event: PostToolUse }
      codex:  { primitive: hook, event: PostToolUse }
      hermes: { primitive: plugin_hook, event: post_tool_call }

  stop:
    description: "Évalue la suffisance de l'Evidence Set avant DONE_VERIFIED"
    canBlock: true
    canInjectContext: false
    canRequireEvidence: true
    canSignalViolation: true
    bindings:
      claude: { primitive: hook, event: Stop }
      codex:  { primitive: hook, event: Stop }
      hermes: { primitive: plugin_hook, event: on_session_end }

  subagent_start:
    description: "Autorise un sous-agent avant lancement avec agent, tâche, scope, profondeur et contrat de preuve explicites"
    canBlock: true
    canInjectContext: true
    canRequireEvidence: true
    canSignalViolation: true
    bindings:
      claude: { primitive: hook_or_wrapper, event: SubagentStart }
      codex:  { primitive: wrapper, event: no_equivalent }
      hermes: { primitive: plugin_hook, event: subagent_start }

  subagent_stop:
    description: "Vérifie que le résultat du sous-agent est versé dans l'Evidence Set et que ses livrables déclarés existent"
    canBlock: true
    canInjectContext: false
    canRequireEvidence: true
    canSignalViolation: true
    bindings:
      claude: { primitive: hook, event: SubagentStop }
      codex:  { primitive: hook, event: no_equivalent }
      hermes: { primitive: plugin_hook, event: subagent_stop }
```

### 9.2 Matrice logique des politiques

```yaml
# Politiques de gate par classe de risque — version 1
# Matrice T/L/M/H/C — source : risk-classification.md §8

version: "1"

# Seuil global de WARNs avant escalade automatique
warnThreshold: 5

classes:
  T:
    label: "Trivial"
    mandatoryGates: [post_tool]
    mandatoryEvidenceItems: [ci_green, sast_clean, secrets_clean]
    requiredApprovals: 0
    allowedModes: [bypass, auto, pairing]
    maxCycleDepth: short
    bypassAllowed: true
    bypassConditions: []
    humanValidationRequired: false
    deploymentStrategy: direct
    hardBlockViolations:
      - SECRET_IN_PLAINTEXT
      - MIGRATION_WITHOUT_ADR
      - DONE_WITHOUT_EVIDENCE

  L:
    label: "Low"
    mandatoryGates: [pre_tool, post_tool, stop]
    mandatoryEvidenceItems: [ci_green, sast_clean, secrets_clean, integration_tests, review_1, sbom]
    requiredApprovals: 1
    allowedModes: [bypass, auto, pairing]
    maxCycleDepth: light
    bypassAllowed: true
    bypassConditions:
      - ci_all_green
      - no_force_signal_detected
      - diff_lines_lt_100
      - no_restricted_path_touched
      - no_new_public_endpoints
    humanValidationRequired: false
    deploymentStrategy: direct
    hardBlockViolations:
      - SECRET_IN_PLAINTEXT
      - MIGRATION_WITHOUT_ADR
      - DONE_WITHOUT_EVIDENCE

  M:
    label: "Medium"
    mandatoryGates: [pre_tool, post_tool, stop]
    mandatoryEvidenceItems:
      - ci_green
      - sast_clean
      - secrets_clean
      - integration_tests
      - review_1
      - sbom
      - product_validation
    requiredApprovals: 1
    allowedModes: [auto, pairing]
    maxCycleDepth: standard
    bypassAllowed: false
    bypassConditions: []
    humanValidationRequired: false
    humanOverrideAllowed: true  # HUMAN_OVERRIDE avec justification + dette auto-créée
    deploymentStrategy: canary_10pct
    hardBlockViolations:
      - SECRET_IN_PLAINTEXT
      - MIGRATION_WITHOUT_ADR
      - DONE_WITHOUT_EVIDENCE
      - BYPASS_ATTEMPTED
      - FORBIDDEN_WRITE_ZONE_REPEAT

  H:
    label: "High"
    mandatoryGates: [session_start, user_prompt, pre_tool, post_tool, stop, subagent_start, subagent_stop]
    mandatoryEvidenceItems:
      - ci_green
      - sast_clean
      - secrets_clean
      - integration_tests
      - e2e_tests
      - review_2_or_antagonist
      - adr
      - threat_model_stride
      - dast_report
      - sbom
      - slsa_provenance
      - cosign_signature
      - canary_plan
      - rollback_plan_tested
      - human_validation_log
    requiredApprovals: 2
    allowedModes: [auto, pairing]
    checkpointRequired: true  # when mode=auto AND risk_class IN [H, C], user checkpoint is mandatory before merge
    fullVisibilityRequired: true
    humanValidationRequired: true
    maxCycleDepth: reinforced
    bypassAllowed: false
    bypassConditions: []
    humanOverrideAllowed: false
    deploymentStrategy: canary_progressive_slo_gated
    hardBlockViolations:
      - SECRET_IN_PLAINTEXT
      - MIGRATION_WITHOUT_ADR
      - DONE_WITHOUT_EVIDENCE
      - BYPASS_ATTEMPTED
      - FORBIDDEN_WRITE_ZONE
      - MISSING_HUMAN_VALIDATION
      - SUBAGENT_WITHOUT_TRACE

  C:
    label: "Critical"
    mandatoryGates: [session_start, user_prompt, pre_tool, post_tool, stop, subagent_start, subagent_stop]
    mandatoryEvidenceItems:
      - ci_green
      - sast_clean
      - secrets_clean
      - integration_tests
      - e2e_tests
      - review_2_with_signature
      - adr
      - threat_model_stride
      - threat_model_linddun  # si privacy
      - aipd
      - dast_report
      - load_tests
      - independent_security_audit
      - sbom
      - slsa_provenance
      - cosign_signature
      - canary_plan
      - rollback_plan_repeated
      - human_signature_log
    requiredApprovals: 2
    allowedModes: [auto, pairing]
    checkpointRequired: true  # when mode=auto AND risk_class IN [H, C], user checkpoint is mandatory before merge
    fullVisibilityRequired: true
    humanValidationRequired: true
    maxCycleDepth: maximal
    bypassAllowed: false  # absolu
    bypassConditions: []
    humanOverrideAllowed: false
    deploymentStrategy: canary_with_feature_flag_and_stakeholder_comms
    hardBlockViolations:
      - SECRET_IN_PLAINTEXT
      - MIGRATION_WITHOUT_ADR
      - DONE_WITHOUT_EVIDENCE
      - BYPASS_ATTEMPTED
      - FORBIDDEN_WRITE_ZONE
      - MISSING_HUMAN_VALIDATION
      - SUBAGENT_WITHOUT_TRACE
      - MISSING_AIPD
      - MISSING_INDEPENDENT_AUDIT
```

---

## 10. API TypeScript

### 10.1 Types

```typescript
// packages/core/src/gates/types.ts

export type GateType =
  | "session_start"
  | "user_prompt"
  | "pre_tool"
  | "post_tool"
  | "pre_compact"
  | "post_compact"
  | "stop"
  | "subagent_start"
  | "subagent_stop";

export type RiskClass = "T" | "L" | "M" | "H" | "C";

export type OperatingMode =
  | "bypass"
  | "auto"
  | "pairing";

export type MacroCycle =
  | "discovery"
  | "cadrage"
  | "conception"
  | "build"
  | "validation"
  | "release"
  | "run"
  | "learning";

export type SubPhase =
  | "Observer"
  | "Define"
  | "Design"
  | "Execute"
  | "Verify"
  | "Capitalize"
  | "Transmit";

export type FinalState =
  | "DONE_VERIFIED"
  | "DONE_WITH_GAPS"
  | "BLOCKED_NEEDS_USER"
  | "BLOCKED_RUNTIME_MISSING"
  | "BLOCKED_POLICY"
  | "MAX_ATTEMPTS_REACHED"
  | "LOOP_DETECTED"
  | "CANCELLED";

export type ViolationType =
  | "SECRET_IN_PLAINTEXT"
  | "FORBIDDEN_WRITE_ZONE"
  | "FORBIDDEN_WRITE_ZONE_REPEAT"
  | "BYPASS_ATTEMPTED"
  | "MIGRATION_WITHOUT_ADR"
  | "DONE_WITHOUT_EVIDENCE"
  | "MISSING_HUMAN_VALIDATION"
  | "SUBAGENT_WITHOUT_TRACE"
  | "CLASS_UNDERESTIMATED"
  | "MISSING_AIPD"
  | "MISSING_INDEPENDENT_AUDIT"
  | "MISSING_FALSIFIES_IF"
  | "INVALID_PHASE_TRANSITION";

export interface RunContext {
  runId: string;
  riskClass: RiskClass;
  phase: MacroCycle;
  subPhase: SubPhase;
  mode: OperatingMode;
  warnCount: number;
  evidenceSummary: EvidenceSummary;
  activeForceSignals: string[];
}

export interface GateEvent {
  gateType: GateType;
  timestamp: string;
  runId: string;
  riskClass: RiskClass;
  phase: MacroCycle;
  subPhase: SubPhase;
  mode: OperatingMode;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  agentId?: string;             // subagent_start / subagent_stop
  agentScope?: string[];        // subagent_start uniquement
  evidenceSummary?: EvidenceSummary;
}

export interface GateResult {
  verdict: "allow" | "block" | "warn";
  reason: string;
  violationType?: ViolationType;
  finalState?: FinalState;
  injectedContext?: Record<string, unknown>;
  missingEvidenceItems?: string[];
}

export interface EvidenceSummary {
  presentItems: string[];
  missingItems: string[];
  sufficientForClass: RiskClass | null;
}

export interface Action {
  type: string;           // ex : "write_file", "run_command", "merge_pr"
  target?: string;        // chemin ou identifiant cible
  riskClass: RiskClass;
  phase: MacroCycle;
  subPhase?: SubPhase;
  metadata?: Record<string, unknown>;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  requiredConditions?: string[];
  mandatoryGates?: GateType[];
  mandatoryEvidenceItems?: string[];
}
```

### 10.2 `evaluateGate`

```typescript
// packages/core/src/gates/evaluateGate.ts

import type {
  GateType,
  RunContext,
  GateEvent,
  GateResult,
  RiskClass,
  ViolationType,
} from "./types";
import { loadPolicy } from "../policy/load-policy";
import { checkForceSignals } from "../risk/force-signals";
import { checkForbiddenPatterns } from "../security/forbidden-patterns";
import { evaluateEvidenceSufficiency } from "../evidence/evaluate-evidence";
import { getWritePermissions } from "../phase/write-permissions";

/**
 * Évalue une gate RMS et retourne un verdict allow/block/warn.
 *
 * Règles invariantes :
 * - SECRET_IN_PLAINTEXT → toujours BLOCK, toutes classes
 * - BYPASS_ATTEMPTED sur H/C → toujours BLOCK
 * - DONE_WITHOUT_EVIDENCE → toujours BLOCK, toutes classes
 * - H/C : tout hard-block est définitif (pas de fallback warn)
 */
export function evaluateGate(
  gateType: GateType,
  context: RunContext,
  event: GateEvent
): GateResult {
  const policy = loadPolicy(context.riskClass);

  switch (gate) {
    case "session_start":
      return evaluateSessionStart(context, policy);

    case "user_prompt":
      return evaluateUserPrompt(context, event, policy);

    case "pre_tool":
      return evaluatePreTool(context, event, policy);

    case "post_tool":
      return evaluatePostTool(context, event, policy);

    case "pre_compact":
      return evaluatePreCompact(context, event, policy);

    case "post_compact":
      return evaluatePostCompact(context, event, policy);

    case "stop":
      return evaluateStop(context, event, policy);

    case "subagent_start":
      return evaluateSubagentStart(context, event, policy);

    case "subagent_stop":
      return evaluateSubagentStop(context, event, policy);
  }
}

function evaluatePreTool(
  context: RunContext,
  event: GateEvent,
  policy: ReturnType<typeof loadPolicy>
): GateResult {
  // 1. Vérifier les signaux de forçage sur le chemin cible
  const target = (event.toolInput as { file_path?: string })?.file_path ?? "";
  const forceSignals = checkForceSignals(target, context.riskClass);

  if (forceSignals.classPromotion) {
    return {
      verdict: "block",
      reason: `Signal de forçage détecté : ${forceSignals.reason} — classe promue de ${context.riskClass} vers ${forceSignals.minimumClass}`,
      violationType: "CLASS_UNDERESTIMATED",
    };
  }

  // 2. Vérifier les permissions d'écriture par phase
  const writePermission = getWritePermissions(context.phase, target);

  if (!writePermission.allowed) {
    const violation: ViolationType = "FORBIDDEN_WRITE_ZONE";
    const isHardBlock = policy.hardBlockViolations.includes(violation);

    return {
      verdict: isHardBlock ? "block" : "warn",
      reason: `Zone d'écriture ${target} interdite en phase ${context.phase}. Zones autorisées : ${writePermission.allowedZones.join(", ")}`,
      violationType: violation,
    };
  }

  return {
    verdict: "allow",
    reason: "Zone d'écriture autorisée pour la phase et la classe courantes",
    injectedContext: {
      riskClass: context.riskClass,
      phase: context.phase,
      mode: context.mode,
      allowedZones: writePermission.allowedZones,
    },
  };
}

function evaluateStop(
  context: RunContext,
  event: GateEvent,
  policy: ReturnType<typeof loadPolicy>
): GateResult {
  const evidence = event.evidenceSummary ?? context.evidenceSummary;
  const sufficiency = evaluateEvidenceSufficiency(evidence, context.riskClass, policy);

  if (!sufficiency.sufficient) {
    return {
      verdict: "block",
      reason: `Evidence Set insuffisant pour DONE_VERIFIED en classe ${context.riskClass}. Items manquants : ${sufficiency.missingItems.join(", ")}`,
      violationType: "DONE_WITHOUT_EVIDENCE",
      finalState: sufficiency.canDoneWithGaps ? "DONE_WITH_GAPS" : "BLOCKED_POLICY",
      missingEvidenceItems: sufficiency.missingItems,
    };
  }

  return {
    verdict: "allow",
    reason: `Evidence Set suffisant pour DONE_VERIFIED en classe ${context.riskClass}`,
    finalState: "DONE_VERIFIED",
  };
}

// evaluateSessionStart, evaluateUserPrompt, evaluatePostTool,
// evaluateSubagentStart,
// evaluateSubagentStop suivent le même pattern :
// charger la policy, évaluer la règle applicable, retourner GateResult.
```

### 10.3 `evaluatePolicy`

```typescript
// packages/core/src/policy/evaluate-policy.ts

import type {
  RiskClass,
  Action,
  PolicyDecision,
  GateType,
  OperatingMode,
} from "../gates/types";
import { loadPolicy } from "./load-policy";
import { checkForceSignals } from "../risk/force-signals";

/**
 * Évalue si une action est autorisée pour une classe de risque donnée.
 *
 * Retourne allowed:false avec les conditions requises non satisfaites
 * si l'action nécessite des prérequis non encore remplis.
 */
export function evaluatePolicy(
  riskClass: RiskClass,
  action: Action
): PolicyDecision {
  const policy = loadPolicy(riskClass);

  // Vérification bypass
  if (action.type === "bypass_mode" || action.type === "skip_gate") {
    if (riskClass === "H" || riskClass === "C") {
      return {
        allowed: false,
        reason: `Bypass interdit pour la classe ${riskClass} — règle non négociable (D4)`,
        mandatoryGates: policy.mandatoryGates,
      };
    }
  }

  // Vérification signaux de forçage sur la cible de l'action
  if (action.target) {
    const forceSignals = checkForceSignals(action.target, riskClass);
    if (forceSignals.classPromotion) {
      return {
        allowed: false,
        reason: `Action interdite : signal de forçage détecté sur ${action.target} (${forceSignals.reason}). Classe minimale requise : ${forceSignals.minimumClass}`,
      };
    }
  }

  // Vérification mode opératoire
  const modeAllowed = policy.allowedModes.includes(action.metadata?.mode as OperatingMode);
  if (action.metadata?.mode && !modeAllowed) {
    return {
      allowed: false,
      reason: `Mode ${action.metadata.mode} non autorisé pour la classe ${riskClass}. Modes autorisés : ${policy.allowedModes.join(", ")}`,
    };
  }

  return {
    allowed: true,
    reason: `Action autorisée pour la classe ${riskClass}`,
    mandatoryGates: policy.mandatoryGates,
    mandatoryEvidenceItems: policy.mandatoryEvidenceItems,
  };
}
```

### 10.4 `loadPolicy` (helper)

```typescript
// packages/core/src/policy/load-policy.ts

import { readFileSync } from "fs";
import { parse } from "yaml";
import type { RiskClass, GateType, OperatingMode, ViolationType } from "../gates/types";

export interface PolicyConfig {
  label: string;
  mandatoryGates: GateType[];
  mandatoryEvidenceItems: string[];
  requiredApprovals: number;
  allowedModes: OperatingMode[];
  bypassAllowed: boolean;
  bypassConditions: string[];
  humanValidationRequired: boolean;
  humanOverrideAllowed: boolean;
  deploymentStrategy: string;
  hardBlockViolations: ViolationType[];
}

const POLICIES_PATH = process.env.HARNESS_POLICIES_PATH
  ?? ".planning/run-set.json";

let cache: Record<RiskClass, PolicyConfig> | null = null;

export function loadPolicy(riskClass: RiskClass): PolicyConfig {
  if (!cache) {
    const raw = readFileSync(POLICIES_PATH, "utf-8");
    const parsed = parse(raw) as {
      policies?: { classes: Record<RiskClass, PolicyConfig> };
      classes?: Record<RiskClass, PolicyConfig>;
    };
    cache = parsed.policies?.classes ?? parsed.classes ?? {};
  }
  return cache[riskClass];
}

export function invalidatePolicyCache(): void {
  cache = null;
}
```

---

*Document de conception — Pipeline Fractale v4*
*Maintenu dans : `harness-architecture/docs/conception/05-gates-policy-spec.md`*
*Références : `rms-runtime-sets-v1-draft.md` §Gates + §Policy Set + §Final States ; `checkpoint-implementation.md` §D3/D4/Q1 ; `risk-classification.md` §8 ; `cross-cutting-activities.md` §8*
