# SPEC-007 — Adapter Hermes v2 : contrat du premier runtime

status: draft
date: 2026-06-11
owner: noyau
source: PROPOSITION.md §4/§12, ADR-0003,
        packages/adapter-hermes-v2/src/index.ts,
        packages/adapter-hermes-v2/src/hook-bindings.ts,
        packages/storage-core/src/capability-map.ts,
        .omc/ultragoal/brief.md §critères-3/4/5,
        .planning/restructure/lanes/lane-triage-hima.md
cross-refs: SPEC-001-package-contracts.md, SPEC-003-gates-runtime-matrix.md

---

## Objet

Ce document spécifie le contrat de l'adapter Hermes : mapping GateType → hook natif,
comportement par niveau de dégradation, propagation aux sub-agents, profils, et critère
d'acceptation binaire (tool call interdit réellement bloqué).

Chaque exigence est taggée sur deux axes indépendants :
- importance : `[CRITICAL]` `[HIGH]` `[MEDIUM]` `[LOW]`
- ordre d'exécution : `[BLOCKS:critical]` `[BLOCKS:high]` `[BLOCKS:low]` `[BLOCKS:none]`

---

## CRITICAL items

- [CRITICAL][BLOCKS:critical] **Critère d'acceptation binaire n°3** (`.omc/ultragoal/brief.md`) :
  un tool call interdit (ex. : appel à `Bash` avec une commande bloquée par la gate
  `pre_tool`) déclenche le hook `pre_tool_call` du plugin hima sur Hermes, qui retourne
  `{"action": "block"}`, et l'agent Hermes N'EXÉCUTE PAS le tool call.
  Ce critère est binaire : PASS (le call est bloqué) ou FAIL (le call s'exécute).
  Aucun état intermédiaire n'est acceptable.

- [CRITICAL][BLOCKS:critical] La gate `pre_tool` mappe sur le hook Hermes `pre_tool_call`.
  Ce hook est bloquant (`canBlock: true`). La réponse du plugin pour bloquer est
  `{"action": "block", "message": "<raison>"}`. C'est le seul hook bloquant fiable pour
  les writes et les appels d'outils.
  (Source : `capability-map.ts` ligne 106-108, `hook-bindings.ts` ligne 36.)

- [CRITICAL][BLOCKS:critical] La gate `user_prompt` mappe sur le hook Hermes `pre_llm_call`.
  Ce hook est bloquant. La réponse pour bloquer est `{"action": "block"}`. La réponse
  pour injecter du contexte est `{"action": "continue", "content": "<texte injecté>"}` —
  injection en user-message uniquement (pas de system-prompt sur Hermes).
  (Source : `capability-map.ts` ligne 103-104, PROPOSITION.md §4.)

- [CRITICAL][BLOCKS:high] **Gestion du stop non bloquant (trou Hermes #1)** :
  La gate `stop` mappe sur `on_session_end` qui est NON bloquant (`canBlock: false`, status
  `degraded`). Le mécanisme de compensation est le suivant :

  1. Au `on_session_end`, le plugin hima ÉVALUE la gate `stop` via `hima hook stop` et
     PERSISTE le résultat (`decision`, `finalState`, `reason`) dans un fichier d'état
     local : `.hima/pending-stop-verdict.json`.

  2. Au tour suivant, lors du premier hook bloquant (`pre_tool_call` ou `pre_llm_call`
     selon ce qui arrive en premier), le plugin hima LIT `.hima/pending-stop-verdict.json`.
     Si `decision === "block"`, le plugin retourne `{"action": "block"}` immédiatement,
     avant tout autre traitement, avec la raison du stop bloqué.

  3. Le fichier `.hima/pending-stop-verdict.json` est supprimé après lecture (single-use).

  4. Si le run se termine définitivement sans tour suivant (session fermée par l'utilisateur),
     le verdict persisté reste en place et bloque le prochain démarrage de session via
     `session_start` (qui lit le fichier au démarrage et rejette le run avec
     `decision: "block"` si un verdict stop non-résolu est présent).

  Ce mécanisme est le seul moyen d'enforcer la gate `stop` sur Hermes. Toute implémentation
  qui ignore `pending-stop-verdict.json` viole ce contrat.

---

## HIGH items

### Mapping complet GateType → hook Hermes

| GateType       | Hook Hermes natif      | canBlock | Status   | Stratégie de compensation |
|----------------|------------------------|----------|----------|---------------------------|
| session_start  | on_session_start       | false    | degraded | Observer + context injection (non bloquant) ; lire pending-stop-verdict.json |
| user_prompt    | pre_llm_call           | true     | supported | Bloquer ou injecter en user-message |
| pre_tool       | pre_tool_call          | true     | supported | Bloquer le tool call |
| post_tool      | post_tool_call         | false    | degraded | Observer uniquement ; violations reportées dans pending-stop-verdict.json si critiques |
| pre_compact    | pre_compact            | true     | supported | Bloquer si état de snapshot absent |
| post_compact   | post_compact           | false    | degraded | Observer + vérifier continuité ; violation → pending-stop-verdict.json |
| stop           | on_session_end         | false    | degraded | Persister verdict dans pending-stop-verdict.json (voir §stop non bloquant) |
| subagent_start | (absent)               | false    | absent   | Compensation via pre_tool_call/delegate_task (voir §propagation sub-agents) |
| subagent_stop  | subagent_stop          | false    | degraded | Observer uniquement |

(Source primaire : `packages/adapter-hermes-v2/src/hook-bindings.ts` + `capability-map.ts`.)

- [HIGH][BLOCKS:high] Les gates avec status `supported` (`user_prompt`, `pre_tool`,
  `pre_compact`) DOIVENT être branchées en phase Wave 3. Ce sont les seuls points où hima
  peut exercer une gouvernance effective sur Hermes.

- [HIGH][BLOCKS:high] Les gates avec status `degraded` (`session_start`, `post_tool`,
  `post_compact`, `stop`, `subagent_stop`) sont observables uniquement. Leur logique
  d'évaluation S'EXÉCUTE quand même (pour persister des verdicts ou pour l'audit), mais
  le plugin NE PEUT PAS bloquer l'exécution à ce point.

- [HIGH][BLOCKS:high] La gate `subagent_start` est `absent` sur Hermes. Le plugin hima ne
  reçoit aucun événement natif pour l'intercepter. La compensation OBLIGATOIRE est
  l'interception du call `delegate_task` via `pre_tool_call` : quand `event.toolName ===
  "delegate_task"`, le plugin traite l'événement comme un `subagent_start`, évalue la gate
  correspondante, et bloque si nécessaire.

- [HIGH][BLOCKS:low] **Format de réponse du plugin par cas :**
  - Bloquer : `{"action": "block", "message": "<raison hima>"}`
  - Injecter du contexte (pre_llm_call) : `{"action": "continue", "content": "<règles hima injectées en user-message>"}`
  - Laisser passer : `{"action": "continue"}` ou réponse vide selon la version Hermes
  - Observer sans effet (hooks non bloquants) : ne pas retourner d'action bloquante ;
    logger le verdict localement

- [HIGH][BLOCKS:low] **Profils et HERMES_HOME** : Les profils Hermes sont sticky globalement
  (issue Hermes #18594). Le plugin hima NE DOIT PAS supposer qu'un changement de profil
  mid-session est possible. Règle opératoire :
  - Toujours passer `HERMES_HOME=~/.hermes/profiles/<name>` explicitement à l'invocation.
  - Un switch de profil requiert un redémarrage complet de la session Hermes.
  - Le plugin hima doit logger un avertissement si `HERMES_HOME` n'est pas défini au
    démarrage de session.

- [HIGH][BLOCKS:none] **Déduplication des événements subagent_stop** (bug observé en live,
  PROPOSITION.md §12 — Backlog spec Wave 1.5) : le hook `subagent_stop` a rejoué ≥6 fois
  le même événement pour un agent déjà terminé. Le plugin DOIT maintenir un registre
  en mémoire (ou dans `.hima/session-state.json`) des `(agentId, event)` déjà traités.
  Si `(agentId, "subagent_stop")` est déjà dans le registre, le plugin retourne
  `{"action": "continue"}` sans réévaluer la gate.

---

## MEDIUM items

### Propagation des règles aux sub-agents (trou Hermes #2)

- [MEDIUM][BLOCKS:high] **Problème** : Les sub-agents Hermes ont `skip_context_files=True`
  hardcodé. Les règles hima injectées via `.hermes.md` ne se propagent PAS aux agents
  enfants. (Source : PROPOSITION.md §4.)

- [MEDIUM][BLOCKS:high] **Mécanisme de propagation requis** :
  Quand le plugin intercepte un appel `delegate_task` via `pre_tool_call` et que la gate
  `subagent_start` retourne `allow`, le plugin DOIT injecter les règles hima dans le
  payload du `delegate_task` avant de laisser passer. Format d'injection :

  ```json
  {
    "action": "continue",
    "modifications": {
      "task": "<task originale>\n\n---\n[HIMA RULES INJECTED]\n<règles hima sérialisées>\n---"
    }
  }
  ```

  Les "règles hima sérialisées" sont le résultat de `hima hook session-start --format hermes`
  pour le sub-agent : criticality actuelle, gates actives, profil applicable.

- [MEDIUM][BLOCKS:low] L'injection de règles doit être idempotente : si les règles hima sont
  déjà présentes dans le payload `task` (marqueur `[HIMA RULES INJECTED]`), le plugin ne
  les réinjecte pas.

- [MEDIUM][BLOCKS:none] La propagation s'applique uniquement aux sub-agents de profondeur 1
  (profondeur maximale portée dans `evaluateSubagentStart` : `depth <= 1`). Les sub-agents
  de niveau 2+ sont interdits par la gate.

### Comportement post_tool dégradé

- [MEDIUM][BLOCKS:low] Quand `post_tool_call` retourne une violation critique (`decision:
  "block"` ou `decision: "warn"` avec `policyEvent.severity === "critical"`), le plugin
  DOIT persister un verdict partiel dans `.hima/pending-stop-verdict.json` avec
  `source: "post_tool"`, `violationType`, et `ts` (timestamp ISO8601). Ce verdict bloquera
  le stop au tour suivant via le mécanisme de compensation décrit dans §CRITICAL.

- [MEDIUM][BLOCKS:none] Les violations non-critiques de `post_tool` (warnings sans
  `policyEvent`) sont loguées localement (`.hima/gate-log.jsonl`) mais ne bloquent pas
  le run en cours.

### Comportement subagent_stop dégradé

- [MEDIUM][BLOCKS:low] Quand `subagent_stop` évalue une violation (`SUBAGENT_DELIVERABLES_MISSING`
  ou `SUBAGENT_WITHOUT_TRACE`), le plugin DOIT persister un verdict partiel dans
  `.hima/pending-stop-verdict.json` (même mécanisme que post_tool). Le sub-agent concerné
  ne peut pas être re-spawné (la gate `subagent_start` le bloquera sur le prochain appel
  avec le même `agentId`).

---

## LOW items (détail de convergence)

- [LOW][BLOCKS:none] `pre_compact` est `supported` (bloquant) sur Hermes. L'implémentation
  de la gate dans `@harness/core` (`evaluatePreCompact`) retourne `allow` avec context
  injection — elle ne bloque que si l'état de snapshot est absent. En Wave 3, vérifier
  que le snapshot d'état (`CompactionCriticalState`) est bien sérialisable dans le
  context injection pour être rétabli après compaction.

- [LOW][BLOCKS:none] Le format des commandes CLI (`hima hook <event> --format hermes`) est
  déjà spécifié dans `hima-cli/src/commands/hook.ts`. Le flag `--format hermes` formate
  la réponse dans le schéma attendu par le plugin Hermes. À valider en Wave 3 que le
  format de sortie correspond au schéma effectif de l'API Hermes plugin.

- [LOW][BLOCKS:none] `session_start` est `degraded` (non bloquant). Son évaluation produit
  un `contextInjection` qui contient l'état courant (runId, riskClass, phase, mode). Ce
  contexte est injecté dans le premier `pre_llm_call` du tour (enchaînement `session_start`
  → `user_prompt` → injection dans pre_llm_call).

- [LOW][BLOCKS:none] Magic-words : la détection des keywords hima (`/ulw|ultrawork/i` etc.)
  n'a pas d'interception déterministe côté CLI Hermes. Elle DOIT vivre dans le plugin sur
  le hook `pre_llm_call` (avant que le message atteigne le LLM) ou `pre_gateway_dispatch`
  (après). Pattern requis : `\b(ulw|...)\s*$` (magic word en FIN de message uniquement,
  per PROPOSITION.md §12 — correction du faux positif détecté en live).
  (Source : PROPOSITION.md §12, §7.)

---

## HIGH items — Enregistrement et configuration du plugin

- [HIGH][BLOCKS:critical] Le plugin hima est un plugin Python Hermes (ou bridge Node.js
  selon l'interface Hermes v0.12.x). Son enregistrement se fait dans le profil Hermes
  actif via `HERMES_HOME` :

  ```
  HERMES_HOME=~/.hermes/profiles/<name>
  ~/.hermes/profiles/<name>/
    hermes.toml          ← config du profil + liste des plugins
    plugins/
      hima/              ← répertoire du plugin hima
        plugin.toml      ← déclaration du plugin
        main.py          ← point d'entrée (ou main.js si bridge Node)
  ```

  Structure minimale de `plugin.toml` :
  ```toml
  [plugin]
  name = "hima"
  version = "0.1.0"

  [hooks]
  pre_tool_call = true
  pre_llm_call = true
  on_session_start = true
  on_session_end = true
  post_tool_call = true
  pre_compact = true
  post_compact = true
  subagent_stop = true
  # subagent_start : absent sur Hermes — compensé via pre_tool_call/delegate_task
  ```

- [HIGH][BLOCKS:critical] Le plugin lit sa configuration depuis deux sources par ordre
  de priorité :
  1. Variable d'environnement `HIMA_PROJECT_ROOT` — chemin vers la racine du projet
     (contient `.hima/`). Obligatoire en production.
  2. Répertoire courant au démarrage de la session Hermes — fallback si
     `HIMA_PROJECT_ROOT` absent. Le plugin log un avertissement dans ce cas.

- [HIGH][BLOCKS:high] Le plugin invoque `hima hook <event> --format hermes --root
  $HIMA_PROJECT_ROOT` pour chaque hook, en passant le payload de l'événement sur stdin
  et en lisant la décision sur stdout. Le plugin NE DOIT PAS embarquer la logique
  d'évaluation : toute décision passe par le CLI `hima`.

- [HIGH][BLOCKS:low] Si `hima` est absent du PATH ou si `HIMA_PROJECT_ROOT` pointe
  vers un répertoire sans `.hima/`, le plugin DOIT dégrader gracieusement :
  - Logger l'erreur dans `.hima/gate-log.jsonl` (ou stderr si `.hima/` inaccessible).
  - Retourner `{"action": "continue"}` pour ne pas bloquer la session.
  - Jamais crasher silencieusement ou retourner une réponse mal formée.

---

## Démonstration d'acceptation (critères binaires n°3, 4, 5)

La démonstration ci-dessous est le test d'acceptation minimum pour valider l'adapter Hermes.
Elle correspond au critère binaire n°3 de `.omc/ultragoal/brief.md`.

### Scénario

1. Lancer une session Hermes avec le plugin hima activé.
2. Configurer la risk class à `M` (ou supérieure) : `riskClass: "M"`.
3. Configurer l'état en phase `discovery`, sub_phase `Plan` (zone d'écriture limitée).
4. L'agent tente d'exécuter `Bash` avec la commande `rm -rf /tmp/test` (D1 — destructive op).
5. Le hook `pre_tool_call` du plugin hima est déclenché.
6. Le plugin appelle `hima hook pre-tool-use --format hermes` avec le payload de l'événement.
7. `evaluateGate` retourne `{ decision: "block", violationType: "BYPASS_ATTEMPTED", ... }`
   (destructive op en M0 ou write zone violation en M1).
8. Le plugin retourne `{"action": "block", "message": "pre_tool blocked: ..."}` à Hermes.

### Critère n°3 — Succès (binaire)

- [CRITICAL][BLOCKS:none] **PASS** : Hermes n'exécute pas la commande `rm -rf /tmp/test`.
  Le fichier (s'il existait) est intact. L'agent reçoit le message de blocage.
- [CRITICAL][BLOCKS:none] **FAIL** : La commande s'exécute. Le critère n°3 n'est pas satisfait
  et Wave 3 ne peut pas être déclarée DONE_VERIFIED.

### Invariants additionnels à vérifier dans le même test (critère 3)

- [HIGH][BLOCKS:none] Le plugin logue l'événement dans `.hima/gate-log.jsonl` avec
  `gateType`, `decision`, `violationType`, `ts`.
- [HIGH][BLOCKS:none] Aucune régression sur les tool calls autorisés (ex. : `Read` sur un
  fichier dans la zone autorisée passe sans blocage).
- [MEDIUM][BLOCKS:none] Le format JSON retourné par le plugin est parsable par Hermes
  (pas de champ inconnu qui ferait échouer la désérialisation).

---

## Critère d'acceptation binaire n°4 — Session complète de bout en bout

Source : `.omc/ultragoal/brief.md` critère 4.

### Scénario

1. Démarrer une session Hermes avec le plugin hima activé et `HIMA_PROJECT_ROOT` pointant
   vers un projet hima initialisé (`.hima/` présent avec `current-risk.json` à `T`).
2. **Parler** : l'utilisateur envoie un message décrivant une tâche (ex. : "ajoute un test
   pour la fonction classifyRisk").
3. **Classification criticality** : le hook `pre_llm_call` évalue `user_prompt`. La gate
   classe la tâche selon les signaux du message (fichiers mentionnés, labels). Le fichier
   `.hima/current-risk.json` est mis à jour avec la risk class calculée.
4. **Magic-word `/ulw`** : l'utilisateur envoie un message se terminant par `/ulw`.
   Le keyword detector dans `pre_llm_call` détecte le token `ulw` en fin de message
   (pattern `\bulw\s*$`) et injecte le mode d'exécution parallèle via `content` injection.
5. **Verify** : en fin de tâche, le hook `on_session_end` évalue la gate `stop`. Pour
   une tâche de risk class T, `requiresEvidenceBeforeStop=false` → verdict `allow +
   DONE_VERIFIED` sans evidence set. Le plugin logue le verdict final.

### Critère n°4 — Succès (binaire)

- [CRITICAL][BLOCKS:none] **PASS** : les 5 étapes ci-dessus s'enchaînent sans erreur.
  Le fichier `.hima/gate-log.jsonl` contient les entrées `user_prompt` et `stop` avec
  leurs décisions. Le verdict final est `DONE_VERIFIED`.
- [CRITICAL][BLOCKS:none] **FAIL** : toute interruption non intentionnelle du flux
  (plugin crash, hook non déclenché, gate bloquant une étape légitime, `/ulw` non détecté).

---

## Critère d'acceptation binaire n°5 — Magic-word non déclenché en milieu de phrase

Source : `.omc/ultragoal/brief.md` critère 5.

### Scénario

1. L'utilisateur envoie : `"dans OMO il y a un système ulw qui fait de l'exécution parallèle"`.
2. Le keyword detector dans `pre_llm_call` évalue le message.
3. Le pattern `\bulw\s*$` ne matche PAS car `ulw` est en milieu de phrase, pas en fin.
4. Le message est transmis au LLM sans injection de mode d'exécution.

### Critère n°5 — Succès (binaire)

- [CRITICAL][BLOCKS:none] **PASS** : aucune injection de mode d'exécution. Le LLM
  reçoit le message original. Aucune entrée `keyword_detected` dans `.hima/gate-log.jsonl`
  pour ce message.
- [CRITICAL][BLOCKS:none] **FAIL** : le keyword `ulw` est détecté en position non-finale
  et le mode d'exécution est injecté — faux positif, violation du contrat magic-word.

---

## Falsifies-If

```
kill-condition: Le plugin hima retourne {"action":"block"} pour un tool call autorisé
  (faux positif), ou laisse passer un tool call interdit (faux négatif), lors de la démo
  du critère n°3.
checkpoint-date: 2026-07-15
evidence-anchor: .hima/gate-log.jsonl (entrée pre_tool pour le tool call de test)
on-fail: Bloquer Wave 3 ; diagnostiquer via `hima hook pre-tool-use --format hermes`
  en CLI direct ; corriger l'évaluation de gate avant tout autre test.

kill-condition: La session complète parler→classification→/ulw→verify (critère n°4)
  ne fonctionne pas de bout en bout après livraison de Wave 3.
checkpoint-date: 2026-07-15
evidence-anchor: .hima/gate-log.jsonl (entrées user_prompt + stop de la session de test)
on-fail: Identifier l'étape défaillante (classification? injection magic-word? gate stop?);
  ouvrir un ticket Wave 3 ciblé ; ne pas déclarer Wave 3 DONE_VERIFIED.

kill-condition: Le magic-word `ulw` se déclenche quand il apparaît en milieu de phrase
  (critère n°5 — faux positif tel qu'observé en live avec OMC, PROPOSITION.md §12).
checkpoint-date: 2026-07-15
evidence-anchor: packages/adapter-hermes-v2/src/ (implémentation keyword detector)
on-fail: Corriger le pattern regex vers `\bulw\s*$` (fin de message uniquement) ;
  ajouter un test unitaire couvrant explicitement la position mid-phrase.

kill-condition: Le mécanisme pending-stop-verdict.json n'est pas implémenté et des
  sessions Hermes à risque M/H/C se terminent sans verdict de gate stop.
checkpoint-date: 2026-08-01
evidence-anchor: packages/adapter-hermes-v2/src/, .hima/ (fichier ou section run-set)
on-fail: ADR requis sur le choix du mécanisme (fichier séparé vs section run-set.json)
  avant tout commit Wave 3 touchant le hook on_session_end.
```

---

## Contradictions détectées

### C-007-01 — hook-bindings.ts vs capability-map.ts : canBlock pour post_tool_call

**Source A** : `packages/adapter-hermes-v2/src/hook-bindings.ts` ligne 38 déclare
`post_tool: { nativeEvent: "post_tool_call", canBlock: false }`.

**Source B** : `packages/storage-core/src/capability-map.ts` ligne 112-114 déclare
`post_tool: { gateType: "post_tool", level: "degraded", note: "post_tool_call is observable but cannot block." }`.

**Cohérence** : Les deux sources sont cohérentes sur le fait que `post_tool_call` ne peut
pas bloquer. Pas de contradiction réelle — juste une confirmation croisée. Noté ici car
le nom du hook (`post_tool_call`) mérite vérification contre la documentation officielle
Hermes v0.12.x (non disponible dans le repo).

**Question ouverte** : Le nom exact du hook Hermes est-il bien `post_tool_call` ou
`after_tool_call` ? La lane Hermes dans PROPOSITION.md §4 ne précise pas le nom exact
de ce hook parmi les 17. À confirmer contre la doc Hermes 0.12.x avant Wave 3.

### C-007-02 — subagent_stop : hook présent dans hook-bindings mais absent de PROPOSITION.md

**Source A** : `packages/adapter-hermes-v2/src/hook-bindings.ts` ligne 43 déclare
`subagent_stop: { nativeEvent: "subagent_stop", canBlock: false }`.

**Source B** : PROPOSITION.md §4 liste les trous Hermes comme incluant
`skip_context_files=True` pour les sub-agents, mais ne mentionne pas explicitement si
`subagent_stop` est un hook natif ou non. La liste des 17 hooks Hermes n'est pas
reproduite exhaustivement dans le repo.

**Impact** : Si `subagent_stop` n'est pas un hook natif Hermes réel, le binding est
incorrect et la déduplication des événements (§HIGH) ne pourra pas se baser sur ce hook.

**Résolution requise** : Vérifier contre la doc Hermes v0.12.x que `subagent_stop` existe
bien comme hook natif. Si absent, reclasser en `absent` (comme `subagent_start`) et
adapter la stratégie de compensation.

### C-007-03 — Format d'injection pre_llm_call : non spécifié dans le code Wave 1

**Source A** : PROPOSITION.md §4 dit que `pre_llm_call` "injecte du contexte (user message
uniquement)".

**Source B** : `packages/adapter-hermes-v2/src/` ne contient pas d'implémentation du
mécanisme d'injection. Le format exact de la réponse (`{"action": "continue", "content":
"..."}`) n'est pas validé contre l'API Hermes réelle dans le code livré Wave 1.

**Impact** : Le format spécifié dans ce document (§HIGH — Format de réponse) est une
extrapolation depuis PROPOSITION.md. Il doit être validé contre la doc Hermes avant
d'être codé en Wave 3.

**Résolution requise** : Obtenir le schéma de réponse officiel du plugin Hermes v0.12.x
pour `pre_llm_call` et `pre_tool_call` avant l'implémentation Wave 3.

### C-007-04 — pending-stop-verdict.json : mécanisme non implémenté en Wave 1

**Source A** : PROPOSITION.md §4 dit que "la gate finale DONE/PARTIAL/BLOCKED devra passer
par `pre_tool_call`/`pre_llm_call` du tour suivant" pour compenser le stop non bloquant.

**Source B** : Le code livré Wave 1 (`packages/adapter-hermes-v2/`) ne contient pas
d'implémentation de ce mécanisme. `hook-bindings.ts` documente le status `degraded` mais
ne spécifie pas le fichier d'état intermédiaire.

**Impact** : Le mécanisme `pending-stop-verdict.json` spécifié dans ce document est une
proposition de design — elle n'est pas encore validée par une implémentation. Elle pourrait
être remplacée par un autre mécanisme (ex. : state dans `.hima/run-set.json`) selon les
contraintes découvertes en Wave 3.

**Question ouverte** : Le mécanisme `pending-stop-verdict.json` doit-il être un fichier
séparé ou une section dans le `run-set.json` existant ? Trancher en début de Wave 3 avant
implémentation (decision-record-discipline.md : ADR requis pour ce choix de data model).
