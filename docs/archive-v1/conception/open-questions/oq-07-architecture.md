# OQ-07 — Architecture du harness TypeScript

> **Statut** : tranché — décisions définitives pour la phase Implémentation.
> **Source questions** : `openquestion.md` §7 (Q7.1–Q7.15)
> **Date** : 2026-05-03

---

## Q7.1 — Build tool : `tsc`, `tsup`, `esbuild`, `bun` ?

**Réponse** : `tsup` (propulsé par esbuild en interne).

`tsup` est le bon compromis : vitesse esbuild, gestion automatique des déclarations `.d.ts`, tree-shaking, sortie CJS + ESM en une passe, et configuration zéro pour les packages npm. `tsc` seul est trop lent et ne bundle pas. `bun build` est instable pour les packages publiés sur npm (résolution de modules pas encore standard). `esbuild` brut exige du câblage `.d.ts` manuel.

**Justification** : D14 impose une commande binaire unique (`harness hook <event>`) — `tsup` produit un bundle auto-contenu adapté.

**Référence spec** : `checkpoint-implementation.md` §7.2 (structure packages), D14 (single binary entry).

---

## Q7.2 — Runtime cible : Node.js (quelle version), Bun, Deno ?

**Réponse** : Node.js ≥ 20 LTS. Bun et Deno exclus pour le MVP.

Node 20 est la version LTS la plus récente avec `--experimental-vm-modules` stable, `fetch` natif, et support `import.meta`. Les trois plateformes cibles (Claude Code, Codex, Hermes) tournent elles-mêmes sur Node — installer Bun ou Deno pour le harness créerait une dépendance système supplémentaire. La contrainte `engines: { node: ">=20" }` dans `package.json` suffit. Bun peut être reconsidéré en v2 une fois sa stabilité npm confirmée.

**Justification** : D11 vise zéro friction utilisateur — imposer Bun/Deno viole ce principe.

