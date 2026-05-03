# CLI Commands Specification — `@harness/cli`

> **Statut** : conception v1
> **Package** : `@harness/cli` (single package, D16)
> **Entrée binaire unique** : `harness <command> [args] [flags]`
> **Date** : 2026-05-03

---

## Résumé

Le CLI est l'interface principale du harness Pipeline Fractale v4. Il sert deux usages distincts :

1. **Usage humain** — installation, init projet, inspection de l'état, transitions, diagnostic.
2. **Usage machine** — `harness hook <event>` appelé par les hooks natifs de la plateforme à chaque événement de cycle de vie.

Architecture de dispatch : les hooks natifs des plateformes (Claude Code, Codex, Hermes) appellent
`harness hook <event-name>`. Une seule entrée binaire, dispatch interne (D14). Pas de daemon.

---

## Flags globaux

Appliqués à toutes les commandes.

| Flag | Type | Description |
|------|------|-------------|
| `--verbose` | boolean | Active les logs détaillés sur stderr |
| `--json` | boolean | Sortie machine-readable JSON sur stdout |
| `--no-color` | boolean | Désactive les codes ANSI couleur |
| `--config <path>` | string | Chemin alternatif vers le fichier de config harness (défaut : `~/.harness/config.yaml`) |

**Priorité de configuration** : flag CLI > variable d'environnement `HARNESS_CONFIG` > `~/.harness/config.yaml`.

---

## Codes de sortie

| Code | Signification |
|------|---------------|
| `0` | Succès |
| `1` | Erreur générique (argument invalide, fichier manquant, erreur I/O) |
| `2` | Gate bloquée — action refusée par une politique ou un guard de transition |
| `3` | État invalide — `state.yaml` corrompu, incohérent ou absent |

---

## 1. `harness install`

### Synopsis

```
harness install --target <platform> [--dry-run] [--force]
```

### Description

Installe le harness comme plugin natif sur une plateforme cible. Crée les fichiers de
configuration, enregistre les hooks, configure les MCP servers si nécessaire. L'opération
est **idempotente** : safe à ré-exécuter sans effet de bord.

Plateforme cible : `claude` | `codex` | `hermes`.

### Arguments

Aucun argument positionnel.

### Flags

| Flag | Type | Requis | Description |
|------|------|--------|-------------|
| `--target <platform>` | string | oui | Plateforme cible : `claude`, `codex`, `hermes` |
| `--dry-run` | boolean | non | Affiche les actions sans les exécuter |
| `--force` | boolean | non | Réinstalle même si déjà installé (écrase) |

### Comportement

1. Détecte la version de la plateforme installée (`claude --version`, `codex --version`, `hermes --version`).
2. Valide les prérequis : Node ≥ 20, plateforme présente sur PATH, répertoire de config accessible.
3. Copie les artefacts portables (skills, subagents, instructions) dans le répertoire de config de la plateforme.
4. Enregistre les hooks natifs via le format attendu par la plateforme (JSON pour Claude Code, TOML/YAML selon Codex/Hermes).
5. Configure les MCP servers si la plateforme les supporte.
6. Écrit un fichier `~/.harness/platforms/<platform>.installed.yaml` avec la version installée et le timestamp.
7. Vérifie l'installation avec `harness doctor --target <platform>` en mode silencieux.

Si `--dry-run` : affiche chaque action avec le préfixe `[DRY-RUN]`, ne modifie rien.

Si `--force` : supprime d'abord les artefacts existants avant de réinstaller.

### Format de sortie

Mode humain :
```
Installing harness on claude...
  ✓ Detected claude 1.2.3
  ✓ Prerequisites OK
  ✓ Skills installed (12 files)
  ✓ Hooks registered (7 events)
  ✓ MCP servers configured
  ✓ Doctor check passed

Installation complete. Run `harness doctor` to verify.
```

Mode `--json` :
```json
{
  "platform": "claude",
  "version_detected": "1.2.3",
  "actions": ["skills_installed", "hooks_registered", "mcp_configured"],
  "status": "success"
}
```

### Codes de sortie

| Code | Cas |
|------|-----|
| `0` | Installation réussie |
| `1` | Plateforme non trouvée, prérequis manquants, erreur I/O |

### Exemples

