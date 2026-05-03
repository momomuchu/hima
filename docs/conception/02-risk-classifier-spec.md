# Risk Classifier — Specification formelle

> **Statut** : Conception v1  
> **Date** : 2026-05-03  
> **Scope** : `packages/core/src/risk-classifier/` — composant du harness Pipeline Fractale v4  
> **Rôle** : pivot de modulation de tout le pipeline. Entrée : métadonnées d'un changeset. Sortie : classe T/F/M/É/C + chemin obligatoire.  
> **Sources** : `checkpoint-implementation.md` (D2, D4, Q1, Q6), `risk-classification.md` (v1, 983 lignes), `rms-runtime-sets-v1-draft.md` (Policy Set)

---

## Sommaire

1. Définition des classes de risque
2. Arbre de décision déterministe
3. Signaux de détection automatique
4. Protocole de dérogation manuelle
5. Protocole de promotion de classe (Q6 résolu)
6. Matrice Risque × Mode opératoire
7. Matrice Risque × Profondeur de cycle
8. API TypeScript
9. Points d'intégration
10. Questions ouvertes résolues (Q1, Q6)

---

## 1. Définition des classes de risque

Cinq classes ordonnées, non chevauchantes. Chaque classe a des critères d'inclusion précis et des critères d'exclusion explicites qui forcent vers la classe supérieure.

### T — Trivial

**Description** : Changement cosmétique ou mécanique. Aucune modification du comportement observable, aucun code path critique affecté.

**Critères d'inclusion** :
- Documentation pure (README, commentaires, ADR rétrospectif sans décision nouvelle)
- Refactor mécanique sans changement de comportement : renommage de variable locale, reformatage, réorganisation d'imports
- Patch de dépendance sans CVE (ex : `1.2.3 → 1.2.4`, bugfix non sécuritaire)
- Changement cosmétique UI non fonctionnel (couleur de fond, espacement visuel sans impact sur l'accessibilité)
- Renforcement de suite de tests existante sans ajout de code de production

**Critères d'exclusion** (force vers F minimum) :
- Toute modification de logique, même d'une ligne
- Dépendance avec CVE, même de sévérité Low
- Tout fichier dans `auth/`, `security/`, `.env*`, `config/security*`, `migrations/`
- Tout changement de configuration affectant un comportement runtime

**Exemples** : `README.md` mis à jour, variable locale renommée, `lodash@4.17.20 → 4.17.21`

**Chemin de sortie** : CI verts → merge. Pas de gate humain.

---

### F — Faible

**Description** : Nouvelle fonctionnalité isolée derrière feature flag, ou correction de bug non critique, sans données personnelles, sans migration de schéma, sans impact tiers.

**Critères d'inclusion** :
- Feature UI nouvelle isolée derrière feature flag actif
- Bug fix sur code path non critique, sans changement de contrat API
- Mise à jour de dépendance mineure sans migration (non-breaking documented)
- Ajout de tests d'intégration sur périmètre fonctionnel existant
- Changement de configuration non sécuritaire dans un service non critique

**Critères d'exclusion** (force vers M ou É) :
- Absence de feature flag sur une feature modifiant un flux utilisateur existant → M minimum
- Tout signal de forçage É présent (voir §3) → É minimum
- Diff > 300 lignes nettes sur du code de production → M minimum

**Exemples** : bouton "dark mode" derrière `ff_dark_mode`, correction d'une typo dans un message d'erreur non sécuritaire

**Bypass conditionnel** : autorisé si ET SEULEMENT SI les cinq conditions suivantes sont toutes vraies :
1. CI 100% verts (tous gates lint, unit, SAST, secrets scan)
2. Aucun signal de forçage É/C détecté par l'arbre automatique
3. Diff net ≤ 100 lignes de code de production
4. Aucun fichier dans : `auth/`, `migrations/`, `payments/`, `.env*`, `config/security*`
5. Aucun nouvel endpoint exposé ni modification de contrat API

**Chemin de sortie** : review ≥ 1 + CI verts → merge.

---

### M — Moyen

**Description** : Nouvelle fonctionnalité visible par l'utilisateur, sans PII sensible, sans migration de schéma DB, sans impact tiers, périmètre limité à un seul service.

**Critères d'inclusion** :
- Feature visible utilisateur avec ou sans feature flag (risque contenu à un service)
- Bug fix sur un flux critique sans données sensibles
- Refactor structurel modifiant des interfaces internes non publiques
- Upgrade de dépendance minor avec changements non-breaking documentés
- Changement de configuration avec impact sur le comportement visible

**Critères d'exclusion** (force vers É) :
- Dès qu'un signal É apparaît (auth, PII, migration DB, API publique, infra prod)

**Exemples** : nouvelle page de résultats de recherche, refactor du service de recommandations, upgrade `react@18.2 → 18.3`

**Chemin de sortie** : analyse fonctionnelle + review ≥ 1 + tests intégration + CI verts + validation produit → merge.

---

### É — Élevé

**Description** : Changement touchant un système sensible. Risque de régression grave ou d'incident de sécurité si traité incorrectement. Validation humaine obligatoire avant merge.

**Critères d'inclusion** : tout signal de forçage É du §3 présent (auth, paiement, PII, schéma DB, API publique, infra prod).

**Chemin obligatoire** :
- Discovery complète avec validation du problème
- ADR documenté
- Threat modeling STRIDE (si composante sécurité)
- AIPD si données personnelles présentes
- Tests E2E sur parcours critiques
- DAST sur préprod
- Review ≥ 2 (ou développeur + agent antagoniste en solo avec trace)
- Déploiement canary 5% → 25% → 50% → 100% avec gates SLO à chaque palier
- Feature flag obligatoire
- Plan de rollback testé en staging
- Validation humaine explicite et loggée avant merge

**Mode de supervision** : Auto-décision + checkpoint humain obligatoire. Bypass INTERDIT.

**Exemples** : modification du flux d'authentification, migration de la table `users`, ajout d'un endpoint REST public, changement de politique de session

---

### C — Critique

**Description** : Changement à impact transverse ou réglementaire. Peut affecter plusieurs services, des utilisateurs tiers, ou créer une obligation légale. Pairing recommandé.

**Critères d'inclusion** : tout signal de forçage C du §3 présent (santé, biométrie, financier réglementé, multi-services, refonte d'architecture, exigence réglementaire NIS2/RGPD/EAA/DORA).

