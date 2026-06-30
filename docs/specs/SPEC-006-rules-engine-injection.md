# SPEC-006 — Rules Engine et Injection d'Instructions par Chemin

status: draft
date: 2026-06-11
version: 0.1
source: PROPOSITION.md §6, §12 ; lane-omo.md §3, §4 ; ultragoal/brief.md Wave2-MélangeOMO
claim-bearing: true

---

## Contexte et décisions fondateur actées

Le fondateur a confirmé (R3-2, §12 PROPOSITION.md) :

- Le rules-engine est repris du pattern OMO (mécanismes réimplémentés, pas copiés — licence SUL-1.0).
- Sources priorisées : `.hima/rules/` > `.claude/rules/` > `.cursor/rules/`.
- Matching picomatch + cache LRU.
- Injection au `pre_tool_call` sur le fichier touché par l'outil.
- AGENTS.md walk-up root-to-leaf injecté en `[Directory Context]`.
- `disciplines.md` (project-disciplines) devient une source de règles du rules-engine.
- `project-init` scaffolde la structure `.hima/rules/`.
- Les sub-agents Hermes ne lisent pas les context files (`skip_context_files=True` hardcodé) → propagation des règles via le hook `pre_tool_call`/`delegate_task` du plugin hima.

---

## CRITICAL items

- [CRITICAL][BLOCKS:critical] Le matching de règles utilise **picomatch uniquement** — pas de regex, pas de grep de contenu. Un fichier touché par un outil déclenche la résolution des règles dont les globs correspondent à son chemin relatif à la racine projet OU à son basename.

- [CRITICAL][BLOCKS:critical] Les règles sont injectées au hook **`pre_tool_call`** (avant l'exécution de l'outil), sur le chemin cible de l'outil (fichier lu, écrit, ou édité). Les règles `alwaysApply: true` sont injectées indépendamment du fichier touché.

- [CRITICAL][BLOCKS:critical] Les sources de règles sont priorisées dans cet ordre (priorité décroissante) : `.hima/rules/` (0) > `.claude/rules/` (1) > `.cursor/rules/` (2). À priorité égale, les règles les plus proches du fichier touché (distance de répertoire minimale) priment sur les règles plus distantes.

- [CRITICAL][BLOCKS:high] La propagation des règles aux sub-agents Hermes est obligatoire. Hermes hardcode `skip_context_files=True` pour les agents enfants — les règles hima injectées via `.hermes.md` ne se propagent pas naturellement. La propagation doit passer par le hook `pre_tool_call` / `delegate_task` du plugin hima : quand un agent délègue une tâche, les règles applicables au contexte courant sont injectées dans le prompt de délégation.

- [CRITICAL][BLOCKS:high] Le dédup par session est obligatoire : une règle dont le chemin réel (`realpath`) a déjà été injectée dans la session courante ne l'est pas une seconde fois. Cache par `Set<string>` de realpaths par `sessionId`.

---

## HIGH items

- [HIGH][BLOCKS:high] Format d'une règle (fichier `.md` dans un dossier de rules) :

```markdown
---
description: "Description courte de la règle"
globs:
  - "src/**/*.ts"
  - "!**/*.test.ts"
alwaysApply: false
---

Contenu de la règle injecté dans le contexte…
```

  Champs frontmatter :
  - `description` (string, optionnel) : aide humaine, non utilisé pour le matching.
  - `globs` (string[], optionnel) : liste de patterns picomatch. Supporte les négations (`!`). Peut aussi être inline : `globs: ["src/**/*.ts"]`.
  - `alwaysApply` (boolean, défaut `false`) : si `true`, injectée pour tout outil, quel que soit le fichier touché.
  - Alias acceptés : `paths`, `applyTo` (synonymes de `globs`, mergés — rétrocompatibilité `.cursor/rules/`).
  - Extensions valides : `.md`, `.mdc`.

- [HIGH][BLOCKS:high] Algorithme de matching (`shouldApplyRule`) :

  1. Si `alwaysApply: true` → matcher (raison : `"alwaysApply"`).
  2. Pour chaque pattern de `globs` :
     - Tester contre `relative(projectRoot, filePath)` (chemin relatif depuis la racine).
     - Tester contre `basename(filePath)` (nom de fichier seul).
     - Utiliser `picomatch(pattern, { dot: true, bash: true })`.
  3. Patterns négatifs `!` : si un pattern positif a matché et qu'un pattern négatif matche aussi → la règle n'est PAS appliquée.
  4. Si au moins un pattern positif matche et aucun négatif ne l'annule → matcher.
  5. Cache LRU de matchers compilés (256 entrées maximum, clé = pattern string).

