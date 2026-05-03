# Proposition V1 - RMS, Runtime Bindings Et Sets De Controle

Statut: draft v1

## Intention

Cette proposition formalise une premiere conception du harness autour d'un RMS
(Runtime Management System) place au-dessus des coding agents.

L'objectif n'est pas de remplacer Claude Code, Codex ou Hermes Agent, mais de
les traiter comme des runtimes d'execution. Le RMS garde la decision, l'etat, la
politique, la preuve et la traduction vers chaque runtime.

Principe central:

```text
Runtime = executor
RMS = controller
Hooks = gates
Skills = procedures
Subagents = isolated workers
MCP = external tools
Evidence Set = source of done
```

## Constat De Depart

Le rapport `report-hermes-cdx-cld.md` montre que Claude Code, Codex et Hermes
Agent partagent des primitives proches:

- instructions persistantes Markdown
- skills sous forme de dossier avec `SKILL.md`
- hooks
- subagents
- MCP
- permissions et sandbox
- logs et observabilite

Mais ces primitives ne sont pas isomorphes.

Les skills et MCP sont les surfaces les plus portables. Les hooks, permissions,
subagents, modes d'autonomie et logs divergent fortement selon les runtimes.

Conclusion de conception:

```text
Le RMS ne doit pas modeliser "un hook Codex" ou "un subagent Claude" comme
concept central.

Il doit modeliser des intentions abstraites: gate, procedure, worker isole,
outil externe, permission, preuve.

Chaque runtime fournit ensuite un binding concret vers ses primitives reelles.
```

## Role Du RMS

Le RMS doit repondre a six questions avant, pendant et apres chaque run:

1. Qu'est-ce que l'utilisateur veut vraiment faire ?
2. Qu'est-ce que le runtime courant permet reellement ?
3. Qu'est-ce que la politique du projet exige ?
4. Quelle trajectoire faut-il choisir ?
5. Ou en est l'execution ?
6. Qu'est-ce qui prouve que le travail est termine ?

Le RMS est donc un control plane, pas un agent supplementaire.

Il ne fait pas tout lui-meme. Il decide, route, trace, contraint, verifie et
persiste.

## Les 8 Sets Canoniques

### 1. Project Set

Verite stable du projet.

Contenu attendu:

- vision produit ou systeme
- contraintes d'architecture
- standards qualite
- conventions repo
- politiques de securite, accessibilite, tests, docs
- chemins et zones de responsabilite

Le Project Set ne doit pas contenir l'etat vivant d'un run.

### 2. Intent Set

Capture de la demande courante.

Contenu attendu:

- objectif utilisateur
- scope
- non-scope
- ambiguities
- risque initial
- autonomie autorisee
- livrable attendu
- definition de done attendue

Le Intent Set est cree par run. Il sert d'entree a la decision RMS.

### 3. Runtime Capability Set

Inventaire de ce que le runtime courant sait vraiment faire.

Contenu attendu:

- runtime actif: `codex`, `claude`, `hermes`, autre
- version detectee
- OS et shell
- permissions et sandbox courants
- hooks disponibles et actifs
- feature flags requis
- skills disponibles
- subagents disponibles et limites
- MCP servers disponibles
- scheduler ou cron disponible
- chemins de config effectifs
- limitations connues

Ce set doit etre produit par inspection quand c'est possible, pas seulement par
documentation.

### 4. Runtime Binding Set

Table de traduction entre les concepts RMS et les primitives reelles du runtime.

Exemple:

```json
{
  "runtime": "codex",
  "bindings": {
    "gate.user_prompt": {
      "primitive": "hook",
      "event": "UserPromptSubmit",
      "canBlock": true
    },
    "gate.pre_tool": {
      "primitive": "hook",
      "event": "PreToolUse",
      "canBlock": true
    },
    "procedure.reusable": {
      "primitive": "skill",
      "format": "SKILL.md"
    },
    "worker.isolated": {
      "primitive": "subagent",
      "spawn": "explicit_only",
      "maxDepth": 1
    },
    "external_tool": {
      "primitive": "mcp",
      "transport": ["stdio", "http"]
    }
  }
}
```

