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

Six gates canoniques constituent le noyau portable du RMS. Chaque gate a une sémantique RMS stable ; le binding vers la primitive native (hook Claude, hook Codex, wrapper shell) est délégué au Runtime Binding Set.

| Gate | Événement déclencheur | Peut bloquer | Peut injecter contexte | Peut exiger preuve | Peut signaler violation |
|---|---|:---:|:---:|:---:|:---:|
| `session_start` | Ouverture d'une session agent | non | oui | non | oui |
| `user_prompt` | Réception d'un prompt utilisateur | oui | oui | non | oui |
| `pre_tool` | Avant exécution de tout outil | oui | oui | non | oui |
| `post_tool` | Après exécution de tout outil | oui | oui | oui | oui |
| `stop` | Tentative de fin de run | oui | non | oui | oui |
| `subagent_stop` | Fin d'un sous-agent | oui | non | oui | oui |

### 1.1 Détail par gate

#### `session_start`

- **Primitive native** : `SessionStart` (Claude), `session.start` (Codex), session init hook (Hermes)
- **Peut bloquer** : non — une session ne peut pas être empêchée d'ouvrir, mais son contexte est enrichi
- **Peut injecter contexte** : oui — charge le `project-set.json`, `active-run.json`, classe de risque courante, mode opératoire actif
- **Peut exiger preuve** : non — pas encore en phase d'exécution
- **Peut signaler violation** : oui — signale si état incohérent (phase inconnue, classe manquante, run orphelin)

#### `user_prompt`

- **Primitive native** : `UserPromptSubmit` (Claude), `user.prompt` (Codex), message hook (Hermes)
- **Peut bloquer** : oui — bloque si le prompt demande une action interdite pour la classe courante (ex : bypass sur É/C)
- **Peut injecter contexte** : oui — ajoute la classe de risque, le mode autorisé, les gates actives, les activités transversales obligatoires
- **Peut exiger preuve** : non
- **Peut signaler violation** : oui — signale si le prompt contient une demande de bypass non autorisé

#### `pre_tool`

- **Primitive native** : `PreToolUse` (Claude), `tool.pre` (Codex), gateway hook (Hermes)
- **Peut bloquer** : oui — bloque toute écriture dans une zone interdite selon la phase courante
- **Peut injecter contexte** : oui — enrichit l'événement avec la zone d'écriture autorisée, la phase, le mode
- **Peut exiger preuve** : non — la preuve est collectée, pas encore évaluée
- **Peut signaler violation** : oui — signale écriture hors-zone, pattern interdit, accès privilégié non autorisé

#### `post_tool`

- **Primitive native** : `PostToolUse` (Claude), `tool.post` (Codex), response hook (Hermes)
- **Peut bloquer** : oui — bloque si le résultat contient un pattern interdit (secret en clair, pattern de sécurité violé)
- **Peut injecter contexte** : oui — ajoute le résultat normalisé dans l'Evidence Set
- **Peut exiger preuve** : oui — peut déclencher une collecte d'évidence automatique (diff produit, commande lancée)
- **Peut signaler violation** : oui — signale pattern interdit, écriture hors-zone effectuée, secret détecté

#### `stop`

- **Primitive native** : `Stop` (Claude), `run.stop` (Codex), shutdown hook (Hermes)
- **Peut bloquer** : oui — bloque `DONE_VERIFIED` si l'Evidence Set est insuffisant pour la classe de risque
- **Peut injecter contexte** : non — stop est terminal
- **Peut exiger preuve** : oui — vérifie la suffisance de l'Evidence Set avant d'autoriser la transition vers un final state terminal
- **Peut signaler violation** : oui — signale `DONE_VERIFIED` prématuré, Evidence Set incomplet, gaps non documentés

#### `subagent_stop`

- **Primitive native** : `SubagentStop` (Claude), worker completion (Codex), sub-run end (Hermes)
- **Peut bloquer** : oui — bloque si le sous-agent n'a pas produit les preuves requises
- **Peut injecter contexte** : non — stop est terminal
- **Peut exiger preuve** : oui — le résultat d'un sous-agent doit remonter dans l'Evidence Set ou `events.jsonl`
- **Peut signaler violation** : oui — signale sous-agent sans trace, résultat non versé dans l'Evidence Set

