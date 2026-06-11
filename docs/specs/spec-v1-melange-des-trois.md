# SPEC V1 — hima « le mélange des trois »

status: **DRAFT — pending founder sign-off (Definition of Spec-Ready : §S)**
date: 2026-06-11
source: ADR-0003 (accepted) · `.planning/restructure/PROPOSITION.md` · code Wave 1 livré (153 tests verts)
règle d'exécution: **Wave 2/3 n'implémentent QUE ce qui est sous contrat dans cette spec.** Toute contradiction se résout ICI, pas dans le code.

---

## Vue V1 globale (le système complet, de la parole au verdict)

```
fondateur parle ──► [C-08 keyword / C-09 commande] ──► mode activé
                          │
                          ▼
                 [C-05 profil actif] ─ planner / executor / critic
                          │
                          ▼
              [C-02 classification criticality T/L/M/H/C par le main agent]
                          │
                          ▼
        [C-02 protocole: étapes obligatoires selon niveau]
                          │
   contexte injecté ◄── [C-06 rules-engine + AGENTS.md + disciplines]
                          │
                          ▼
                 travail (boulder [C-07] persiste le plan)
                          │
            chaque hook runtime ──► [C-03 hima hook <event>]
                          │                 │
                          ▼                 ▼
              [C-04 adapter + capability-map]   [C-01 gates : verdict allow/warn/block]
                          │
                          ▼
              [C-10 ledger : trace + evidence]──► verify fin de tâche (obligatoire, C-02)
```

## Contrats

### C-01 — Verdict & contexte de gate (gates-core ↔ tous) `[CRITICAL][BLOCKS:critical]`

- [CRITICAL][BLOCKS:critical] Le type `GateEvaluationContext` et le verdict `{decision: allow|warn|block, finalState?, violationType?}` tels qu'implémentés en Wave 1 (`packages/gates-core/src`) sont LE contrat central. Tout consommateur (hima-cli, adapters, behaviors) en dépend ; toute évolution = version + migration.
- [CRITICAL][BLOCKS:critical] La stop gate LIT `RISK_POLICY[riskClass].requiresEvidenceBeforeStop` (false pour T/L). Verrou : test de régression `evaluate-stop.test.ts` (riskClass T sans code → allow). Plus jamais de policy déclarative ignorée par le code.
- [HIGH][BLOCKS:high] Chaque gate vit dans SON fichier (`src/gates/<gate>.ts`). Wave 1 n'a découpé que `stop` (les 8 autres délèguent au monolithe legacy) → la Wave 2 termine le découpage, gate par gate, avec tests par gate.
- [HIGH][BLOCKS:low] Une gate ne détecte jamais une violation en cherchant des chaînes (« DONE_VERIFIED » dans un grep ≠ claim) : le matching se fait sur les champs structurés du contexte, pas sur le texte brut des sorties d'outils. (Bug vécu 2× en session.)

### C-02 — Protocole criticality (behavior-core ↔ profils ↔ gates) `[CRITICAL][BLOCKS:critical]`

- [CRITICAL][BLOCKS:critical] La classification T/L/M/H/C est faite par **le main agent en conversation** (pas un sous-agent), via `classifyRisk` de @hima/behavior-core ; le risque est persisté dans `.hima/` et relu par chaque gate.
- [CRITICAL][BLOCKS:none] Étapes obligatoires par niveau (matrice normative V1) :

| Niveau | Toujours | En plus |
|---|---|---|
| T | verify fin de tâche (avis clair, même partiel) | — |
| L | verify | read-before-write |
| M | verify | spec/contrat avant build + review séparée |
| H | verify | + deep research + plan tracé + lanes indépendantes si utile |
| C | verify | + stop tant que autorité/rollback/périmètre non explicites |

- [CRITICAL][BLOCKS:high] **verify est universel** : aucune tâche, aucun niveau, ne s'achève sans un verdict de vérification. La deep research n'est obligatoire QUE pour H/C (jamais imposée à T/L/M).
- [HIGH][BLOCKS:high] L'enforcement est PAR GATE (code), pas par prompt : la matrice ci-dessus se traduit en règles dans les fichiers de gate C-01. Le prompt des profils peut la rappeler, mais la gate est l'autorité.