**Chemin obligatoire** : tout ce qui est requis pour É, plus :
- Threat modeling STRIDE + LINDDUN (si dimension privacy)
- AIPD obligatoire sans condition
- Revue sécurité indépendante (ou agent antagoniste avec trace complète)
- Tests de charge si endpoints exposés sous traffic
- Canary + feature flag + communication aux parties prenantes identifiées
- Plan de rollback répété (testé ≥ 2 fois en staging)
- Postmortem pré-rempli si l'opération échoue (template prêt avant le déploiement)
- Validation humaine avec signature explicite loggée

**Mode de supervision** : Pairing recommandé. Auto-décision uniquement si le développeur a visibilité totale sur l'ensemble du changement. Bypass ABSOLUMENT INTERDIT.

**Exemples** : intégration de paiements Stripe en production, modification du schéma de données santé, refonte de l'architecture de multi-tenant, mise en conformité NIS2

---

## 2. Arbre de décision déterministe

L'arbre produit une classe proposée en < 30 secondes sur tout changeset, avec justification automatique, avant toute interaction humaine. Il est constitué de quatre passes séquentielles.

```
PASSE 1 — Signaux de forçage C (non négociables)
─────────────────────────────────────────────────
SI l'une des conditions suivantes est vraie → classe_min = C (immédiat)

  a. Un fichier modifié correspond à : health/, biometric/, medical/
  b. Présence de types de données : health_data, biometric, financial_regulated
  c. Changement touchant ≥ 2 services/repos distincts
  d. Type de changement = "architecture_refactor" ou label "arch-refactor"
  e. Label ou mention : RGPD art.35, NIS2, EAA, DORA-financial, PCI-DSS

PASSE 2 — Signaux de forçage É (non négociables)
─────────────────────────────────────────────────
SI classe_min < É ET l'une des conditions suivantes est vraie → classe_min = É

  a. Un fichier modifié correspond à : auth/, authorization/, sessions/, oauth/, sso/
  b. Un fichier modifié correspond à : payments/, billing/, invoices/, subscriptions/
  c. Un fichier modifié correspond à : migrations/, *.migration.ts, *.sql (DDL)
  d. Modification détectée sur schéma DB : CREATE TABLE, ALTER TABLE, DROP, ADD COLUMN
  e. Un fichier modifié correspond à : api/public/, openapi.yaml, swagger.json, *.proto
  f. Un fichier modifié correspond à : infra/, terraform/, k8s/, docker-compose.prod*
  g. Label présent : "auth", "payment", "migration", "api-breaking", "pii", "infra-prod"
  h. Présence de types de données PII : email, password, ssn, phone, address (champ nommé)

PASSE 3 — Score composite (si aucun signal de forçage actif)
─────────────────────────────────────────────────────────────
score = impact_estimé × probabilité_estimée   (1–25)

  impact_estimé :
    1 = aucun utilisateur impacté
    2 = quelques utilisateurs, récupération < 1h
    3 = flux important dégradé, récupération < 4h
    4 = service critique indisponible, perte de données possible
    5 = atteinte données sensibles ou obligation réglementaire

  probabilité_estimée :
    1 = < 1 fois/an dans des conditions similaires
    2 = quelques fois/an
    3 = ~30% des cas similaires
    4 = ~60% des cas similaires
    5 = > 80% des cas similaires

  Mapping score → classe_calculée :
    [1-2]  → T
    [3-5]  → F
    [6-10] → M
    [11-17]→ É
    [18-25]→ C

PASSE 4 — Classe finale
───────────────────────
  classe_finale = MAX(classe_min, classe_calculée)

  Retourner :
    classe_finale
    signaux_actifs[] (liste des signaux qui ont déclenché le forçage)
    supervision_mode (voir §6)
    deployment_strategy (voir §7)
    mandatory_activities[] (voir §7)
    bypass_eligible : boolean (true seulement si T ou F + conditions §1.F)
```