---

## 2. Sémantique des gates

### 2.1 `pre_tool` — contrôle des permissions d'écriture par phase

`pre_tool` est la gate la plus critique pour l'enforcement des zones d'écriture. Elle lit la phase courante dans `active-run.json` et applique la matrice suivante :

| Phase courante | Zones d'écriture autorisées | Zones interdites |
|---|---|---|
| Discovery | `.planning/01-discovery/`, `.planning/09-logs/` | `src/`, `tests/`, `docs/` (hors note discovery) |
| Cadrage | `.planning/02-backlog/`, `.planning/09-logs/` | `src/`, `migrations/`, `auth/` |
| Conception | `docs/13-decisions/`, `.planning/04-conception/`, `.planning/09-logs/` | `src/`, `migrations/` |
| Build | `src/`, `tests/`, `.planning/09-logs/` | `docs/` (hors inline doc), `migrations/` (sauf classe É approuvée) |
| Validation | `tests/`, `.planning/05-validation/`, `.planning/09-logs/` | `src/` |
| Release | `.planning/06-release/`, `releases/`, `.planning/09-logs/` | `src/`, `tests/` |
| Run | `.planning/09-logs/`, `.planning/07-metrics/` | Tout le code source |
| Apprentissage | `docs/`, `.planning/08-learning/`, `.planning/09-logs/` | `src/`, `tests/` |

Violation de zone : `HARD_BLOCK` pour É/C, `WARN` pour T/F/M avec log dans `events.jsonl`.

### 2.2 `post_tool` — détection de patterns interdits

`post_tool` inspecte le résultat de chaque outil pour les patterns suivants :

| Pattern | Détection | Action |
|---|---|---|
| Secret en clair (clé API, token, mot de passe) | Regex + gitleaks intégré | `HARD_BLOCK` toutes classes |
| Bypass de gate explicite (`--no-verify`, override forcé) | Signature de commande | `HARD_BLOCK` si É/C |
| Écriture hors-zone effectuée malgré `pre_tool` | Diff de fichiers touchés | `HARD_BLOCK` si É/C, `WARN` si T/F |
| Migration DB sans expand/contract documenté | Nom de fichier dans `migrations/` sans ADR lié | `HARD_BLOCK` toutes classes |
| `DONE_VERIFIED` avant Evidence Set suffisant | Texte dans output agent | `HARD_BLOCK` toutes classes |

### 2.3 `stop` — suffisance de l'Evidence Set

`stop` évalue l'Evidence Set contre les exigences minimales de la classe de risque courante. La règle est absolue :

```
Pas de DONE_VERIFIED sans Evidence Set suffisant.
```

Un Evidence Set insuffisant produit un final state `DONE_WITH_GAPS` (autorisé si les gaps sont documentés) ou `BLOCKED_POLICY` (si un item obligatoire est absent).

### 2.4 `subagent_stop` — traçabilité des résultats de sous-agents

Tout résultat de sous-agent doit être versé explicitement dans l'Evidence Set ou `events.jsonl`. Un sous-agent qui termine sans trace visible est une violation : son résultat devient une mémoire implicite invisible, incompatible avec le principe de traçabilité du RMS.

---

## 3. Modèle d'implémentation

### 3.1 Interface générale

Chaque gate est un script TypeScript exécuté via `harness hook <gate-name>`. Il reçoit un événement JSON sur stdin, produit une décision JSON sur stdout, et écrit dans `events.jsonl` en append-only.

```
stdin  → { event: GateEvent }
stdout ← { decision: GateDecision }
side-effect → events.jsonl (append)
```

### 3.2 Flux de traitement

```
[plateforme] → harness hook <gate> → stdin
                                        │
                              ┌─────────▼──────────┐
                              │  1. Lire état       │
                              │  active-run.json    │
                              │  evidence-set.json  │
                              │  policies.yaml      │
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
                              │  4. Append          │
                              │  events.jsonl       │
                              └─────────┬──────────┘
                                        │
                                     stdout
                                  ← GateDecision
```