### C-03 — Contrat hook CLI (hima-cli ↔ adapters ↔ runtimes) `[CRITICAL][BLOCKS:critical]`

- [CRITICAL][BLOCKS:critical] Entrée : `hima hook <event> --format claude|hermes|native`, payload JSON sur stdin (timeout 5s, max 1MB — implémenté Wave 1). Sortie : verdict formaté pour le runtime demandé. Codes retour : 0 (allow/warn), 2 (block).
- [HIGH][BLOCKS:high] Les 9 GateTypes canoniques (ADR-0002) sont la seule nomenclature d'événements ; les noms runtime (PreToolUse, pre_tool_call…) sont mappés DANS l'adapter, jamais dans gates-core.
- [MEDIUM][BLOCKS:none] `hima status` expose l'état `.hima/` lisible par un humain.

### C-04 — Contrat adapter & dégradation (adapters ↔ gates-core) `[CRITICAL][BLOCKS:high]`

- [CRITICAL][BLOCKS:high] Chaque adapter publie sa `capability-map` : GateType × {supported, degraded, absent} (implémentée Wave 1, `storage-core/src/capability-map.ts`). Règle de dégradation normative : une gate `absent` ou `degraded` REPORTE son contrôle sur la prochaine gate `supported` du flux (ex. Hermes : `stop` non bloquant → le contrôle final s'exécute au `pre_tool`/`pre_llm_call` du tour suivant).
- [CRITICAL][BLOCKS:high] Hermes, 4 contraintes structurantes (source : extraction + capability-map) : pas de hook system-prompt (injection en user-message) ; magic-words interceptés en gateway (`pre_llm_call`) ; `HERMES_HOME` explicite par invocation (profils sticky) ; **propagation des règles aux sub-agents via `delegate_task`** (les context files ne se propagent pas).
- [HIGH][BLOCKS:none] Un adapter ne contient AUCUNE logique de décision — il mappe, formate, dégrade. Toute décision vit dans gates-core/behavior-core.

### C-05 — Contrat profils (prompts-core, Wave 2) `[HIGH][BLOCKS:high]`

- [HIGH][BLOCKS:high] Un profil = `prompts/<profil>/<variant>.md` + manifeste `{name, model?, allowedTools, deniedActions, behaviors?: {optOut: []}}`. Sélection par `resolveVariant(modelID, profil)`.
- [HIGH][BLOCKS:high] V1 = 3 profils fonctionnels : **planner** (interdit d'écrire du code — enforced par gate pre_tool sur Write/Edit, pas par prompt), **executor**, **critic** (lecture seule). Les noms sont fonctionnels en v0.1 (décision fondateur) ; une famille nominale peut les renommer plus tard sans changer le contrat.
- [MEDIUM][BLOCKS:none] Un behavior opt-out de profil ne peut JAMAIS désactiver une gate [CRITICAL] (C-02) — seuls les behaviors de niveau profil (outcome-first, delegate…) sont opt-out-ables.

### C-06 — Contrat rules-engine (Wave 2) `[HIGH][BLOCKS:high]`

- [HIGH][BLOCKS:high] Règle = fichier `.md` avec frontmatter `{globs?: string[], alwaysApply?: bool}`. Sources par priorité décroissante : `.hima/rules/` > `.claude/rules/` > `.cursor/rules/`. Matching picomatch sur les chemins touchés par l'action ; injection au pre_tool (et `pre_llm_call` côté Hermes).
- [HIGH][BLOCKS:none] `disciplines.md` (project-disciplines) est une source de règles de PLEIN DROIT du rules-engine — c'est le « mix » demandé : les principes de programmation du projet s'injectent par chemin comme n'importe quelle règle.
- [MEDIUM][BLOCKS:none] AGENTS.md walk-up root-to-leaf injecté en bloc `[Directory Context]` ; le plus spécifique gagne.

### C-07 — Contrat boulder/plan (Wave 2) `[HIGH][BLOCKS:high]`

- [HIGH][BLOCKS:high] `.hima/boulder.json` : `{works: [{id, planPath, status, sessionIds[]}]}` ; plan = markdown `## TODOs` + `- [ ] n. tâche`. Reprise : à session-start, un boulder actif est rechargé et annoncé — le travail « reprend tout seul ».
- [MEDIUM][BLOCKS:none] Le ledger C-10 référence le boulder actif dans chaque événement (traçabilité plan ↔ exécution).

### C-08 — Contrat magic-words (keyword-core, Wave 2) `[HIGH][BLOCKS:high]`

- [CRITICAL][BLOCKS:none] Un magic word ne se déclenche QUE : mot entier, **en fin de message** (`/\b(ulw|...)\s*$/i`), hors blocs de code, hors citation. Preuve d'exigence : 2 faux positifs vécus en session (le mot discuté ≠ le mot invoqué).
- [HIGH][BLOCKS:none] Le set V1 est court et imprononçable en usage normal : `ulw` (exécution parallèle), autres à ajouter UN PAR UN avec justification.
- [HIGH][BLOCKS:none] Côté Hermes l'interception vit dans `pre_llm_call` (C-04) ; côté Claude Code dans UserPromptSubmit.

### C-09 — Contrat commandes (Wave 3) `[HIGH][BLOCKS:high]`

- [HIGH][BLOCKS:high] Surface principale = /commandes. Set V1 : `/plan` (planner + crée le boulder), `/ulw` (exécution parallèle du boulder actif), `/qa` (cycle verify), `/status` (état). Chaque commande = un fichier, schéma d'arguments déclaré, aide générée.
- [MEDIUM][BLOCKS:none] Une commande qui démarre un mode l'enregistre dans `.hima/` (C-10) pour que les gates sachent quel protocole appliquer.

### C-10 — Contrat ledger & evidence `[HIGH][BLOCKS:low]`

- [HIGH][BLOCKS:low] Ledger append-only, chaîne sha256 `prevHash→eventHash`, SANS signature par entrée (implémenté Wave 1). `verifyLedgerChain` détecte l'altération.
- [HIGH][BLOCKS:none] Les clés d'evidence exigibles sont déclarées PAR NIVEAU dans la policy (C-02) et lues par les gates (C-01) — jamais l'inverse. T/L : aucune clé exigée.

## Matrice de cohérence (détection de contradictions)

| Croisement | Contrainte | Statut |
|---|---|---|
| C-02 verify universel × C-04 Hermes stop non bloquant | verify s'exécute via report au tour suivant (pre_tool) | ✅ résolu par règle de dégradation C-04 |
| C-08 fin-de-message × C-04 magic-words gateway-only | le `$` anchor s'applique dans pre_llm_call sur le dernier user message | ✅ compatible |
| C-05 planner-no-code × C-01 enforcement par gate | l'interdit d'écriture est une gate pre_tool (deniedActions), pas du prompt | ✅ cohérent avec ADR-0017 (0% adhérence prompt) |
| C-05 opt-out behaviors × C-02 gates CRITICAL | opt-out impossible sur gates [CRITICAL] | ✅ borné |
| C-06 injection pre_tool × C-04 sub-agents Hermes sans context files | la propagation passe par delegate_task (adapter), le rules-engine n'assume JAMAIS l'héritage | ✅ résolu |
| C-02 deep research H/C seulement × ancien hook Stop exigeant des évidences en T | corrigé : policy lue par la gate (C-01), test de régression | ✅ verrouillé |
| C-09 /plan crée boulder × C-07 reprise auto | une seule source de vérité : boulder.json ; /plan ne duplique pas un boulder actif (dedup par id) | ⚠️ à implémenter avec test |

## §S — Definition of Spec-Ready (gate de sign-off)

La spec est implémentation-ready quand : (1) le fondateur a challengé/validé les items [CRITICAL] ; (2) chaque contrat Wave 2/3 a ses critères de test nommés ; (3) la matrice de cohérence n'a plus de ⚠️ non assumé. Sign-off = message explicite du fondateur référençant ce fichier.

Falsifies-If:
  kill-condition: Pendant l'implémentation Wave 2/3, une décision de design contredit un contrat C-xx sans amendement préalable de cette spec.
  checkpoint-date: 2026-07-01
  evidence-anchor: docs/specs/spec-v1-melange-des-trois.md
  on-fail: Stopper la wave, amender la spec, re-sign-off fondateur, puis reprendre — jamais l'inverse.