**Propriété de monotonie** : la classe finale est toujours ≥ à chaque classe intermédiaire. L'arbre ne peut jamais produire une classe inférieure à un signal de forçage actif.

---

## 3. Signaux de détection automatique

### 3.1 Patterns de chemins de fichiers

| Pattern (glob/regex) | Classe minimale forcée |
|----------------------|------------------------|
| `**/auth/**`, `**/authorization/**`, `**/sessions/**`, `**/oauth/**`, `**/sso/**` | É |
| `**/payments/**`, `**/billing/**`, `**/invoices/**`, `**/subscriptions/**` | É |
| `**/migrations/**`, `**/*.migration.ts`, `**/*.sql` | É |
| `**/api/public/**`, `**/openapi.yaml`, `**/swagger.json`, `**/*.proto` | É |
| `**/infra/**`, `**/terraform/**`, `**/k8s/**`, `**/docker-compose.prod*` | É |
| `**/.env*`, `**/config/security*`, `**/secrets/**` | É |
| `**/health/**`, `**/biometric/**`, `**/medical/**` | C |
| Changement cross-repo (≥ 2 repos dans le diff) | C |

### 3.2 Signaux dans le contenu du diff

| Signal dans le diff | Classe minimale |
|---------------------|-----------------|
| `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `ADD COLUMN`, `DROP COLUMN` | É |
| `password`, `secret`, `api_key`, `private_key` (valeur non-vide, hors tests) | É |
| Ajout d'un champ nommé `email`, `phone`, `ssn`, `address`, `user_id` dans un modèle | É |
| `GRANT`, `REVOKE` dans SQL | É |
| Import de `health_data`, `biometric`, `financial_regulated` (types détectés) | C |

### 3.3 Labels de PR / backlog item

| Label | Classe minimale |
|-------|-----------------|
| `auth`, `authentication`, `authorization` | É |
| `payment`, `billing`, `stripe`, `pci` | É |
| `migration`, `schema-change` | É |
| `api-breaking`, `breaking-change` | É |
| `pii`, `gdpr`, `privacy` | É |
| `infra-prod`, `infrastructure` | É |
| `health-data`, `biometric`, `hipaa` | C |
| `regulatory`, `nis2`, `eaa`, `dora-financial` | C |
| `arch-refactor`, `architecture` | C |
| `multi-service`, `cross-repo` | C |

### 3.4 Signaux structurels

| Signal | Classe minimale |
|--------|-----------------|
| Diff net > 300 lignes de code de production | M (si T ou F calculé) |
| Nouvelles dépendances ajoutées (package.json, go.mod, etc.) | F minimum |
| CVE dans une dépendance modifiée (CVSS ≥ 1.0) | F minimum, É si CVSS ≥ 7.0 |
| CVE Critical (CVSS ≥ 9.0) non corrigée > 24h | C (escalade immédiate) |

---

## 4. Protocole de dérogation manuelle

### 4.1 Promotion manuelle (demotion vers classe plus haute)

Un humain peut toujours promouvoir une classe vers un niveau supérieur, sans restriction ni justification formelle requise. La promotion est loggée automatiquement dans `escalation_history`.

### 4.2 Déclassement manuel (override vers classe inférieure)

**Règle absolue** : É et C ne peuvent jamais être déclassés sans approbation humaine explicite et documentée.

| Déclassement | Autorisation requise |
|--------------|----------------------|
| T → (impossible, T est le minimum) | N/A |
| F → T | Autorisé si aucun signal de forçage actif + justification écrite |
| M → F | Autorisé si aucun signal de forçage actif + justification écrite |
| M → T | Interdit — saut de classe non autorisé |
| É → M | Requiert : humain, justification documentée, contresignature agent |
| É → F ou T | Interdit |
| C → É | Requiert : humain, justification documentée, contresignature agent, date de revue |
| C → M, F, T | Interdit |

**Format de log de déclassement** :
```yaml
override:
  type: "demotion"
  from_class: "É"
  to_class: "M"
  reason: "Signal migration DB concernait un environnement de staging isolé, non production"
  authorized_by: "developer"
  timestamp: "2026-05-03T10:15:00Z"
  agent_countersign: true
  review_date: "2026-05-17T10:15:00Z"