### 3.3 Format de l'événement entrant

```typescript
interface GateEvent {
  gate: GateType;
  timestamp: string;            // ISO 8601 UTC
  runId: string;
  riskClass: RiskClass;
  phase: PipelinePhase;
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
  gate: GateType;
  verdict: "allow" | "block" | "warn";
  reason: string;               // Message human-readable
  violationType?: ViolationType;
  finalState?: FinalState;      // stop uniquement
  injectedContext?: Record<string, unknown>; // si can-inject-context
  timestamp: string;
}
```

### 3.5 Entrée dans events.jsonl

```jsonc
{
  "ts": "2026-05-03T14:32:00.000Z",
  "gate": "pre_tool",
  "verdict": "block",
  "runId": "run-abc123",
  "riskClass": "É",
  "phase": "Build",
  "reason": "Écriture dans migrations/ détectée sans ADR lié — classe É requiert plan expand/contract documenté",
  "violationType": "FORBIDDEN_WRITE_ZONE",
  "toolName": "Write",
  "toolInput": { "file_path": "src/migrations/0042_add_sessions.sql" }
}
```

---

## 4. Règles de politique par classe de risque

### 4.1 Matrice complète

| Dimension | T (Trivial) | F (Faible) | M (Moyen) | É (Élevé) | C (Critique) |
|---|---|---|---|---|---|
| **Gates obligatoires** | post_tool (secrets) | pre_tool + post_tool | pre_tool + post_tool + stop | toutes | toutes |
| **Evidence minimale** | CI verts | CI verts + review ≥1 | CI + review + tests intégration + validation produit | CI + review ≥2 + DAST + ADR + threat model + canary plan + rollback testé | tout É + AIPD + audit sécurité + tests charge + rollback répété + log validation humaine |
| **Approbation requise** | aucune | review automatique ou humain ≥1 | humain ≥1 | humain ≥2 (ou solo+agent antagoniste tracé) + validation explicite avant merge | humain ≥2 + signature explicite + log horodaté |
| **Modes autorisés** | Bypass ✅, Auto-décision ✅, Pairing ✅ | Bypass ✅ (conditions RED-04), Auto-décision ✅, Pairing ✅ | Auto-décision ✅, Pairing ✅, Bypass ✗ | Auto-décision+checkpoint ✅, Pairing ✅, Bypass ✗ | Pairing ✅ (recommandé), Auto-décision ✅ (si visibilité totale), Bypass ✗ absolu |
| **Profondeur de cycle** | Chemin court (secondes–minutes) | Chemin allégé (minutes–heures) | Chemin standard (heures) | Chemin renforcé (heures–jours) | Chemin maximal (jours) |
| **Tests requis** | Tests existants verts | Tests unitaires + intégration nouveaux | Pyramide/Trophée + mutation testing ○ | Pyramide + E2E + mutation >70 % zones critiques + contrats inter-services | Tout É + property-based + charge + fuzzing endpoints |
| **Review requise** | ◔ self-review | ≥1 reviewer ou checklist | ≥1 reviewer + checklist complète | ≥2 reviewers (ou solo + agent antagoniste tracé) | ≥2 reviewers + signature + revue sécurité indépendante |
| **Stratégie déploiement** | Direct | Direct | Canary 10 % | Canary 5 %→25 %→50 %→100 % + gates SLO | Canary + feature flag obligatoire + communication parties prenantes |

### 4.2 Activités transversales obligatoires par classe

| Activité | T | F | M | É | C |
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
| `auth/`, `authorization/`, `sessions/`, `*.session.*` | É |
| `payment/`, `billing/`, `stripe/`, `checkout/` | É |
| `migrations/`, `schema/`, `*.migration.*`, `*.schema.*` | É |
| `api/public/`, `openapi.yaml`, contrat inter-services | É |
| `infra/`, `terraform/`, `k8s/`, `.env.production` | É |
| champ `pii`, `email`, `phone`, `address`, `personal_data` dans diff | É |
| `health/`, `biometric/`, `medical/`, `financial/regulated/` | C |
| diff touchant ≥ 3 services distincts | C |
| keyword `refonte`, `strangler`, `big-bang`, `architecture-pivot` dans message commit | C |
| fichier de compliance RGPD, NIS2, EAA, DORA financier | C |