- [HIGH][BLOCKS:high] Sources de règles et scan :

  Sources **locales** (découverte en remontant depuis `dirname(fichierTouché)` vers la racine projet, distance croissante) :
  - `.hima/rules/` (priorité 0)
  - `.claude/rules/` (priorité 1)
  - `.cursor/rules/` (priorité 2)

  Sources **globales** (distance fixe `GLOBAL_DISTANCE = 9999`) :
  - `~/.hima/rules/` (priorité 100)
  - `~/.claude/rules/` (priorité 101)
  - `~/.cursor/rules/` (priorité 102)

  Tri des candidats : `(isGlobal asc, distance asc, prioritySource asc, relativePath, realPath)` — local proche d'abord. Dédup par `realpath` ET par hash de contenu (`sha256` 16 hex) pour éviter la double injection d'un même contenu présent dans deux sources.

- [HIGH][BLOCKS:high] Walk-up AGENTS.md root-to-leaf :

  - `findAgentsMdUp({ startDir, rootDir, skipRoot? })` : monte de `startDir` vers `rootDir` via `dirname()`, teste `AGENTS.md` à chaque niveau, vérifie que le chemin canonique (`realpathSync`) reste sous `rootDir` (anti symlink-escape), accumule puis `reverse()` → ordre root-to-leaf.
  - `skipRoot` (défaut `true`) : exclut l'AGENTS.md racine (déjà injecté par le contexte principal du harness).
  - Injection : pour chaque AGENTS.md trouvé, si le **dossier** n'est pas déjà dans le cache de session, lire et appender : `\n\n[Directory Context: <abs path AGENTS.md>]\n<contenu>`.
  - Troncature : si le contenu dépasse un seuil configurable (défaut 4000 chars), tronquer avec notice `[...tronqué à 4000 chars]`.
  - Cache : `Map<string, string[]>` par clé `startDir\0rootDir\0skipRoot`.

- [HIGH][BLOCKS:low] Intégration project-disciplines :

  - `disciplines.md` (fichier de disciplines du projet, chemin configurable — défaut `.hima/disciplines.md` ou `.claude/disciplines.md`) est traité comme **une règle `alwaysApply: true`** du rules-engine. Il est injecté pour tout outil, toute session.
  - Si `disciplines.md` contient un frontmatter valide (`globs`, `alwaysApply`), il est traité comme n'importe quelle autre règle.
  - Si `disciplines.md` n'a pas de frontmatter, le rules-engine lui injecte implicitement `alwaysApply: true`.
  - Le `discipline-guard` (gate bloquante issue de PROPOSITION.md §3) lit `disciplines.md` via le rules-engine — pas directement. Source unique.

- [HIGH][BLOCKS:low] Intégration project-init :

  - `project-init` scaffolde la structure `.hima/rules/` lors de l'initialisation d'un projet.
  - Structure scaffoldée minimale :
    ```
    .hima/
      rules/
        .gitkeep            # rend le dossier versionnable
      disciplines.md        # template disciplines vide (alwaysApply: true implicite)
    ```
  - `project-init` ne crée pas de règles préremplies au-delà du template vide — les règles sont écrites par le fondateur ou par les agents au fil du projet.

- [HIGH][BLOCKS:low] Propagation aux sub-agents (trou Hermes `skip_context_files`) :

  - Quand le plugin hima intercepte un `delegate_task` (sub-agent Hermes), il collecte les règles `alwaysApply: true` + les règles applicables au chemin de travail du sous-agent.
  - Ces règles sont injectées dans le prompt de délégation sous la forme d'un bloc `[Injected Rules]\n<contenu règle 1>\n---\n<contenu règle 2>`.
  - Limite : seules les règles dont la taille totale est inférieure à un seuil configurable (défaut 8000 chars) sont propagées. Les règles dépassant le seuil sont résumées par leur `description` avec une note `[règle tronquée]`.
  - Ce comportement est documenté comme mitigation du trou Hermes `skip_context_files=True` (PROPOSITION.md §4).

---

## MEDIUM items (convergence)