```

### 4.3 Garde-fous permanents (non dérogeables)

Ces quatre règles ne peuvent être overridées par aucune dérogation, humaine ou agent :

1. Bypass interdit sur É/C — quelle que soit la confiance dans l'agent ou l'historique du projet
2. Aucun changement de schéma DB sans plan expand/contract documenté — classe É minimum
3. Aucune donnée de santé/biométrie sans AIPD et chiffrement validés — classe C minimum
4. CVE Critical non triée en production > 24h — escalade immédiate vers C

---

## 5. Protocole de promotion de classe (Q6 résolu)

Ce protocole s'applique lorsqu'un changement initialement classé F (ou M) s'avère É (ou C) en cours de cycle — typiquement lors de la phase Build quand un signal de forçage apparaît dans un commit intermédiaire.

### 5.1 Machine à états de promotion

```
État CLASSIFIED(F)
      │
      │ [signal de forçage É détecté dans commit]
      │ Acteur : harness (scan automatique à chaque push)
      ▼
État ESCALATION_DETECTED
      │
      │ [notification immédiate au développeur]
      │ [PR mise en pause — aucun nouveau commit accepté]
      ▼
État AWAITING_HUMAN_CONFIRMATION
      │                    │
      │ [confirmé]         │ [contesté dans < 4h]
      ▼                    ▼
État PROMOTED(É)      État OVERRIDE_REVIEW
      │                    │
      │                    │ [human override documenté]
      │                    ▼
      │               État DEMOTED_WITH_OVERRIDE
      │                    │
      ▼                    ▼
État CYCLE_ADAPTED    État CLASSIFIED(F, overridden)
```

### 5.2 Actions obligatoires lors d'une promotion F → É

1. **Pause immédiate** : la PR entre en état `ESCALATION_DETECTED`. Aucun merge possible.
2. **Notification** : le développeur reçoit une notification avec le signal détecté, le fichier concerné, le commit déclencheur.
3. **Reclassification** : la classe dans les métadonnées du PR/item est mise à jour de F vers É.
4. **Déclenchement du chemin obligatoire É** : ADR requis, threat modeling STRIDE requis, review ≥ 2, DAST, canary, feature flag, rollback plan.
5. **Re-planification si nécessaire** : si l'item était planifié dans un sprint, le volume de travail additionnel est estimé et communiqué.
6. **Log dans `escalation_history`** (voir format ci-dessous).

### 5.3 Format de log de promotion

```yaml
escalation_history:
  - timestamp: "2026-05-05T14:32:00Z"
    from_class: "F"
    to_class: "É"
    trigger_signal: "auth"
    trigger_file: "src/auth/session.ts"
    trigger_commit: "abc1234"
    detected_by: "harness-auto"
    confirmed_by: "developer"
    confirmation_timestamp: "2026-05-05T14:45:00Z"
    actions_triggered:
      - "PR pausée"
      - "ADR requis"
      - "Threat modeling STRIDE requis"
      - "Review ≥2 activée"
      - "Canary 5%→100% activé"
    sprint_impact: "estimation +2 jours"
    note: "Fichier auth/session.ts ajouté dans commit abc1234 — non prévu en Cadrage"