---

## 5. Hard-block vs Warning

### 5.1 Principe directeur

```
É/C violations → toujours HARD_BLOCK
T/F violations → WARN par défaut (sauf secrets et bypass explicite)
M violations → WARN si première occurrence, HARD_BLOCK si récidive dans le même run
```

### 5.2 Matrice hard-block / warning

| Violation | T | F | M | É | C |
|---|:---:|:---:|:---:|:---:|:---:|
| Secret en clair détecté | BLOCK | BLOCK | BLOCK | BLOCK | BLOCK |
| Écriture hors-zone de phase | WARN | WARN | WARN | BLOCK | BLOCK |
| Bypass tenté sans autorisation | WARN | WARN | BLOCK | BLOCK | BLOCK |
| Evidence Set insuffisant au stop | WARN | WARN | BLOCK | BLOCK | BLOCK |
| Migration DB sans ADR/expand-contract | BLOCK | BLOCK | BLOCK | BLOCK | BLOCK |
| Sous-agent sans trace dans Evidence Set | WARN | WARN | WARN | BLOCK | BLOCK |
| Validation humaine absente avant merge | — | — | WARN | BLOCK | BLOCK |
| Signal de forçage ignoré (classe sous-estimée) | — | WARN | WARN | BLOCK | BLOCK |
| Pattern interdit dans output (DONE sans preuve) | BLOCK | BLOCK | BLOCK | BLOCK | BLOCK |

### 5.3 Comportement sur WARN

Un WARN ne bloque pas l'action, mais :
1. Loggue l'événement dans `events.jsonl` avec `verdict: "warn"`
2. Incrémente le compteur `warn_count` dans `active-run.json`
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
| F | oui (conditionnel) | CI 100 % verts + aucun signal de forçage + diff < 100 lignes + aucune modification dans `auth/`, `migrations/`, `payments/`, `.env*`, `config/security*` + pas de nouveaux endpoints exposés |
| M | non | Bypass interdit — auto-décision obligatoire |
| É | non | Bypass interdit — validation humaine obligatoire avant merge |
| C | non (absolu) | Bypass absolument interdit, quelle que soit la confiance dans l'agent |

### 6.3 Bypass de gate individuelle

Un gate individuel peut être contourné uniquement dans les cas suivants :

| Gate | Bypass autorisé | Condition | Enregistrement requis |
|---|:---:|---|:---:|
| `session_start` | jamais | — | — |
| `user_prompt` | T/F uniquement | Mode bypass autorisé actif | Oui — `events.jsonl` |
| `pre_tool` | T/F uniquement | Mode bypass actif + pas de signal de forçage | Oui — `events.jsonl` |
| `post_tool` (secrets) | jamais | — | — |
| `post_tool` (autres) | T/F uniquement | Mode bypass actif | Oui — `events.jsonl` |
| `stop` | jamais | L'Evidence Set reste toujours évalué | — |
| `subagent_stop` | jamais | Toute trace de sous-agent doit remonter | — |

### 6.4 Override HUMAN avec garde-fou M

La classe M peut recevoir un `HUMAN_OVERRIDE` explicite dans des circonstances documentées (urgence de production, hotfix critique). Conditions :

1. Le développeur saisit un message de justification (≥ 20 caractères)
2. L'override est loggué dans `events.jsonl` avec timestamp, justification et identifiant session
3. Un item de dette est automatiquement créé dans `.planning/02-backlog/tech-debt/`
4. L'audit aléatoire hebdomadaire est déclenché pour ce run

É/C ne supportent pas `HUMAN_OVERRIDE` — seul un gate bloque définitivement.

---

## 7. Protocole d'escalade

### 7.1 Déclencheurs d'escalade