```bash
harness install --target claude
harness install --target codex --dry-run
harness install --target hermes --force --verbose
```

---

## 2. `harness uninstall`

### Synopsis

```
harness uninstall --target <platform> [--dry-run]
```

### Description

Suppression propre du harness d'une plateforme. Retire les hooks, skills, subagents,
instructions et MCP servers injectés par `harness install`. Ne touche pas au projet
courant (`.planning/` non affecté).

### Flags

| Flag | Type | Requis | Description |
|------|------|--------|-------------|
| `--target <platform>` | string | oui | Plateforme cible : `claude`, `codex`, `hermes` |
| `--dry-run` | boolean | non | Affiche les suppressions sans les exécuter |

### Comportement

1. Lit le manifeste `~/.harness/platforms/<platform>.installed.yaml` pour identifier les fichiers gérés.
2. Supprime uniquement les fichiers listés dans le manifeste — ne supprime jamais les fichiers non-harness.
3. Retire les entrées de hooks du fichier de settings de la plateforme.
4. Retire les MCP servers enregistrés par harness.
5. Supprime le fichier manifeste.

Protège contre la suppression de fichiers non-harness : si un fichier listé dans le manifeste
a été modifié par l'utilisateur, affiche un avertissement et ne le supprime pas (exit 1 avec liste
des fichiers protégés).

### Format de sortie

```
Uninstalling harness from claude...
  ✓ Hooks removed
  ✓ Skills removed (12 files)
  ✓ MCP entries removed
  ⚠ Skipped: ~/.claude/skills/custom-skill.md (user-modified, not managed by harness)

Uninstall complete.
```

### Codes de sortie

| Code | Cas |
|------|-----|
| `0` | Désinstallation complète |
| `1` | Manifeste absent, erreur I/O, fichiers non-harness détectés et ignorés |

### Exemples

```bash
harness uninstall --target claude
harness uninstall --target codex --dry-run
```

---

## 3. `harness init`

### Synopsis

```
harness init [--name <project-name>] [--description <text>] [--force]
```

### Description

Initialise un projet dans le répertoire courant. Crée les trois fichiers canoniques
dans `.planning/` et le squelette `docs/`, initialise `state.yaml` en phase discovery.
Détecte si le projet
est déjà initialisé.

### Flags

| Flag | Type | Requis | Description |
|------|------|--------|-------------|
| `--name <name>` | string | non | Nom du projet (défaut : basename du cwd) |
| `--description <text>` | string | non | Description courte du projet |
| `--force` | boolean | non | Réinitialise même si déjà initialisé (préserve les sections logiques existantes si possible) |

### Comportement

1. Vérifie si `.planning/state.yaml` existe — si oui et sans `--force`, affiche l'état
   courant et sort avec code 0.
2. Crée les répertoires :
   - `.planning/`
   - `docs/`
3. Écrit `.planning/state.yaml` avec `phase: discovery`, `sub_phase: Observer`,
   `risk_class: null`, `mode: auto`, `run_id: <uuid>`.
4. Écrit `.planning/current-risk.yaml` avec `risk_class: null`, `mode: auto`,
   `justification: "unclassified"`.
5. Écrit `.planning/run-set.json` avec les sections logiques Run Set, Evidence Set,
   événements et transitions.

### Format de sortie

```
Initializing project 'mon-projet'...
  ✓ .planning/ structure created
  ✓ docs/ skeleton created
  ✓ state.yaml initialized (phase: discovery)
  ✓ run-set.json initialized

Project initialized. Current phase: discovery / Observer
Run `harness status` to inspect state.
```

### Codes de sortie

| Code | Cas |
|------|-----|
| `0` | Initialisation réussie, ou déjà initialisé (sans `--force`) |
| `1` | Erreur I/O, permissions insuffisantes |

### Exemples

```bash
harness init
harness init --name "api-gateway" --description "NestJS API avec auth JWT"
harness init --force
```

---

## 4. `harness status`

### Synopsis

```
harness status [--json]
```

### Description

Affiche l'état courant du projet : phase, sous-phase, classe de risque, mode opératoire,
run ID, gaps d'evidence, blockers actifs. Lecture seule, ne modifie rien.

### Comportement