```

### 5.4 Règles d'escalade chaînée

- Une promotion ne peut sauter qu'une classe à la fois (F → É est autorisé, F → C requiert confirmation supplémentaire).
- Si un signal C est détecté sur un item promu É (double escalade), le développeur reçoit une seconde notification et doit re-confirmer.
- Chaque promotion est irréversible sans dérogation manuelle explicite (voir §4.2).

---

## 6. Matrice Risque × Mode opératoire

| Classe | Bypass | Auto-décision | Auto-décision + checkpoint | Pairing |
|--------|:------:|:-------------:|:--------------------------:|:-------:|
| **T** | Autorisé | Autorisé | Optionnel | Optionnel |
| **F** | Conditionnel (§1.F) | Autorisé | Optionnel | Optionnel |
| **M** | **INTERDIT** | Autorisé (défaut) | Optionnel | Optionnel |
| **É** | **INTERDIT** | Insuffisant seul | Obligatoire | Optionnel |
| **C** | **INTERDIT ABSOLU** | Insuffisant seul | Autorisé si visibilité totale | Recommandé |

**Définitions des modes** :

- **Bypass** : l'agent fait tout y compris le triage. Aucune validation humaine active. Le CI bloquant est le seul garde-fou.
- **Auto-décision** : l'agent propose Discovery + solution + chemin. Le développeur valide au triage. Mode par défaut pour M.
- **Auto-décision + checkpoint** : identique à auto-décision, mais la validation humaine est obligatoire avant merge. L'agent ne peut pas merger seul.
- **Pairing** : le développeur est présent en continu. L'agent suit le flux de pensée du développeur.

**Garde-fous anti-rubber-stamp** (actifs en Auto-décision et Auto-décision + checkpoint) :
- Format de proposition obligatoire : `[problème][alternatives][choix][critère de succès][classe de risque]`
- Quota de rejets ≥ 20% des propositions sur une période glissante de 7 jours
- Audit aléatoire hebdomadaire : une proposition acceptée la veille est relue à froid

---

## 7. Matrice Risque × Profondeur de cycle

Activités classées : **M** = Mandatory (bloquant si absent), **R** = Recommended (attendu sauf justification), **L** = Light (version allégée suffisante), **C_** = Conditional (obligatoire si condition précisée), **S** = Skippable, **X** = Interdit.

| Activité | T | F | M | É | C |
|----------|---|---|---|---|---|
| **DISCOVERY** | | | | | |
| Validation du problème | S | L | R | M | M |
| Entretiens utilisateurs / JTBD | S | S | R | M | M |
| Spike technique timeboxé | S | S | R | R | R |
| **CADRAGE** | | | | | |
| Classification de risque inscrite | M | M | M | M | M |
| DoR formelle | L | R | M | M | M |
| Impact privacy + accessibilité identifié | S | L | M | M | M |
| **CONCEPTION** | | | | | |
| ADR documenté | S | L | R | M | M |
| Threat modeling STRIDE | S | S | R | M | M |
| AIPD / DPIA | S | S | C_(PII) | M (si PII) | M |
| Threat modeling LINDDUN | S | S | S | C_(PII) | M (si PII) |
| Plan expand/contract (schéma DB) | S | S | C_(schéma) | M (si schéma) | M |
| **BUILD** | | | | | |
| Tests unitaires | M | M | M | M | M |
| Tests d'intégration | L | M | M | M | M |
| Tests E2E parcours critiques | S | L | R | M | M |
| SAST / SCA / Secrets scan | M | M | M | M | M |
| DAST (préprod) | S | S | R | M | M |
| SBOM (CycloneDX/SPDX) | S | S | R | M | M |
| Signature artefact (Cosign) | S | S | S | M | M |
| Coverage critique (> 70% zones touchées) | S | L | M | M | M |
| **VALIDATION** | | | | | |
| Review de code | L | M | M | M (≥2 ou solo+agent) | M (≥2) |
| Quality gates CI | M | M | M | M | M |
| Validation produit / acceptance | S | L | M | M | M |
| Tests accessibilité auto (axe-core) | L | M | M | M + manuel | M + audit |
| Mutation testing | S | S | R | M (zones critiques) | M |
| Tests de charge | S | S | R | M | M |
| **RELEASE** | | | | | |
| Feature flag | S | R | R | M | M |
| Plan de rollback | implicite | M | M | M + testé | M + répété |
| Canary deployment | S | S | 10% | 5%→25%→50%→100% | idem É + flag |
| Communication parties prenantes | S | équipe | équipe | élargie | élargie + externe |
| Smoke tests post-déploiement | S | L | M | M | M |
| **RUN** | | | | | |
| Surveillance SLO active | L | L | M | M | M |
| Postmortem si incident | léger | M | M | M + revue | M + audit indépendant |

---

## 8. API TypeScript

### 8.1 Types fondamentaux

```typescript
// packages/core/src/risk-classifier/types.ts