| Déclencheur | Seuil | Action |
|---|---|---|
| HARD_BLOCK en É/C | 1 occurrence | Pause du run + notification développeur + final state = `BLOCKED_POLICY` |
| WARN count > seuil | 5 WARNs par run | Escalade automatique vers développeur + log dans `events.jsonl` |
| Promotion de classe détectée | Signal de forçage découvert en cours de run | Pause PR + re-classification + log dans `escalation_history` |
| Evidence Set insuffisant au stop | Tout item obligatoire absent | Blocage stop + description des items manquants |
| Sous-agent sans trace | Tout subagent_stop sans evidence | BLOCK + message explicite |
| Secret détecté | Toute occurrence | BLOCK immédiat + alert développeur |

### 7.2 Qui est notifié

Le harness n'envoie pas de notifications push (pas de daemon). La notification est :
1. **Synchrone** : le verdict `block` renvoyé à la plateforme arrête l'action et affiche la raison dans l'interface
2. **Persistée** : loggée dans `events.jsonl` et dans `active-run.json` (`last_violation`)
3. **Consultable** : `harness status` affiche les violations actives du run courant

### 7.3 Ce qui se passe au run après une violation É/C

```
HARD_BLOCK É/C
  │
  ├── Final state intermédiaire : BLOCKED_POLICY
  ├── active-run.json mis à jour : { "status": "blocked", "blocked_by": "<gate>", "reason": "..." }
  ├── events.jsonl : entrée append avec détail
  │
  └── Le run ne peut reprendre que si :
        1. La violation est corrigée (preuve ajoutée, zone respectée, etc.)
        2. Le développeur relance `harness hook <gate>` avec l'événement corrigé
        3. Le gate réévalue et retourne `allow`
```

### 7.4 Promotion de classe en cours de run

Format de log obligatoire dans `events.jsonl` :

```jsonc
{
  "ts": "2026-05-05T14:32:00.000Z",
  "type": "class_escalation",
  "runId": "run-abc123",
  "from_class": "F",
  "to_class": "É",
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

| Item de preuve | T | F | M | É | C |
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
  "riskClass": "É",
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

Un sous-agent doit verser dans l'Evidence Set ou `events.jsonl` au minimum :
- Son `agentId` et `runId` parent
- La tâche accomplie (description en 1 ligne)
- Les fichiers modifiés (liste)
- Le résultat de vérification (commande lancée + exit code)
- Les décisions prises (si revieweur ou threat-modeler)

---

## 9. Format des fichiers de politique

### 9.1 `registry/gates.yaml`

```yaml
# registry/gates.yaml
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
      codex:  { primitive: hook, event: session.start }
      hermes: { primitive: gateway_hook, event: session_init }

  user_prompt:
    description: "Contrôle les demandes de bypass et enrichit le contexte de risque"
    canBlock: true
    canInjectContext: true
    canRequireEvidence: false
    canSignalViolation: true
    bindings:
      claude: { primitive: hook, event: UserPromptSubmit }
      codex:  { primitive: hook, event: user.prompt }
      hermes: { primitive: message_hook, event: user_message }

  pre_tool:
    description: "Contrôle les permissions d'écriture par phase et détecte les signaux de forçage"
    canBlock: true
    canInjectContext: true
    canRequireEvidence: false
    canSignalViolation: true
    bindings:
      claude: { primitive: hook, event: PreToolUse }
      codex:  { primitive: hook, event: tool.pre }
      hermes: { primitive: gateway_hook, event: tool_pre }

  post_tool:
    description: "Détecte les patterns interdits et collecte les preuves"
    canBlock: true
    canInjectContext: true
    canRequireEvidence: true
    canSignalViolation: true
    bindings:
      claude: { primitive: hook, event: PostToolUse }
      codex:  { primitive: hook, event: tool.post }
      hermes: { primitive: gateway_hook, event: tool_post }

  stop:
    description: "Évalue la suffisance de l'Evidence Set avant DONE_VERIFIED"
    canBlock: true
    canInjectContext: false
    canRequireEvidence: true
    canSignalViolation: true
    bindings:
      claude: { primitive: hook, event: Stop }
      codex:  { primitive: hook, event: run.stop }
      hermes: { primitive: shutdown_hook, event: run_end }

  subagent_stop:
    description: "Vérifie que le résultat du sous-agent est versé dans l'Evidence Set"
    canBlock: true
    canInjectContext: false
    canRequireEvidence: true
    canSignalViolation: true
    bindings:
      claude: { primitive: hook, event: SubagentStop }
      codex:  { primitive: hook, event: worker.complete }
      hermes: { primitive: plugin_hook, event: sub_run_end }