**Référence spec** : `checkpoint-implementation.md` §7.1 (modèle d'installation), D11 (plugin natif).

---

## Q7.3 — Monorepo manager : pnpm workspaces, Turborepo, Nx, Lerna ?

**Réponse** : `pnpm workspaces` seul pour le MVP. Turborepo ajouté dès que le build en parallèle devient un frein mesurable (>5 packages).

pnpm résout nativement les workspace links, est cohérent avec l'écosystème npm moderne, et consomme moins de disque que npm/yarn. Turborepo apporte le cache de build incrémental mais ajoute de la config. Nx est over-engineered pour 5–6 packages. Lerna est obsolète.

**Justification** : D16 démarre avec un package unique — pnpm workspaces couvre le cas sans surcouche.

**Référence spec** : `checkpoint-implementation.md` §7.2 (structure packages), D16 (single package au début).

---

## Q7.4 — Tests : Jest, Vitest, `node:test` ?

**Réponse** : `Vitest`.

Vitest est natif ESM, partage la config Vite/tsup, est significativement plus rapide que Jest à cold start, et supporte les snapshots, le coverage via v8, et les mocks sans config supplémentaire. `node:test` est encore trop verbeux et sans ecosystem d'assertions. Jest exige `@jest/globals` ou `ts-jest` pour le TypeScript ESM — complexité inutile.

**Justification** : `@harness/core` est le pivot critique (couverture cible 90 %+) — la vitesse du runner est un multiplicateur de productivité au quotidien.

**Référence spec** : `checkpoint-implementation.md` §9 (plan travail), `10-core-api-spec.md` §1 (modules core).

---

## Q7.5 — Linter : ESLint + Prettier, Biome ?

**Réponse** : `Biome`.

Biome remplace ESLint + Prettier en un seul outil, est 10–30× plus rapide sur un monorepo, et couvre lint + format + import sort sans plugins. La couverture de règles ESLint atteint ~97 % depuis Biome 1.6. La seule règle manquante pertinente ici (`@typescript-eslint/consistent-type-imports`) est remplacée par `useImportType` native dans Biome.

**Justification** : Le harness est un outil DX — son propre pipeline doit être rapide. Biome réduit la friction en CI et en local.

**Référence spec** : `rules-reference/typescript-2026.md` (stack defaults), `10-core-api-spec.md` §10 (exports).

---

## Q7.6 — Logging : `pino`, `winston`, `console` + écriture manuelle ?

**Réponse** : `pino` pour les logs structurés runtime ; écriture JSONL manuelle (fs.appendFileSync atomique) pour les logs `.planning/`.

`pino` est le logger Node le plus rapide (worker thread, NDJSON natif), et son format est directement parsable par `jq` et les outils d'observabilité. `winston` est plus lourd et plus lent. La console brute ne produit pas le format JSONL append-only exigé par D15. Les deux canaux sont distincts : pino → stderr de la session harness ; écriture manuelle → `logs/events.jsonl` et `logs/state-transitions.jsonl`.

**Justification** : D15 spécifie JSONL append-only pour les logs harness. L'invariant "aucune entrée modifiée/supprimée" est garanti par `fs.appendFileSync`.

**Référence spec** : `checkpoint-implementation.md` D15, `10-core-api-spec.md` §7 (module logging).

---

## Q7.7 — CLI framework : `commander`, `oclif`, `citty`, `yargs` ?

**Réponse** : `citty` (de l'écosystème unjs).

`citty` est le plus léger (< 5 kB), TypeScript-first, sans dépendances, et génère l'aide automatiquement depuis les définitions de types. `commander` est solide mais verbose pour les sous-commandes typées. `oclif` est conçu pour des CLI enterprise avec plugins — vastement over-engineered. `yargs` a une API vieillissante et une config verbeuse pour TypeScript strict.

Le CLI harness a 5–6 commandes stables (`install`, `init`, `hook`, `status`, `doctor`, `migrate`) — `citty` couvre ce périmètre avec un minimum de surface.

**Justification** : D11 vise zéro friction — un CLI léger et rapide à cold start contribue directement.

**Référence spec** : `checkpoint-implementation.md` §7.2 (commandes CLI), D14 (commande unique).

---

## Q7.8 — Validation des données YAML/JSON : `zod`, `ajv`, `yup` ?

**Réponse** : `zod`.

`zod` est TypeScript-first par construction : les schémas produisent directement les types inférés utilisés dans tout `@harness/core`. Pas de déphasage type/schema possible. `ajv` est JSON Schema pur — excellent pour la validation externe mais oblige à maintenir types TS et schemas JSON séparément. `yup` est moins strict et moins performant que `zod` depuis v3.

Tous les YAML sont parsés avec `js-yaml`, puis validés via zod avant utilisation — l'invariant "schéma valide avant écriture" de `writeRmsSet` est appliqué ici.

**Justification** : `10-core-api-spec.md` §6 mentionne explicitement "validation de schéma avant écriture" dans `writeRmsSet`.

**Référence spec** : `10-core-api-spec.md` §6 (module planning — `writeRmsSet`), `checkpoint-implementation.md` D15 (YAML pour state machine).

---

## Q7.9 — Gestion des erreurs : Result types (`neverthrow`), exceptions classiques, mix ?

**Réponse** : exceptions typées pour les erreurs de domaine (hiérarchie `HarnessError`) ; `neverthrow` pour les fonctions I/O à haute fréquence (`readState`, `appendEvent`).

La hiérarchie `HarnessError` est déjà spécifiée dans la spec (`InvalidTransitionError`, `GateBlockedError`, `TerritoryViolationError`, etc.) — elle couvre les erreurs de domaine où la stack trace a de la valeur. Pour les opérations filesystem répétées dans les hooks (invoqués à chaque tool call), `Result<T, E>` évite le try/catch et force la gestion explicite des erreurs aux call sites.

**Justification** : `10-core-api-spec.md` §9 spécifie la hiérarchie complète d'exceptions. Le principe "jamais de silent fallback" (core.md §3) exige que les erreurs soient explicites — `neverthrow` l'enforce au typage.

**Référence spec** : `10-core-api-spec.md` §9 (types d'erreurs), `rules/core.md` §3 (quality).

---

## Q7.10 — Configuration utilisateur : `cosmiconfig`, `dotenv`, format custom ?

**Réponse** : `cosmiconfig` pour la config harness niveau projet (`.harnessrc.yaml` ou `harness.config.ts`) ; pas de `dotenv` — les secrets ne transitent jamais par le harness.

`cosmiconfig` cherche automatiquement la config dans l'arborescence, supporte YAML/JSON/JS/TS, et est l'outil standard de l'écosystème (utilisé par ESLint, Prettier, Jest). La config harness est légère (riskClass par défaut, mode, chemins custom de `.planning/`) — cosmiconfig la couvre sans surcharge. Les variables d'environnement sensibles restent dans le shell de la plateforme ; le harness ne les lit pas.

**Justification** : D11 vise l'invisibilité du harness — cosmiconfig respecte la convention "config optionnelle, valeurs par défaut sensées".

**Référence spec** : `checkpoint-implementation.md` D11 (plugin natif), `10-core-api-spec.md` §3 (MachineConfig avec valeurs par défaut).

---

## Q7.11 — Le harness suit-il lui-même sa pipeline (dogfooding) ? À quelle profondeur ?

**Réponse** : oui, à partir de la v0.2 (après MVP). Profondeur : classe F, mode auto-décision. Pas de classe É/C sur le harness lui-même tant qu'il n'est pas stable.

Le dogfooding complet (cycle Discovery → Apprentissage piloté par le harness pour ses propres features) est la validation ultime du système. Mais appliquer la pipeline complète sur la v0.1 avant qu'elle soit fonctionnelle est un anti-pattern. La règle pratique : dès que `harness init` + `harness hook pre-tool-use` fonctionnent sur Claude Code, le repo du harness est le premier projet piloté.

**Justification** : H5 (hypothèse à valider : "l'agent respecte les frontières") ne peut être validée qu'en pratique — le dogfooding est la méthode.

**Référence spec** : `checkpoint-implementation.md` §8 (Q13 — hypothèses H5), §9 étape 2 (critère de sortie MVP).

---

## Q7.12 — Mode "debug" qui affiche tous les hooks en clair ?

**Réponse** : oui — variable d'environnement `HARNESS_DEBUG=1` active le mode verbeux.

En mode debug : chaque invocation de `harness hook <event>` loggue sur stderr l'événement reçu (JSON pretty-print), la décision prise, et le temps d'exécution. Pas de flag CLI dédié — une env var est plus facile à activer dans les scripts de test. Désactivé par défaut pour ne pas polluer la session normale.

**Justification** : principe "visible error > silent substitution" (core.md §3) — le debug doit être explicite, pas caché derrière un flag obscur.

**Référence spec** : `rules/core.md` §3 (quality — no silent fallbacks), `checkpoint-implementation.md` §7.2 (package runtime — hook dispatcher).

---

## Q7.13 — Versioning du format des fichiers `.planning/` ?

**Réponse** : champ `version` dans chaque fichier YAML d'état + commande `harness migrate` pour les montées de version.

`PlanningState` expose déjà `version: "1"` dans la spec. Lors de `readState`, si `version` diffère de la version courante du harness, un avertissement est émis et une migration automatique est tentée (les migrations sont des fonctions pures versionnées dans `packages/core/src/planning/migrations/`). Si la migration automatique échoue, `harness migrate` guide l'utilisateur. Pas de migration silencieuse sur des données É/C.

**Justification** : `10-core-api-spec.md` §6 (`PlanningState.version: "1"`) pose déjà le mécanisme. Le principe "no silent fallback" exige que les incompatibilités soient détectées, pas ignorées.

**Référence spec** : `10-core-api-spec.md` §6 (`PlanningState`), `checkpoint-implementation.md` Q10 (versioning architecture).

---

## Q7.14 — Monolithique (single binary) ou modulaire (sous-binaires) ?

**Réponse** : monolithique — un seul binaire `harness` avec dispatch interne par sous-commande. Architecture packages reste modulaire, mais point d'entrée unique.

D14 a déjà tranché : les plateformes configurent `harness hook <event>` comme commande dans leurs hooks. Un binaire unique simplifie l'installation (`npm install -g @harness/cli`), le debug (`which harness`), et la mise à jour (`npm update -g @harness/cli`). L'architecture en packages internes reste modulaire pour les tests unitaires, mais le bundle final est un seul exécutable produit par `tsup`.

**Justification** : D14 (commande unique), D16 (single package au début).

**Référence spec** : `checkpoint-implementation.md` D14 (option C — commande unique), D16 (single package).

---

## Q7.15 — Stratégie de release : GitHub Releases + `npm publish`, ou pipeline custom ?

**Réponse** : `GitHub Releases` + `npm publish` automatisé via `release-it` en CI (GitHub Actions). Versioning SemVer strict.

`release-it` gère le bump de version, le tag Git, les notes de release automatiques depuis les conventional commits, et le `npm publish`. GitHub Actions déclenche le workflow sur push de tag `v*`. Pas de pipeline custom — l'écosystème standard couvre le besoin. Les pre-releases (`-alpha`, `-beta`) sont publiées sur le tag `next` npm pour ne pas impacter les installs par défaut.

**Justification** : D11 — la distribution `npm install -g @harness/cli` exige une publication npm stable et traçable. Conventional commits (core.md §4) alimentent les changelogs automatiquement.

**Référence spec** : `checkpoint-implementation.md` D11 (distribution npm), `rules/core.md` §4 (git — format commits).

---

*Décisions tranchées — toute modification breaking exige un ADR. Prochaines questions à trancher : OQ-08 (distribution/installation Windows), OQ-01 (state machine formelle xstate).*