export type RiskClass = 'T' | 'F' | 'M' | 'É' | 'C';

export type SupervisionMode =
  | 'bypass'
  | 'auto-decision'
  | 'auto-decision+checkpoint'
  | 'pairing';

export type DeploymentStrategy =
  | 'direct'
  | 'canary-10'
  | 'canary-progressive'     // 5%→25%→50%→100%
  | 'canary-with-flag';      // canary + feature flag obligatoire

export interface Changeset {
  /** Chemins des fichiers modifiés (relatifs à la racine du repo) */
  files: string[];
  /** Labels appliqués à la PR ou à l'item backlog */
  labels: string[];
  /** Type déclaré du changement */
  changeType: 'feature' | 'fix' | 'refactor' | 'migration' | 'infra' | 'deps' | 'docs' | 'architecture_refactor';
  /** Contenu du diff (lignes ajoutées/supprimées) pour analyse de contenu */
  diffContent?: string;
  /** Nombre net de lignes modifiées en code de production */
  diffLinesNet?: number;
  /** Impact estimé (1-5) — fourni par l'auteur ou inféré */
  impactEstimate?: 1 | 2 | 3 | 4 | 5;
  /** Probabilité estimée (1-5) — fourni par l'auteur ou inféré */
  probabilityEstimate?: 1 | 2 | 3 | 4 | 5;
  /** Nombre de repos/services distincts touchés */
  reposCount?: number;
}

export interface ClassificationResult {
  /** Classe finale (max des classes forcées et calculée) */
  riskClass: RiskClass;
  /** Justification en une ligne — human-readable */
  justification: string;
  /** Liste des signaux de forçage actifs */
  activeSignals: ForcingSignal[];
  /** Score composite Impact×Probabilité (si applicable) */
  compositeScore?: number;
  /** Mode de supervision requis */
  supervisionMode: SupervisionMode;
  /** Stratégie de déploiement déterminée par la classe */
  deploymentStrategy: DeploymentStrategy;
  /** Liste des activités obligatoires pour cette classe */
  mandatoryActivities: string[];
  /** Bypass éligible (true seulement pour T, ou F toutes conditions remplies) */
  bypassEligible: boolean;
  /** Horodatage de la classification */
  classifiedAt: string; // ISO 8601
  /** Proposé par agent ou humain */
  proposedBy: 'agent' | 'developer';
}

export interface ForcingSignal {
  type: 'file_path' | 'diff_content' | 'label' | 'structural' | 'cross_repo';
  value: string;         // ex : "auth/session.ts", "CREATE TABLE", "pii"
  forcedClass: 'É' | 'C';
}

export interface PromotionResult {
  success: boolean;
  previousClass: RiskClass;
  newClass: RiskClass;
  /** Entrée ajoutée dans escalation_history */
  escalationEntry: EscalationEntry;
  /** Liste des activités débloquées par la promotion */
  newMandatoryActivities: string[];
  /** Estimation de l'impact sur le sprint (narrative) */
  sprintImpact: string | null;
}

export interface EscalationEntry {
  timestamp: string;
  fromClass: RiskClass;
  toClass: RiskClass;
  triggerSignal?: string;
  triggerFile?: string;
  triggerCommit?: string;
  detectedBy: 'harness-auto' | 'developer' | 'agent';
  confirmedBy?: 'developer';
  confirmationTimestamp?: string;
  actionsTriggered: string[];
  note?: string;
}

export interface DemotionOptions {
  reason: string;
  authorizedBy: 'developer';
  reviewDate: string; // ISO 8601 — date de revue obligatoire
}
```

### 8.2 Fonctions principales

```typescript
// packages/core/src/risk-classifier/index.ts

import type {
  Changeset,
  ClassificationResult,
  RiskClass,
  PromotionResult,
  DemotionOptions,
} from './types.js';

/**
 * Classifie un changeset selon l'arbre de décision déterministe §2.
 *
 * Algorithme : 4 passes séquentielles (forçage C → forçage É → score → max).
 * Déterministe : même input produit toujours même output.
 * Latence cible : < 30ms pour tout changeset de taille raisonnable.
 */
export function classifyRisk(changeset: Changeset): ClassificationResult;