```

### 9.2 `registry/policies.yaml`

```yaml
# registry/policies.yaml
# Politiques de gate par classe de risque — version 1
# Matrice T/F/M/É/C — source : risk-classification.md §8

version: "1"

# Seuil global de WARNs avant escalade automatique
warnThreshold: 5

classes:
  T:
    label: "Trivial"
    mandatoryGates: [post_tool]
    mandatoryEvidenceItems: [ci_green, sast_clean, secrets_clean]
    requiredApprovals: 0
    allowedModes: [bypass, auto_decision, pairing]
    maxCycleDepth: short
    bypassAllowed: true
    bypassConditions: []
    humanValidationRequired: false
    deploymentStrategy: direct
    hardBlockViolations:
      - SECRET_IN_PLAINTEXT
      - MIGRATION_WITHOUT_ADR
      - DONE_WITHOUT_EVIDENCE

  F:
    label: "Faible"
    mandatoryGates: [pre_tool, post_tool, stop]
    mandatoryEvidenceItems: [ci_green, sast_clean, secrets_clean, integration_tests, review_1, sbom]
    requiredApprovals: 1
    allowedModes: [bypass, auto_decision, pairing]
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
    label: "Moyen"
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
    allowedModes: [auto_decision, pairing]
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

  É:
    label: "Élevé"
    mandatoryGates: [session_start, user_prompt, pre_tool, post_tool, stop, subagent_stop]
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
    allowedModes: [auto_decision_with_checkpoint, pairing]
    maxCycleDepth: reinforced
    bypassAllowed: false
    bypassConditions: []
    humanValidationRequired: true
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
    label: "Critique"
    mandatoryGates: [session_start, user_prompt, pre_tool, post_tool, stop, subagent_stop]
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
    allowedModes: [pairing, auto_decision_full_visibility]
    maxCycleDepth: maximal
    bypassAllowed: false  # absolu
    bypassConditions: []
    humanValidationRequired: true
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
  | "stop"
  | "subagent_stop";

export type RiskClass = "T" | "F" | "M" | "É" | "C";

export type OperatingMode =
  | "bypass"
  | "auto_decision"
  | "auto_decision_with_checkpoint"
  | "auto_decision_full_visibility"
  | "pairing";

export type PipelinePhase =
  | "Discovery"
  | "Cadrage"
  | "Conception"
  | "Build"
  | "Validation"
  | "Release"
  | "Run"
  | "Apprentissage";

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
  | "INVALID_PHASE_TRANSITION";

export interface RunContext {
  runId: string;
  riskClass: RiskClass;
  phase: PipelinePhase;
  mode: OperatingMode;
  warnCount: number;
  evidenceSummary: EvidenceSummary;
  activeForceSignals: string[];
}

export interface GateEvent {
  gate: GateType;
  timestamp: string;
  runId: string;
  riskClass: RiskClass;
  phase: PipelinePhase;
  mode: OperatingMode;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  agentId?: string;
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
  phase: PipelinePhase;
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
// packages/core/src/gates/evaluate-gate.ts

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
 * - BYPASS_ATTEMPTED sur É/C → toujours BLOCK
 * - DONE_WITHOUT_EVIDENCE → toujours BLOCK, toutes classes
 * - É/C : tout hard-block est définitif (pas de fallback warn)
 */
export function evaluateGate(
  gate: GateType,
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

    case "stop":
      return evaluateStop(context, event, policy);

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
    if (riskClass === "É" || riskClass === "C") {
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
  ?? ".rms/registry/policies.yaml";

let cache: Record<RiskClass, PolicyConfig> | null = null;

export function loadPolicy(riskClass: RiskClass): PolicyConfig {
  if (!cache) {
    const raw = readFileSync(POLICIES_PATH, "utf-8");
    const parsed = parse(raw) as { classes: Record<RiskClass, PolicyConfig> };
    cache = parsed.classes;
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