Le Binding Set evite de chercher une syntaxe universelle de hooks. Le modele
doit etre une semantique universelle de gates, avec des bindings differents par
runtime.

### 5. Policy Set

Regles applicables selon le risque, le type de demande et le contexte.

Contenu attendu:

- classes de risque
- gates obligatoires par classe
- conditions de bypass
- conditions d'escalade humaine
- seuils de tests et verification
- exigences de documentation
- exigences de review
- limites d'autonomie

Exemple de logique:

```text
T/F => bypass autorise si diff faible et evidence minimale presente
M   => spec legere + tests cibles + evidence obligatoire
E/C => plan explicite + gates renforces + review + stop humain si ambigu
```

### 6. Route Set

Decision prise par le RMS pour un run.

Contenu attendu:

- mode choisi
- runtime choisi
- pipeline choisi
- gates activees
- skills autorises ou requis
- subagents autorises ou requis
- MCP requis
- alternatives rejetees
- raison de la decision
- seuils de stop

Le Route Set est un decision record executable.

### 7. Run Set

Etat vivant de l'execution.

Contenu attendu:

- phase courante
- taches ouvertes
- taches terminees
- attempts
- boucles detectees
- subagents actifs
- locks ou zones d'ecriture
- blocages
- dernier evenement
- final state possible

Le Run Set peut changer souvent. Il ne doit pas remplacer `events.jsonl`.

### 8. Evidence Set

Preuves de completion.

Contenu attendu:

- commandes lancees
- resultats de tests
- resultats lint/typecheck/build
- fichiers modifies
- decisions de hooks
- sorties subagents
- logs utiles
- screenshots ou verdict visuel si UI
- review
- risques restants
- gaps connus
- niveau de confiance

Regle:

```text
Pas de DONE_VERIFIED sans Evidence Set suffisant.
```

## Relations Entre Sets

Flux logique:

```text
Project Set + Intent Set + Runtime Capability Set + Policy Set
  => Route Set

Route Set + Runtime Binding Set
  => execution runtime

execution runtime + events
  => Run Set

Run Set + Evidence Set + Policy Set
  => Final State
```

Cette separation permet de diagnostiquer les erreurs:

- mauvaise comprehension utilisateur => Intent Set
- mauvaise hypothese runtime => Capability Set
- regle absente ou trop faible => Policy Set
- mauvais choix d'execution => Route Set
- execution instable => Run Set
- faux "done" => Evidence Set

## Structure De Fichiers Proposee

```text
.rms/
  registry/
    policies.yaml
    modes.yaml
    gates.yaml
    runtimes/
      codex.yaml
      claude.yaml
      hermes.yaml

  state/
    project-set.json
    runtime-capability-set.json
    active-run.json

  runs/
    <run-id>/
      intent-set.json
      capability-set.json
      binding-set.json
      policy-set.json
      route-set.json
      run-set.json
      evidence-set.json
      events.jsonl
      decisions.md
```

## Gates Abstraites Minimales

Le RMS devrait commencer avec un petit noyau portable:

```text
gate.session_start
gate.user_prompt
gate.pre_tool
gate.post_tool
gate.stop
gate.subagent_stop
```

Chaque gate a une semantique RMS:

- peut injecter du contexte
- peut bloquer
- peut demander une evidence
- peut signaler une violation de policy
- peut enrichir `events.jsonl`

Le binding runtime decide ensuite si cette gate devient:

- hook Claude
- hook Codex
- hook Hermes gateway/plugin/shell
- wrapper de commande
- verification post-run
- no-op explicite avec limitation tracee

## Final States

Les final states doivent etre explicites:

```text
DONE_VERIFIED
DONE_WITH_GAPS
BLOCKED_NEEDS_USER
BLOCKED_RUNTIME_MISSING
BLOCKED_POLICY
MAX_ATTEMPTS_REACHED
LOOP_DETECTED
CANCELLED
```

Un final state vague comme `finished` ou `complete` ne suffit pas.

## Capacites Ouvertes Par Les Coding Agents

### Skills

Usage RMS recommande:

- procedures reutilisables
- workflows documentes
- operations semi-stables
- gates specialisees
- generateurs d'artefacts

Les skills sont la surface la plus naturelle pour porter les procedures RMS
entre runtimes.

### Hooks

Usage RMS recommande:

- enforcement
- blocage pre-action
- enrichissement de contexte
- capture d'evenements
- stop gate

Les hooks doivent rester derriere le Binding Set, car leur modele varie trop
entre Claude, Codex et Hermes.

### Subagents

Usage RMS recommande:

- travail isole
- exploration parallele
- review
- verification
- recherche externe

Le resultat d'un subagent doit toujours remonter dans `Evidence Set` ou
`events.jsonl`. Il ne doit pas devenir une memoire implicite invisible.

### MCP

Usage RMS recommande:

- integration externe
- acces donnees structurees
- outils repo ou productivite
- ressources partagees

MCP est la primitive la plus standardisee. Le RMS devrait privilegier MCP pour
les outils durables au lieu de wrappers shell ad hoc quand c'est raisonnable.

### Instructions Persistantes

Usage RMS recommande:

- contexte stable
- regles de role
- conventions projet
- modes de collaboration

Elles ne doivent pas contenir le state vivant. Elles orientent les agents, mais
ne prouvent rien.

### Permissions Et Sandbox

Usage RMS recommande:

- les capturer comme capabilities
- refuser les routes qui exigent plus que le runtime courant
- tracer les modes yolo/full access
- ajouter une policy stricte pour les actions destructives

## MVP Recommande

Version minimale a construire avant toute architecture plus large:

1. `registry/runtimes/codex.yaml`
2. `registry/runtimes/claude.yaml`
3. `registry/runtimes/hermes.yaml`
4. `registry/gates.yaml`
5. `registry/policies.yaml`
6. `runtime-capability-set.json` genere par inspection
7. `route-set.json` pour chaque demande
8. `events.jsonl` append-only
9. `evidence-set.json` obligatoire avant `DONE_VERIFIED`

Ce MVP permet de tester la these principale:

```text
Un RMS peut piloter plusieurs coding agents si ses concepts sont abstraits
et si chaque runtime est traite comme un backend avec capabilities et bindings.
```

## Non-Objectifs V1

Cette v1 ne cherche pas encore a faire:

- orchestration multi-repo
- event sourcing complet
- UI dashboard
- marketplace de skills
- scheduler 24/7 complet
- memoire semantique avancee
- modele universel de hooks

Ces sujets peuvent venir apres validation du noyau:

```text
Intent + Capability + Policy => Route
Route + Binding => Execution
Execution + Evidence => Final State
```

## Questions Ouvertes

1. Le RMS doit-il vivre dans `.rms/`, `.planning/`, `.omx/`, ou un dossier propre
   au harness ?
2. Les policies doivent-elles etre YAML declaratif, JSON schema, ou Markdown
   executable par convention ?
3. Faut-il un seul `Project Set` par repo ou un `Project Set` par workspace plus
   des overlays par sous-projet ?
4. Le Capability Set doit-il etre regenere a chaque run ou versionne par session ?
5. Quel est le plus petit schema Evidence Set acceptable pour autoriser
   `DONE_VERIFIED` ?
6. Quels concepts RMS doivent etre hard-blocking, et lesquels peuvent rester en
   warning ?

## Position V1

La bonne abstraction n'est pas:

```text
un meta-agent qui sait tout faire
```

mais:

```text
un control plane RMS qui maintient des sets canoniques, choisit une route,
traduit vers le runtime disponible, puis refuse le "done" sans evidence.
```