/**
 * Promeut la classe courante vers une classe supérieure.
 *
 * - Toujours autorisé (promotion = direction safe).
 * - Retourne les nouvelles activités obligatoires déclenchées.
 * - Logue dans escalation_history via le planning adapter.
 *
 * @throws {RiskClassificationError} si target <= current (utiliser demoteRisk)
 */
export function promoteRisk(
  current: RiskClass,
  target: RiskClass,
  reason: string,
  triggerContext?: { signal?: string; file?: string; commit?: string }
): PromotionResult;

/**
 * Rétrograde la classe courante vers une classe inférieure.
 *
 * - Requiert une approbation humaine pour É → M et C → É.
 * - Interdit pour É → F/T et C → M/F/T et tout saut de classe.
 * - Interdit si un signal de forçage actif est incompatible avec la cible.
 *
 * @throws {RiskClassificationError} si demotion invalide ou non autorisée
 */
export function demoteRisk(
  current: RiskClass,
  target: RiskClass,
  options: DemotionOptions,
  activeSignals: ForcingSignal[]
): PromotionResult;

/**
 * Vérifie si une classe peut légitimement être utilisée en mode Bypass.
 * Applique les 5 conditions de §1.F pour la classe F.
 */
export function isBypassEligible(
  riskClass: RiskClass,
  changeset: Changeset
): boolean;

/**
 * Retourne le mode de supervision requis pour une classe.
 */
export function getSupervisionMode(riskClass: RiskClass): SupervisionMode;

/**
 * Retourne la stratégie de déploiement pour une classe.
 */
export function getDeploymentStrategy(riskClass: RiskClass): DeploymentStrategy;

/**
 * Retourne la liste des activités obligatoires pour une classe.
 * Utilisé par la state machine pour activer les gates.
 */
export function getMandatoryActivities(riskClass: RiskClass): string[];

/**
 * Scanne un diff (ou un ensemble de commits) et retourne les signaux
 * de forçage détectés. Utilisé par le hook pre_tool_use et post_tool_use.
 */
export function scanForForcingSignals(
  files: string[],
  diffContent?: string,
  labels?: string[]
): ForcingSignal[];

/**
 * Compare l'ordre des classes. Retourne > 0 si a > b, 0 si égaux, < 0 sinon.
 * Ordre : T < F < M < É < C
 */
export function compareRiskClass(a: RiskClass, b: RiskClass): number;

export class RiskClassificationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_DEMOTION'
      | 'UNAUTHORIZED_DEMOTION'
      | 'FORCING_SIGNAL_ACTIVE'
      | 'CLASS_SKIP_NOT_ALLOWED'
      | 'BYPASS_FORBIDDEN',
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RiskClassificationError';
  }
}
```

---

## 9. Points d'intégration

### 9.1 State machine (guards)

La state machine du harness (`packages/core/src/state-machine/`) utilise `classifyRisk` comme guard sur les transitions de phase :

- **Guard `canBypass`** : `isBypassEligible(currentRisk, changeset)` — bloque la transition si F mais conditions non remplies, ou si M/É/C
- **Guard `requiresHumanCheckpoint`** : `getSupervisionMode(currentRisk) === 'auto-decision+checkpoint'` — injecte un état `AWAITING_HUMAN_APPROVAL` avant la transition vers `MERGE_READY`
- **Guard `requiresPairing`** : `currentRisk === 'C'` — recommande le mode pairing dans la notification
- **Action `activateGates`** : `getMandatoryActivities(currentRisk)` — active les quality gates CI correspondants dans le CI descriptor

### 9.2 Policy Set (RMS)

Le Policy Set (`registry/policies.yaml`) est dérivé directement de la matrice §7. Structure minimale :

```yaml
# registry/policies.yaml
policies:
  bypass_conditions:
    T: { allowed: true, conditions: [] }
    F: { allowed: true, conditions: [ci_green, no_forcing_signals, diff_lte_100, no_sensitive_paths, no_new_endpoints] }
    M: { allowed: false }
    É: { allowed: false }
    C: { allowed: false }
  
  human_checkpoint_required:
    É: true
    C: true
  
  mandatory_gates_by_class:
    T: [lint, unit_tests, sast, secrets_scan]
    F: [lint, unit_tests, integration_tests, sast, secrets_scan, code_review_1]
    M: [lint, unit_tests, integration_tests, sast, secrets_scan, code_review_1, acceptance_validation]
    É: [lint, unit_tests, integration_tests, e2e_critical, sast, dast, secrets_scan, sbom, artifact_sign, code_review_2, human_approval]
    C: [lint, unit_tests, integration_tests, e2e_critical, sast, dast, secrets_scan, sbom, artifact_sign, code_review_2, security_audit, load_tests, human_approval_signed]