- [MEDIUM][BLOCKS:low] Dossiers exclus du scan de règles (ne pas descendre dans) : `node_modules/`, `.git/`, `dist/`, `build/`, `.cache/`. Liste configurable via `.hima/config.json`.

- [MEDIUM][BLOCKS:low] La détection de la racine projet se fait par remontée jusqu'au premier répertoire contenant un `PROJECT_MARKER` : `.git`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `.venv`. Le premier marqueur trouvé en remontant définit la racine.

- [MEDIUM][BLOCKS:low] Cache LRU du rules-engine : 256 matchers picomatch compilés en mémoire. Invalidé sur changement de fichier dans un dossier de rules (via watcher `fs.watch` ou invalidation manuelle à `session_start`).

- [MEDIUM][BLOCKS:none] Le parser frontmatter est maison (pas de lib YAML externe) : supporte scalaires, arrays inline `[a, b]`, arrays multiline `- item`, valeurs quotées, commentaires `#`, CSV `"a, b"` splité.

- [MEDIUM][BLOCKS:none] Les règles globales (`~/`) s'appliquent à tous les projets. Elles peuvent être désactivées par projet via `.hima/config.json` : `globalRules: false`.

---

## LOW items (convergence tail)

- [LOW][BLOCKS:none] Compatibilité cross-harness by design : le rules-engine lit nativement `.claude/rules/`, `.cursor/rules/`, permettant l'adoption sans migration depuis Claude Code ou Cursor.

- [LOW][BLOCKS:none] Les règles peuvent contenir des liens vers d'autres règles (cross-reference `[[nom-règle]]`) — documentation uniquement, pas de résolution automatique en v0.1.

- [LOW][BLOCKS:none] Une commande `/rules list` (v0.2) pourra afficher les règles actives pour le fichier courant.

---

## Contradictions détectées

1. **AGENTS.md racine skip vs injection globale** : `findAgentsMdUp({ skipRoot: true })` exclut l'AGENTS.md racine au motif qu'il est « déjà injecté par le mécanisme de contexte principal ». Or, pour les sub-agents Hermes (où `skip_context_files=True`), le mécanisme de contexte principal ne fonctionne pas. Il faudra donc décider si `skipRoot` est `false` lors de la propagation aux sub-agents. Décision proposée : `skipRoot: false` dans le contexte de propagation `delegate_task`. À confirmer.

2. **Priorité `.hima/rules/` vs `.claude/rules/` vs comportement hima v1** : l'ancien hima utilise `.claude/rules/` comme source principale (aucune règle `.hima/rules/` n'existe en v1). La présente spec élève `.hima/rules/` à priorité 0. Si des règles `.claude/rules/` actuelles du projet entrent en conflit avec des règles `.hima/rules/` futures, les règles `.hima/rules/` l'emporteront silencieusement. Risque de régression si le fondateur n'est pas informé de ce changement de priorité.

3. **disciplines.md chemin ambigu** : PROPOSITION.md §6 ne précise pas le chemin de `disciplines.md` (`.hima/disciplines.md` ou `.claude/disciplines.md` ou `disciplines.md` racine). La présente spec propose `.hima/disciplines.md` en priorité. Si `project-disciplines` skill utilise un autre chemin conventionnel, une mise à jour de cette spec est nécessaire.

4. **Propagation sub-agents et taille limite** : la limite de 8000 chars pour la propagation des règles aux sub-agents est arbitraire. Si les règles `alwaysApply` du projet sont volumineuses (ex: disciplines.md détaillé), elles pourraient être tronquées, dégradant silencieusement la gouvernance. Une alerte de log devrait être émise quand la troncature survient.

---

## Questions ouvertes pour le fondateur

1. Le chemin canonique de `disciplines.md` est-il `.hima/disciplines.md`, `.claude/disciplines.md`, ou racine du projet ?
2. La priorité `.hima/rules/` > `.claude/rules/` est-elle confirmée, sachant qu'elle peut silencieusement surcharger les règles globales Claude Code actuellement actives ?
3. Pour la propagation sub-agents, `skipRoot: false` lors de `delegate_task` est-il le bon comportement, ou faut-il propager uniquement les règles `alwaysApply` ?
4. La limite de 8000 chars pour la propagation est-elle acceptable, ou faut-il une stratégie de sélection plus fine (ex: propager uniquement par tags de criticality) ?