1. Lit `.planning/state.yaml` depuis le cwd (remonte jusqu'à trouver `.planning/`).
2. Lit `.planning/run-set.json` si présent.
3. Calcule les evidence gaps depuis la section Evidence Set logique du run courant vs les exigences de
   la Policy Set pour la phase et la classe de risque courantes.
4. Identifie les blockers depuis la section Run Set.

Si le projet n'est pas initialisé : message d'erreur explicite, suggestion de `harness init`.

### Format de sortie

Mode humain (tableau) :
```
┌─────────────────┬──────────────────────────────┐
│ MacroCycle      │ build                        │
│ SubPhase        │ Execute                      │
│ Risk class      │ L (Low)                      │
│ Mode            │ auto                         │
│ Run ID          │ run-2026-05-03-a7f2          │
│ Evidence gaps   │ tests (missing), lint (ok)   │
│ Blockers        │ none                         │
└─────────────────┴──────────────────────────────┘
```

Mode `--json` :
```json
{
  "phase": "build",
  "sub_phase": "Execute",
  "risk_class": "L",
  "mode": "auto",
  "run_id": "run-2026-05-03-a7f2",
  "evidence_gaps": ["tests"],
  "blockers": [],
  "final_state": null
}
```

### Codes de sortie

| Code | Cas |
|------|-----|
| `0` | Succès |
| `1` | Projet non initialisé, erreur de lecture |
| `3` | `state.yaml` corrompu ou incohérent |

### Exemples

```bash
harness status
harness status --json | jq '.phase'
```

---

## 5. `harness hook`

### Synopsis

```
harness hook <event-name>
```

Event JSON lu sur **stdin**. Décision JSON écrite sur **stdout**. Logs sur stderr uniquement.

### Description

Dispatcher d'événements de cycle de vie. Appelé par les hooks natifs de la plateforme.
Lit l'event payload depuis stdin, évalue les gates, retourne une décision allow/block
sur stdout. **Target : < 100 ms** (appelé à chaque outil utilisé par l'agent).

### Arguments

| Argument | Requis | Valeurs |
|----------|--------|---------|
| `<event-name>` | oui | Label d'adapter runtime, ex. `pre_tool_use`, `post_tool_use`, `user_prompt_submit`, `session_start`, `stop`, `subagent_start`, `subagent_stop` |

### Comportement

1. Lit le JSON d'événement depuis stdin (timeout 50 ms — si absent, allow immédiat).
2. Charge `state.yaml` depuis le projet courant (cwd, résolution par remontée d'arbre).
3. Évalue les gates applicables à l'événement selon la phase et la classe de risque courantes.
4. Écrit la décision JSON sur stdout.
5. Appende un enregistrement dans la section `events` de `.planning/run-set.json` (async, ne bloque pas la décision).

**Chemin critique (doit tenir <100 ms)** :
- Lecture `state.yaml` : YAML synchrone, fichier ≤ 2 KB.
- Évaluation gates : logique pure, pas de I/O réseau.
- Écriture de l'événement logique : fire-and-forget async.

Si `.planning/` est absent : allow immédiat, log sur stderr, pas de bloc.

### Format d'entrée (stdin)

```json
{
  "event": "pre_tool_use",
  "tool_name": "Write",
  "tool_input": { "file_path": "src/auth.ts" },
  "session_id": "sess-abc123",
  "timestamp": "2026-05-03T14:32:00Z"
}
```

### Format de sortie (stdout)

Allow :
```json
{ "decision": "allow" }
```

Block :
```json
{
  "decision": "block",
  "reason": "MacroCycle discovery: écriture de code source interdite avant transition vers build.",
  "gate": "pre_tool",
  "hint": "Run `harness transition build` when ready."
}
```

### Événements supportés

| Événement | Sémantique | Gate évaluée |
|-----------|-----------|--------------|
| `pre_tool_use` | Avant exécution d'un outil | `pre_tool` |
| `post_tool_use` | Après exécution d'un outil | `post_tool` |
| `user_prompt_submit` | Avant traitement d'un prompt utilisateur | `user_prompt` |
| `session_start` | Démarrage de session agent | `session_start` |
| `stop` | Demande d'arrêt de session | `stop` |
| `subagent_start` | Démarrage d'un sous-agent | `subagent_start` |
| `subagent_stop` | Arrêt d'un sous-agent | `subagent_stop` |

Les noms de gauche sont des labels d'adapter externes. Seules les valeurs de droite
sont des `GateType` canoniques PFV4.

### Codes de sortie

| Code | Cas |
|------|-----|
| `0` | Décision émise (allow ou block — les deux sont des succès du dispatcher) |
| `1` | Stdin illisible, event-name inconnu, erreur fatale |

### Exemples

```bash
# Appelé par le hook Claude Code
echo '{"event":"pre_tool_use","tool_name":"Write","tool_input":{"file_path":"src/x.ts"}}' \
  | harness hook pre_tool_use

# Test manuel
echo '{"event":"stop"}' | harness hook stop
```

---

## 6. `harness transition`

### Synopsis

```
harness transition <target-phase> [--reason <text>] [--force]
```

### Description

Demande une transition de phase. Vérifie les guards, valide l'Evidence Set logique, met à jour
`state.yaml`. Affiche ce qui manque si la transition est bloquée.

### Arguments

| Argument | Requis | Valeurs |
|----------|--------|---------|
| `<target-phase>` | oui | `discovery`, `cadrage`, `conception`, `build`, `validation`, `release`, `run`, `learning` |

### Flags

| Flag | Type | Requis | Description |
|------|------|--------|-------------|
| `--reason <text>` | string | non | Raison de la transition (ajoutée à la section `transitions` de `.planning/run-set.json`) |
| `--force` | boolean | non | Bypass des guards — autorisé uniquement sur classe T/L |

### Comportement

1. Lit l'état courant depuis `state.yaml`.
2. Vérifie que la transition est valide dans la state machine (ex : `build → validation` est valide,
   `discovery → release` ne l'est pas).
3. Évalue les guards de la transition pour la classe de risque courante :
   - Evidence Set suffisant ?
   - Critères DoR/DoD respectés ?
4. Si guards OK : met à jour `state.yaml`, appende à la section `transitions`, affiche confirmation.
5. Si guards KO sans `--force` : affiche la liste des gaps, sort avec code `2`.
6. Si `--force` sur classe H/C : erreur hard, code `1` (bypass interdit, D4).

### Format de sortie

Succès :
```
Transitioning build → validation...
  ✓ Evidence: tests (12 passing)
  ✓ Evidence: lint (clean)
  ✓ Evidence: typecheck (clean)
  ✓ Guard: risk class L allows auto-transition

Transition complete. MacroCycle: validation / Observer
```

Bloqué :
```
Transition build → validation blocked.

Missing evidence:
  ✗ tests — no test results found in run-set.json evidence section
  ✗ typecheck — no typecheck output recorded

Add evidence with `harness evidence add` or run your test suite.
Exit code: 2
```

Mode `--json` :
```json
{
  "from": "build",
  "to": "validation",
  "status": "blocked",
  "missing": ["tests", "typecheck"],
  "allowed_with_force": true
}
```

### Codes de sortie

| Code | Cas |
|------|-----|
| `0` | Transition effectuée |
| `1` | Transition invalide dans la state machine, `--force` sur H/C |
| `2` | Guards non satisfaits (evidence manquante) |
| `3` | `state.yaml` corrompu |

### Exemples

```bash
harness transition build
harness transition validation --reason "feature complete, all tests green"
harness transition build --force   # bypass T/L uniquement
```

---

## 7. `harness classify`

### Synopsis

```
harness classify [--auto | --manual <class>] [--reason <text>]
```

### Description

Classifie ou reclassifie la classe de risque du changement courant selon la matrice T/L/M/H/C.
Mode auto : arbre de décision déterministe basé sur les fichiers modifiés et les labels.
Mode manuel : classification explicite avec raison obligatoire.

### Flags

| Flag | Type | Requis | Description |
|------|------|--------|-------------|
| `--auto` | boolean | exclusif | Classification automatique par arbre de décision |
| `--manual <class>` | string | exclusif | Classification manuelle : `T`, `L`, `M`, `H`, `C` |
| `--reason <text>` | string | requis si `--manual` | Justification de la classification manuelle |

Un seul de `--auto` ou `--manual` est accepté. Sans flag : mode interactif (affiche
l'arbre de décision et pose les questions).

### Comportement (mode `--auto`)

L'arbre de décision évalue dans l'ordre :

1. Fichiers touchés contiennent-ils des chemins d'auth, paiement, PII, schéma DB, API publique ? → H
2. Fichiers touchés sont-ils des données santé/biométrie/financières, refonte d'architecture ? → C
3. Changement visible utilisateur sans PII sensible ? → M
4. Nouvelle fonctionnalité isolée derrière feature flag, pas de PII ? → L
5. Cosmétique, doc, refactor sans changement de comportement ? → T

Sources utilisées : `git diff --name-only`, labels PR si disponibles, patterns configurables
dans la section `policy_set` de `.planning/state.yaml`.

### Format de sortie

```
Classifying current change...
  Analyzing: git diff --name-only (14 files)
  ✓ No auth/payment/PII paths detected
  ✓ No schema migrations detected
  ✓ Feature flag detected: FEATURE_NEW_DASHBOARD
  → Classification: L (Low)

Risk class set to L. State updated.
```

Mode `--json` :
```json
{
  "class": "L",
  "method": "auto",
  "signals": ["feature_flag_detected", "no_pii_paths"],
  "previous_class": null
}
```

### Codes de sortie

| Code | Cas |
|------|-----|
| `0` | Classification effectuée |
| `1` | Classe invalide, raison manquante pour `--manual`, erreur git |
| `2` | Reclassification vers H/C en mode bypass — avertissement (mode dégradé vers auto) |

### Exemples

```bash
harness classify --auto
harness classify --manual H --reason "Touches JWT secret rotation logic"
harness classify --manual T --reason "Typo fix in README"
```

---

## 8. `harness doctor`

### Synopsis

```
harness doctor [--target <platform>] [--fix]
```

### Description

Diagnostic complet : santé de l'installation, validité de la configuration, câblage des hooks,
cohérence de l'état, fichiers manquants. Rapport structuré par catégorie.

### Flags

| Flag | Type | Requis | Description |
|------|------|--------|-------------|
| `--target <platform>` | string | non | Restreint le diagnostic à une plateforme (`claude`, `codex`, `hermes`) |
| `--fix` | boolean | non | Tente de corriger automatiquement les problèmes simples |

### Catégories de diagnostic

| Catégorie | Checks |
|-----------|--------|
| **Installation** | `~/.harness/config.yaml` présent, manifestes par plateforme valides |
| **Plateforme** | Binaire détectable, version compatible, chemins de config accessibles |
| **Hooks** | Chaque hook enregistré correspond à un event-name valide, commande `harness hook` résolvable |
| **Projet** | `.planning/state.yaml`, `.planning/current-risk.yaml` et `.planning/run-set.json` présents et valides |
| **State** | MacroCycle valide, classe de risque cohérente, run_id non-null si macroCycle > discovery |
| **Fichiers requis** | sections `policy_set` et `runtime_binding_set`, templates skills présents |

### Format de sortie

```
harness doctor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Installation
  ✓ ~/.harness/config.yaml
  ✓ claude.installed.yaml (v1.2.3, 2026-05-01)
  ✗ codex.installed.yaml — not installed

Platform: claude
  ✓ Binary found: /usr/local/bin/claude (1.2.3)
  ✓ Config dir: ~/.claude/ (writable)
  ✓ Hooks registered: 7/7
  ✗ MCP server harness-mcp: not responding

Project
  ✓ .planning/state.yaml (phase: build, class: L)
  ✓ .planning/run-set.json events section (847 entries)
  ✗ policy_set section — missing, run `harness doctor --fix`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2 errors, 1 warning. Run `harness doctor --fix` to attempt auto-repair.
```

Avec `--fix` : réinstalle les fichiers manquants depuis les templates embarqués. Ne modifie
jamais les fichiers édités par l'utilisateur.

### Codes de sortie

| Code | Cas |
|------|-----|
| `0` | Tout OK (ou tout corrigé avec `--fix`) |
| `1` | Erreurs détectées, non corrigeables automatiquement |

### Exemples

```bash
harness doctor
harness doctor --target claude
harness doctor --fix
harness doctor --json
```

---

## 9. `harness evidence`

### Synopsis

```
harness evidence show [--run <run-id>]
harness evidence add <type> <data>
```

### Description

Consulte ou enrichit la section Evidence Set logique du run courant. Elle est la source
de vérité pour `DONE_VERIFIED` — aucune transition vers `DONE_VERIFIED` sans evidence
suffisante (cf. rms-runtime-sets-v1-draft.md §Evidence Set).

### Sous-commandes

#### `harness evidence show`

Affiche la section Evidence Set du run courant (ou d'un run spécifique avec `--run`).

**Flags** :

| Flag | Type | Description |
|------|------|-------------|
| `--run <run-id>` | string | Run spécifique (défaut : run courant) |

**Format de sortie** :
```
Evidence Set — run-2026-05-03-a7f2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ tests        12 passing, 0 failing (vitest, 2026-05-03T14:20:00Z)
  ✓ lint         ESLint clean (2026-05-03T14:21:00Z)
  ✗ typecheck    not recorded
  ✗ review       not recorded
  - build        not required (class L)

Confidence: MEDIUM (2/4 required evidence items)
```

#### `harness evidence add <type> <data>`

Ajoute une entrée à la section Evidence Set du run courant.

**Arguments** :

| Argument | Requis | Description |
|----------|--------|-------------|
| `<type>` | oui | Type d'évidence : `tests`, `lint`, `typecheck`, `build`, `review`, `screenshot`, `custom` |
| `<data>` | oui | Données texte ou chemin vers un fichier de résultats |

**Comportement** :
1. Valide le type d'évidence contre les types connus.
2. Appende l'entrée dans la section `evidence` de `.planning/run-set.json`.
3. Appende un événement logique dans la section `events`.
4. Recalcule le niveau de confiance (`NONE` / `LOW` / `MEDIUM` / `HIGH` / `DONE_VERIFIED`).

### Codes de sortie

| Code | Cas |
|------|-----|
| `0` | Succès |
| `1` | Run inexistant, type invalide, erreur I/O |
| `3` | Evidence Set corrompu |

### Exemples

```bash
harness evidence show
harness evidence show --run run-2026-05-02-b3c1
harness evidence add tests "12 passing, 0 failing"
harness evidence add typecheck "$(npx tsc --noEmit 2>&1 | tail -1)"
harness evidence add review "LGTM — code-reviewer agent pass"
harness evidence add build ".dist/bundle.js 142KB"
```

---

## 10. Exigences de performance

### `harness hook` — chemin critique

| Métrique | Cible | Seuil d'alerte |
|----------|-------|----------------|
| Latence p50 | < 30 ms | > 50 ms |
| Latence p99 | < 100 ms | > 150 ms |
| Mémoire RSS | < 50 MB | > 100 MB |

**Stratégies pour tenir < 100 ms** :
- Pré-compilation TypeScript vers JS (pas de `ts-node` en production).
- Lecture `state.yaml` synchrone unique, pas de parsing JSON profond.
- Évaluation gates : logique pure, zéro I/O réseau.
- Écriture de l'événement logique : `setImmediate` ou `process.nextTick` après la décision.
- Pas de require dynamique dans le chemin chaud.

### Autres commandes

| Commande | Cible acceptable |
|----------|-----------------|
| `harness status` | < 500 ms |
| `harness transition` | < 1 s |
| `harness classify --auto` | < 2 s (inclut git diff) |
| `harness install` | < 30 s |
| `harness doctor` | < 5 s |
| `harness evidence` | < 500 ms |

---

## Annexe — Récapitulatif des commandes

| Commande | Usage | Fréquence |
|----------|-------|-----------|
| `harness install --target <p>` | Setup plateforme | Une fois par machine |
| `harness uninstall --target <p>` | Retrait propre | Rare |
| `harness init` | Démarrage projet | Une fois par projet |
| `harness status` | Inspection état | À la demande |
| `harness hook <event>` | Dispatcher hooks | À chaque outil agent |
| `harness transition <phase>` | Avancement cycle | À chaque jalon |
| `harness classify` | Classification risque | À chaque nouveau run |
| `harness doctor` | Diagnostic santé | Debug, post-install |
| `harness evidence [show\|add]` | Gestion preuves | Pendant et fin de run |