```

### 9.3 Route Set (RMS)

Lors de la construction du Route Set pour un run, le classifier alimente :
- `route_set.risk_class` — classe retenue
- `route_set.supervision_mode` — mode résultant
- `route_set.gates_activated[]` — gates CI à activer
- `route_set.bypass_eligible` — flag utilisé par le dispatcher de hooks

### 9.4 Evidence Set (RMS)

Pour qu'un item É ou C puisse atteindre le statut `DONE_VERIFIED`, l'Evidence Set doit contenir :
- `human_approval_log` (É et C) — horodatage + identifiant humain
- `threat_model_ref` (É et C) — référence au fichier ADR/threat model
- `dast_report_ref` (É et C)
- `rollback_test_evidence` (É et C) — résultat du test de rollback en staging
- `aipd_ref` (C seulement si PII) — référence à l'AIPD produite
- `security_audit_ref` (C seulement) — trace de la revue sécurité indépendante

### 9.5 Hook pre_tool_use (scan continu)

À chaque commit poussé, le hook `pre_tool_use` appelle `scanForForcingSignals(files, diffContent, labels)`. Si de nouveaux signaux sont détectés qui élèvent la classe au-delà de la classe courante, le protocole de promotion §5 est déclenché automatiquement.

### 9.6 Cycle Apprentissage (feedback loop)

Le module `packages/core/src/risk-classifier/calibration.ts` produit, à chaque cycle Apprentissage :
- Taux de promotions de classe (cible < 10%)
- Taux de déclassements (cible < 15%)
- Corrélation classe initiale / incidents production
- Proposition de mise à jour des patterns de forçage §3 si taux d'alerte dépassé

---

## 10. Questions ouvertes résolues

### Q1 — Comment opérationnaliser la classification de risque ?

**Réponse** : Classification déterministe en 4 passes séquentielles (§2), proposée par l'agent via `classifyRisk(changeset)` en < 30ms, validée par le développeur au triage. Les passes 1 et 2 (signaux de forçage) sont non négociables et produisent une classe minimale forcée. La passe 3 (score composite) s'applique uniquement en l'absence de signal de forçage. La passe 4 prend le maximum des deux.

La classification est automatiquement déclenchée à trois moments : (a) création de l'item en Cadrage, (b) création de la PR/branche, (c) à chaque push via le hook `pre_tool_use`. Le développeur ne peut influencer que la validation (confirmée / overridée), jamais l'arbre automatique lui-même.

L'ensemble des patterns de forçage (§3) est versionné dans le repo du harness et mis à jour via le cycle Apprentissage, créant une boucle de calibration auto-améliorante. La première version des patterns est conservatrice (meilleure sur-classification que sous-classification).

**Critère de résolution atteint** : arbre déterministe, < 30 secondes, justification automatique produite avant toute interaction humaine.

---

### Q6 — Protocole de promotion de classe en cours de cycle ?

**Réponse** : Le protocole est formalisé en §5 avec une machine à états explicite. Le principe central est **pause immédiate + notification + re-classification + déclenchement du chemin obligatoire de la nouvelle classe**.

Points clés :
- La détection est automatique (scan à chaque push par `scanForForcingSignals`)
- La pause est immédiate et non contournable (harness bloque les pushes suivants)
- La confirmation humaine est requise dans les 4 heures (passé ce délai, la promotion est confirmée automatiquement par défaut conservateur)
- Tout l'historique de promotion est tracé dans `escalation_history` (format §5.3)
- Un item promu F → É hérite immédiatement de tout le chemin obligatoire É, sans exception

Le protocole distingue la promotion forcée par signal (automatique, harness-initiated) de la promotion volontaire par le développeur (manuelle, developer-initiated). Les deux utilisent le même format de log mais avec `detected_by` différent.

**Propriété de correction** : une promotion ne peut jamais être silencieuse. Tout signal de forçage détecté après la classification initiale produit soit une promotion tracée, soit une dérogation manuelle documentée. Il n'existe pas de troisième état.

---

*Spec produite en Conception — Pipeline Fractale v4*  
*Maintenu dans : `harness-architecture/docs/conception/02-risk-classifier-spec.md`*  
*Implémentation cible : `packages/core/src/risk-classifier/`*  
*Dépend de : `01-state-machine-spec.md` (guards), `03-policy-set-spec.md` (Policy Set)*
