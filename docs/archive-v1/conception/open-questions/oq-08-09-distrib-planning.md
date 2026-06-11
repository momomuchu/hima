# Réponses aux questions ouvertes — Sections 8 & 9

> **Statut** : tranché — conception v1
> **Sections** : 8 (Distribution et installation) / 9 (Gestion des fichiers `.planning/` et `docs/`)
> **Date** : 2026-05-03
> **Références** : `09-cli-commands-spec.md`, `08-planning-state-schema.md`

---

## Section 8 — Distribution et installation

---

### Q8.1 — `npm install -g @harness/cli` est la cible. Mais quid des utilisateurs sous Windows sans WSL ?

**Réponse** : Le harness fonctionne sur Windows natif via Node.js ≥ 20. Le binaire `harness` est distribué comme script npm cross-platform (`bin` field dans `package.json`). Aucune dépendance POSIX native.

**Justification** : Node.js 20 LTS tourne nativement sur Windows. Les seules dépendances système sont `git` (disponible via Git for Windows) et la plateforme cible (Claude Code distribué en natif Windows). L'usage de `path.posix` vs `path.win32` est abstrait dans un module `platform-paths` interne. L'outil de shell détecté au runtime (`cmd.exe`, `powershell`, `bash`) n'est jamais invoqué directement par le harness — seul `git` et `node` le sont.

**Référence spec** : `09-cli-commands-spec.md` §1 — `harness install` valide "Node ≥ 20, plateforme présente sur PATH, répertoire de config accessible." Aucune mention de restriction POSIX.

---

### Q8.2 — Le harness fonctionne-t-il sous Windows natif, ou seulement sous WSL2 / macOS / Linux ?

**Réponse** : Windows natif est un target de première classe. WSL2 est supporté mais non requis.

**Justification** : La plateforme hôte principale (Claude Code) est distribuée en natif Windows. Les hooks sont des scripts appelés via la plateforme, pas via le shell système directement. `harness hook <event>` est un binaire Node — pas un shell script. Les chemins sont normalisés via `path.normalize()` au chargement. CI tourne sur les trois OS (Linux/macOS/Windows) — voir Q18.8 dans le backlog de questions.

**Référence spec** : `09-cli-commands-spec.md` §1 — détection de la plateforme via `claude --version` (commande cross-platform), pas de chemin POSIX-only dans la spec.

---

### Q8.3 — Comment gérer les chemins de fichiers cross-platform (`~`, `\\` vs `/`, etc.) ?

**Réponse** : Tous les chemins internes utilisent `path.resolve()` + `os.homedir()`. Le tilde (`~`) est interdit dans les fichiers de config — résolu à l'écriture. Les JSONL et YAML stockent des chemins absolus POSIX-normalisés (slash forward) pour la portabilité inter-OS.

**Justification** : `path.resolve()` produit le séparateur natif en runtime, `os.homedir()` remplace `~` de manière portable. Les chemins dans `events.jsonl` et `state.yaml` sont normalisés en forward-slash pour éviter les diff Git parasites entre OS. Règle : les chemins ne traversent jamais de frontière de sérialisation sans normalisation.

**Référence spec** : `08-planning-state-schema.md` §7.1 — les payloads JSONL contiennent des `path` (ex: `"path": "src/api/feature.ts"`) toujours en format POSIX.

---

### Q8.4 — `harness install --target claude` doit-il être idempotent (relancer ne casse rien) ?

**Réponse** : Oui, idempotent de manière stricte. Relancer sans `--force` ne modifie rien si la version installée correspond à la version courante.

**Justification** : L'idempotence est une propriété de sécurité critique pour les opérations d'infrastructure. Le manifeste `~/.harness/platforms/<platform>.installed.yaml` stocke la version et le timestamp. À la relance, le harness compare la version installée à la version du binaire — si égales, retour `0` immédiat avec message "already installed". Si la version diffère (mise à jour), réinstallation automatique. `--force` bypasse cette vérification.

**Référence spec** : `09-cli-commands-spec.md` §1 — "L'opération est **idempotente** : safe à ré-exécuter sans effet de bord." et step 6 : "Écrit un fichier `~/.harness/platforms/<platform>.installed.yaml` avec la version installée."

---

### Q8.5 — Comment désinstaller proprement (`harness uninstall`) ? Restaurer les hooks/configs précédents ?

**Réponse** : `harness uninstall --target <platform>` supprime uniquement les fichiers listés dans le manifeste d'installation. Aucune restauration de configuration pré-harness — le harness ne sauvegarde pas l'état précédent.

**Justification** : La restauration de l'état pré-installation nécessiterait un snapshot complet des configs de la plateforme au moment de l'installation — complexité injustifiée. La décision retenue : le harness ne touche que les fichiers qu'il a créés (manifeste comme source de vérité), et ne fait jamais de backup de fichiers tiers. Si l'utilisateur avait des hooks préexistants, ils sont protégés par la règle de non-écrasement (Q8.6). Si `--force` les a écrasés, c'est assumé par l'utilisateur.

**Référence spec** : `09-cli-commands-spec.md` §2 — "Supprime uniquement les fichiers listés dans le manifeste — ne supprime jamais les fichiers non-harness." et "si un fichier listé dans le manifeste a été modifié par l'utilisateur, affiche un avertissement et ne le supprime pas."

---

### Q8.6 — Que se passe-t-il si l'utilisateur a déjà des hooks installés sur Claude Code/Codex/Hermes ? Merge, écrasement, refus ?

**Réponse** : Merge par injection ciblée. Le harness ajoute ses entrées dans la section `hooks` du fichier de settings existant sans écraser le reste. Si un hook du même nom existe déjà, le harness refuse d'installer sans `--force` et liste le conflit.

**Justification** : L'écrasement silencieux casserait le workflow de l'utilisateur. Le refus total bloquerait l'installation. Le merge ciblé est le seul compromis viable : le harness connaît précisément les clés qu'il gère (liste dans son manifeste). Pour Claude Code, le fichier `settings.json` est un objet JSON — le harness lit, fusionne son sous-arbre `hooks`, réécrit. Les clés non-harness sont préservées. Le conflit de nom (un hook existant s'appelle identiquement) déclenche un avertissement et exit 1 sans `--force`.

**Référence spec** : `09-cli-commands-spec.md` §1 step 3 — "Copie les artefacts portables... dans le répertoire de config de la plateforme." et step 4 — "Enregistre les hooks natifs via le format attendu par la plateforme."

---

### Q8.7 — Comment détecter automatiquement quelle plateforme est installée et configurée ?

**Réponse** : Détection par présence sur PATH + existence du répertoire de config. Ordre de priorité : Claude Code > Codex > Hermes. Le résultat est mis en cache dans `~/.harness/config.yaml`.

**Justification** : Algorithme de détection : (1) `which claude` / `where claude` → plateforme `claude` disponible ; (2) vérifier `~/.claude/` existe et est accessible ; (3) idem pour `codex` et `hermes`. Résultat stocké dans `~/.harness/config.yaml` sous `detected_platforms: [...]`. La détection est rejouée à chaque `harness doctor`. En l'absence de toute plateforme, `harness install` échoue avec code 1 et message explicite.

**Référence spec** : `09-cli-commands-spec.md` §1 step 1 — "Détecte la version de la plateforme installée (`claude --version`, `codex --version`, `hermes --version`)." et §8 (doctor) — catégorie "Plateforme : Binaire détectable, version compatible, chemins de config accessibles."

---

### Q8.8 — Y a-t-il une commande `harness install --target all` qui installe sur les 3 plateformes en même temps ?

**Réponse** : Non. `--target all` n'existe pas. L'utilisateur lance `harness install --target <platform>` une fois par plateforme installée.

**Justification** : L'installation sur une plateforme non présente échouerait au step 1 (détection). Un `--target all` qui ignore silencieusement les plateformes absentes est un silent fallback, interdit (règle core.md §3). L'utilisateur qui veut installer sur les trois peut scripter `harness install --target claude && harness install --target codex && harness install --target hermes`. La commande unique apporte peu de valeur et cache les erreurs.

**Référence spec** : `09-cli-commands-spec.md` §1 — le flag `--target` est de type `string` avec valeurs `claude | codex | hermes`, pas de valeur `all` listée.

---

### Q8.9 — Comment gérer les mises à jour du harness ? `harness update`, `npm update -g`, auto-update ?

**Réponse** : Via `npm update -g @harness/cli` pour le binaire, suivi de `harness install --target <platform>` pour ré-enregistrer les hooks et skills. Pas d'auto-update, pas de commande `harness update` dédiée.

**Justification** : L'auto-update est une surface d'attaque supply chain et une perte de contrôle utilisateur. `npm update -g` est le mécanisme standard et attendu. Après update du binaire, les artefacts déployés sur les plateformes (skills, hooks) peuvent être obsolètes — `harness doctor` détecte la divergence de version et recommande `harness install --force --target <platform>`. Le workflow est donc : `npm update -g @harness/cli` → `harness doctor` → si version mismatch → `harness install --force --target <platform>`.

**Référence spec** : `09-cli-commands-spec.md` §8 (doctor) — catégorie "Installation : manifestes par plateforme valides" avec la version installée et timestamp. La divergence de version entre binaire et manifeste est un check explicite.

---

### Q8.10 — Comment communiquer une breaking change à l'utilisateur (ex : nouvelle structure `.planning/` requise) ?

**Réponse** : Via `harness doctor` qui détecte le schema version mismatch et affiche un message d'erreur bloquant avec la commande de migration. Les breaking changes sont aussi documentées dans `CHANGELOG.md` du package npm avec un marqueur `BREAKING:`.

**Justification** : La version du schema est stockée dans chaque fichier YAML (`version: "1"` — voir `08-planning-state-schema.md`). Si la version du harness installé attend `version: "2"` et trouve `version: "1"`, `harness doctor` et `harness hook` émettent toutes deux une erreur explicite (exit code 3) avec le message "Schema mismatch: run `harness migrate`". L'utilisateur ne peut pas manquer l'avertissement — les hooks refusent de fonctionner en version incompatible.

**Référence spec** : `08-planning-state-schema.md` §2 — champ `version: "1"` dans `state.yaml`. `09-cli-commands-spec.md` code de sortie `3` — "État invalide — `state.yaml` corrompu, incohérent ou absent."

---

### Q8.11 — Le harness gère-t-il plusieurs versions installées simultanément (ex : v1 sur projet A, v2 sur projet B) ?

**Réponse** : Oui, par isolation de config par projet. La version globale du binaire est unique (npm global), mais chaque projet embarque sa version de schema dans ses fichiers YAML. Le harness détecte la version du schema au chargement et refuse de traiter un projet dont le schema est incompatible avec le binaire courant.

**Justification** : Le multi-version strict (deux binaires coexistants) nécessiterait `npx` ou un wrapper de version — complexité excessive pour un outil solo. La solution retenue : version unique du binaire, isolation par schema version dans les projets. Si l'utilisateur a besoin de v1 pour le projet A, il garde le binaire v1 global et migre le projet A avant d'upgrader. `harness doctor` sur le projet A détecte la mismatch et guide. Le cas "deux projets, deux versions" simultanément est rare et non supporté activement.

**Référence spec** : `08-planning-state-schema.md` §2 — `version: "1"` dans chaque fichier. `09-cli-commands-spec.md` §8 (doctor) — "manifestes par plateforme valides" incluant la version.

---

### Q8.12 — Faut-il publier sur npm uniquement, ou aussi sur Homebrew, Scoop, AUR ?

**Réponse** : npm uniquement pour v1. Homebrew et Scoop sont envisageables en v2 si la base utilisateur le justifie.

**Justification** : npm est le canal naturel pour un outil Node.js ciblant des développeurs TypeScript/JavaScript. La maintenance de formules Homebrew/Scoop/AUR représente un overhead significatif (publications séparées, tests de packaging, mises à jour de formules). Pour un outil solo en v1, npm suffit. La condition de passage à Homebrew : adoption externe réelle, pas une anticipation. Les utilisateurs Windows qui n'ont pas npm sont rares dans le profil cible (dev TypeScript).

**Référence spec** : `09-cli-commands-spec.md` §1 — "Valide les prérequis : Node ≥ 20" implique que npm est déjà dans l'environnement cible.

---

### Q8.13 — Comment signer les releases (Sigstore, GPG) pour la supply chain security ?

**Réponse** : Sigstore via `npm publish` avec provenance activée (`--provenance`). Pas de GPG — standard npm moderne suffisant pour v1.

**Justification** : npm supporte nativement la provenance Sigstore depuis npm 9.5+ (2023). La commande `npm publish --provenance` génère une attestation SLSA Level 2 liée au workflow GitHub Actions. C'est transparent pour l'utilisateur final (`npm install` vérifie automatiquement). GPG sur npm est obsolète et complexe à maintenir. La signature des artefacts individuels (skills, hooks) n'est pas requise en v1 — les fichiers sont inclus dans le package npm signé. En v2, si le harness télécharge des artefacts à la volée, une vérification de hash sha256 est ajoutée.

**Référence spec** : `09-cli-commands-spec.md` §1 step 6 — le manifeste `~/.harness/platforms/<platform>.installed.yaml` enregistre "la version installée et le timestamp" — base pour la vérification d'intégrité.

---

## Section 9 — Gestion des fichiers `.planning/` et `docs/`

---

### Q9.1 — `harness init` produit quoi exactement ? Squelette minimal ou complet ?

**Réponse** : Squelette minimal fonctionnel. Seuls les fichiers nécessaires au premier gate sont créés. Pas de templates PRD/ADR à l'init — ceux-ci sont créés à la demande par `harness template <type>`.

**Justification** : Créer 30 fichiers à l'init surcharge l'utilisateur dès le départ. Le principe d'économie de tokens (D8) s'applique aussi à l'init : seul ce qui est nécessaire à la prochaine décision est créé. Le harness a besoin de `state.yaml`, `mode.yaml`, `current-risk.yaml`, `run.yaml` (sans `final-state.yaml` qui est créé à la clôture), des trois JSONL vides, et de `policies.yaml`. Les registres PBI, ADR, les templates docs — créés à la demande.

**Référence spec** : `09-cli-commands-spec.md` §3 — liste précise des fichiers créés par `harness init` : `.planning/state/`, `.planning/registry/`, `.planning/timeline/`, `.planning/metrics/`, `.planning/logs/`, `.planning/agent/`, `docs/`. `08-planning-state-schema.md` §8.1 — détaille exactement ce que `harness init` écrit dans `state/`.

---

### Q9.2 — Les templates de fichiers (PBI, RISK, ADR) sont-ils dans le harness ou dans `.planning/_templates/` du projet ?

**Réponse** : Les templates canoniques sont embarqués dans le binaire npm. L'utilisateur peut les surcharger en créant `.planning/_templates/<type>.yaml` dans son projet — priorité projet sur défaut harness.

**Justification** : Les templates embarqués garantissent qu'un `harness init` sur un projet vierge produit immédiatement des templates valides sans dépendance réseau. La surcharge locale permet la personnalisation sans fork. L'ordre de résolution : `.planning/_templates/<type>.yaml` (projet) > template embarqué (harness). Si le template projet est invalide (validation Zod), le harness émet un warning et tombe back sur le template embarqué — jamais de silent failure.

**Référence spec** : `08-planning-state-schema.md` §10 — règle D8 : "l'agent écrit dans `.planning/` ce qui est nécessaire à la prochaine décision." `09-cli-commands-spec.md` §8 (doctor) — "Fichiers requis : `policies.yaml`, `gates.yaml`, templates skills présents."

---

### Q9.3 — Comment l'utilisateur surcharge-t-il un template par défaut sans forker le harness ?

**Réponse** : En créant un fichier à `.planning/_templates/<type>.yaml` (ou `.md` selon le type). Le harness détecte et charge ce fichier en priorité sur son template embarqué.

**Justification** : La surcharge par convention de dossier est plus simple qu'une entrée de config dans `~/.harness/config.yaml`. Le dossier `_templates/` est répertorié dans `.gitignore` par défaut ou commité — au choix de l'utilisateur. La validation du template surcharge est effectuée à la première utilisation (pas à `harness init`) pour ne pas bloquer l'initialisation. Les types supportés : `pbi`, `adr`, `risk`, `retro`, `sprint`. Un type inconnu déclenche un warning, pas une erreur.

**Référence spec** : `08-planning-state-schema.md` §1 — structure des fichiers `state/` ; le dossier `registry/` est le home naturel des templates PBI/ADR. `09-cli-commands-spec.md` §3 — `harness init` crée `.planning/registry/` mais son contenu est à la demande.

---

### Q9.4 — Le harness modifie-t-il directement les fichiers `.planning/`, ou propose-t-il des modifications via PR/diff ?

**Réponse** : Modification directe. Le harness est l'auteur légitime des fichiers `state/`. Les fichiers `registry/` et `docs/` sont écrits directement aussi. Pas de PR/diff — le mode opératoire (pairing/auto-décision/bypass) régule la supervision, pas le mécanisme d'écriture.

**Justification** : Un workflow PR/diff pour chaque mise à jour de `state.yaml` introduirait une latence inacceptable (chaque gate deviendrait bloquante). La supervision humaine est gérée par le mode opératoire et les gates, pas par une couche diff. Les fichiers `.planning/` sont conçus pour être écrits fréquemment par le harness — c'est leur raison d'être. Le principe de traçabilité est assuré par les JSONL append-only, pas par des diffs Git de YAML.

**Référence spec** : `08-planning-state-schema.md` §8.2 — "Mise à jour — pendant l'exécution" décrit une écriture directe des YAML. §8.4 — "Les fichiers `*.jsonl` ne sont jamais supprimés ni tronqués." La traçabilité est dans les logs, pas dans l'historique Git des YAML.

---

### Q9.5 — Comment éviter les conflits Git si l'humain modifie un fichier en même temps que l'agent ?

**Réponse** : Par le système de locks dans `run.yaml.current_locks`. L'humain ne doit pas modifier `state/` directement pendant une session agent active. Pour `registry/` et `docs/`, les conflits Git sont gérés normalement (merge manuel).

**Justification** : `run.yaml` contient `current_locks` — liste des paths verrouillés par l'agent. Le hook `pre_tool_use` vérifie que le path cible n'est pas déjà modifié par une session humaine concurrente (détection via mtime ou lock file). En pratique, le scénario d'édition simultanée est rare en solo. Pour les fichiers `state/`, la règle est simple : pendant une session agent active, l'humain n'édite pas ces fichiers. Pour `docs/` et `registry/`, les conflits Git standard s'appliquent.

**Référence spec** : `08-planning-state-schema.md` §5 — `run.yaml.current_locks` : "zones de fichiers verrouillées par l'agent" avec `path`, `locked_by`, `locked_at`.

---

### Q9.6 — Les fichiers de l'agent (`registry/state/dashboard.md` régénéré) sont-ils committés dans Git ou ignorés ?

**Réponse** : Les fichiers YAML dans `state/` sont committés. Les fichiers JSONL dans `logs/` sont committés (source de vérité). Les fichiers régénérés (`dashboard.md`, `run.yaml` en tant que vue) peuvent être exclus via `.gitignore` si l'utilisateur le souhaite — mais le harness ne les exclut pas par défaut.

**Justification** : Committer `state.yaml` permet de voir l'historique de phase dans `git log`. Committer les JSONL assure la persistance de l'Evidence Set même si le projet est cloné sur une autre machine. Le dashboard et les vues régénérées sont des artéfacts de convenance — s'ils sont dans `.gitignore`, le harness les recrée à la prochaine session. La décision par défaut est "tout committer" pour maximiser la traçabilité — l'utilisateur peut opt-out via `.gitignore`.

**Référence spec** : `08-planning-state-schema.md` §8.4 — "Les fichiers `*.jsonl` ne sont jamais supprimés ni tronqués." — implique une persistance assumée, compatible avec Git.

---

### Q9.7 — Faut-il un `.harnessignore` pour exclure certains chemins du contrôle ?

**Réponse** : Non. Le contrôle du harness est défini par les gates dans `policies.yaml` et `gates.yaml`, pas par un fichier d'exclusion. Les chemins non-contrôlés sont ceux que les gates ne surveillent pas — pas ceux listés dans un fichier séparé.

**Justification** : Un `.harnessignore` crée une troisième source de vérité (en plus des policies et du mode). Les exclusions de chemins sensibles (`.git/`, `~/.ssh/`) sont déjà des guards dans `gates.yaml` — hard-coded comme non-éditables. Les exclusions de domaine métier (ex: "ne pas surveiller `docs/legacy/`") se configurent dans `policies.yaml` en ajoutant un pattern d'exclusion. Un fichier `.harnessignore` séparé complexifie sans gain.

**Référence spec** : `09-cli-commands-spec.md` §5 (hook) — "Évalue les gates applicables à l'événement selon la phase et la classe de risque courantes." Les gates sont dans `policies.yaml` / `gates.yaml`, pas dans un fichier ignore. `08-planning-state-schema.md` §11 — "Policy Set → `.planning/agent/` → `policies.yaml`, `gates.yaml`."

---

### Q9.8 — Comment valider la cohérence de `.planning/` (référence à PBI inexistant, statut incohérent) ? Commande `harness check` ?

**Réponse** : Via `harness doctor` (pas une commande `harness check` séparée). La catégorie "State" du doctor vérifie : phase valide, classe de risque cohérente, run_id non-null si phase > discovery, JSONL lisibles.

**Justification** : Ajouter `harness check` en plus de `harness doctor` fragmente les commandes de diagnostic. Le doctor est déjà le point d'entrée pour toute vérification de santé — il est extensible par catégorie. Les checks de cohérence sémantique (référence PBI inexistant) sont ajoutés dans la catégorie "Projet" du doctor. Si le besoin d'un check rapide et silencieux (pour CI) se fait sentir, `harness doctor --json` avec exit code 1 suffit.

**Référence spec** : `09-cli-commands-spec.md` §8 (doctor) — catégories : Installation, Plateforme, Hooks, **Projet**, **State**, Fichiers requis. La catégorie "State" vérifie "Phase valide, classe de risque cohérente, run_id non-null si phase > discovery."

---

### Q9.9 — `harness check` est-il bloquant en CI, ou seulement informatif ?

**Réponse** : `harness doctor` en CI retourne exit code 1 sur toute erreur — bloquant par convention Unix. En mode `--json`, le script CI peut inspecter les catégories et décider quoi bloquer.

**Justification** : Un outil de diagnostic qui retourne toujours 0 est inutile en CI. Le standard Unix est : exit 0 = succès, exit != 0 = échec. `harness doctor` retourne 0 seulement si tout est OK (ou tout corrigé avec `--fix`), 1 si des erreurs persistent. En CI, on ajoute `harness doctor` comme step de validation pré-deploy. L'utilisateur qui veut un check informatif-only utilise `harness doctor --json` et parse le résultat.

**Référence spec** : `09-cli-commands-spec.md` §8 (doctor) codes de sortie — "`0` : Tout OK (ou tout corrigé avec `--fix`)" et "`1` : Erreurs détectées, non corrigeables automatiquement."

---

### Q9.10 — Comment le harness gère-t-il un projet où `.planning/` n'existe pas ? Refuse, propose `init`, agit en mode dégradé ?

**Réponse** : Mode dégradé silencieux pour `harness hook` (allow immédiat, log sur stderr). Erreur explicite avec suggestion `harness init` pour toutes les autres commandes.

**Justification** : `harness hook` est appelé à chaque outil utilisé par l'agent — bloquer ou planter sur un projet non-initialisé casserait le workflow de l'agent sur tout projet legacy. Le fail-open sur hook est délibéré. Les commandes interactives (`status`, `transition`, `classify`) doivent échouer explicitement — l'utilisateur a fait une erreur de contexte (mauvais répertoire, projet non initialisé). Le message "Project not initialized. Run `harness init` to get started." est non-ambigu.

**Référence spec** : `09-cli-commands-spec.md` §5 (hook) — "Si `.planning/` est absent : allow immédiat, log sur stderr, pas de bloc." §4 (status) — "Si le projet n'est pas initialisé : message d'erreur explicite, suggestion de `harness init`."

---

### Q9.11 — Comment migrer un projet d'une ancienne version du schéma vers la nouvelle ? Commande `harness migrate` ?

**Réponse** : Via `harness migrate` — commande dédiée, non incluse dans v1 (scope v2). En v1, les migrations sont documentées manuellement dans le CHANGELOG. Le schema `version: "1"` est stable pour toute la v1.x du harness.

**Justification** : Une commande `harness migrate` nécessite des migrations versionnées (type Alembic/Flyway pour YAML) — infrastructure significative. En v1, la décision est de stabiliser le schema et de ne pas le casser. Si une migration est inévitable en v1.x, elle est documentée comme breaking change (Q8.10) avec un script manuel. La commande `harness migrate` est planifiée pour v2 quand le schema aura une historique de versions à gérer. La régénérabilité de `state.yaml` depuis `state-transitions.jsonl` (Q8.11 schema doc) facilite les migrations manuelles.

**Référence spec** : `08-planning-state-schema.md` §9 — "Régénération depuis les logs" : `harness rebuild state` depuis `state-transitions.jsonl`. Ce mécanisme de rebuild est la fondation sur laquelle une migration peut s'appuyer.

---

### Q9.12 — Le harness lit-il `docs/` ou seulement `.planning/` ? Si oui, à quelles fins ?

**Réponse** : Le harness lit `docs/` uniquement via `harness doctor` (vérifier que les fichiers requis existent) et via la commande `harness evidence add` si la donnée pointe vers un fichier dans `docs/`. Il n'indexe pas `docs/` en continu.

**Justification** : `docs/` est le domaine de l'humain et des agents de contenu — pas du harness de cycle de vie. Le harness n'a pas besoin de lire les ADR ou les specs pour gater les transitions : il utilise l'Evidence Set (`evidence-set.json`) qui contient des références, pas le contenu intégral. La lecture de `docs/` par le harness serait une violation de séparation des responsabilités. La seule exception légitime : vérifier l'existence de fichiers requis (doctor).

**Référence spec** : `09-cli-commands-spec.md` §8 (doctor) — "Fichiers requis : `policies.yaml`, `gates.yaml`, templates skills présents." — vérification d'existence uniquement. `09-cli-commands-spec.md` §9 (evidence) — `evidence add` accepte "chemin vers un fichier de résultats" sans spécifier de restriction de chemin.

---

### Q9.13 — Comment gérer les très gros backlogs (1000+ PBI) ? Performance de lecture/parsing.

**Réponse** : Via un index machine-readable `.planning/registry/index.json` régénéré. Le harness ne charge jamais tous les PBI en mémoire — il charge l'index et lit les PBI individuels à la demande.

**Justification** : 1000 PBI en YAML individuel = ~1000 fichiers de 2-5 KB = 2-5 MB total. Charger en mémoire à chaque hook (< 100 ms target) est inacceptable. L'index JSON contient : id, title, status, phase, risk_class, last_updated — champs nécessaires aux queries fréquentes. Les PBI complets sont lus uniquement lors des transitions ou des commandes explicites. L'index est régénéré via `harness rebuild index` ou automatiquement après chaque modification de PBI.

**Référence spec** : `09-cli-commands-spec.md` §10 (performance) — `harness hook` cible < 100 ms p99. "Lecture `state.yaml` : YAML synchrone, fichier ≤ 2 KB." — l'architecture de hook évite délibérément de charger le registry complet.

---

### Q9.14 — Faut-il un index machine-readable global (`.planning/index.json` régénéré) pour accélérer les requêtes ?

**Réponse** : Oui. `.planning/registry/index.json` est créé par `harness init` (vide) et régénéré automatiquement à chaque modification du registry. Il couvre : PBI actifs, ADR actifs, runs récents (N = 20).

**Justification** : Décision tranchée par la réponse Q9.13 — l'index est nécessaire pour la performance. Le scope de l'index : statut, titre, id, phase, risk_class — pas le contenu complet. L'index est un fichier JSON plat, pas de base de données. Sa régénération est déclenchée par les hooks `post_tool_use` sur les fichiers `registry/`. L'index est committé dans Git (il est la source d'accélération, sa perte = régénération au prochain `harness rebuild`).

**Référence spec** : `09-cli-commands-spec.md` §5 (hook) — performance cible < 100 ms. La nécessité d'un index découle directement de cette contrainte appliquée à un grand registry.

---

### Q9.15 — Comment archiver les anciens sprints/releases tout en gardant la mémoire active accessible ?

**Réponse** : À la clôture de chaque run, `gate.stop` copie `.planning/state/` et `.planning/logs/` dans `.planning/timeline/<run-id>/`. La mémoire active = `state/` (run courant). La mémoire historique = `timeline/` (runs archivés, append-only). L'accès à l'historique se fait via `harness evidence show --run <run-id>`.

**Justification** : La structure `timeline/<run-id>/` est déjà définie dans le schema. Elle permet de consulter n'importe quel run passé sans charger tout l'historique. L'archivage est automatique (pas de commande manuelle requise). Les JSONL originaux dans `logs/` ne sont jamais supprimés — ils restent la source d'autorité permanente. Si le `timeline/` grossit (100+ sprints), un `harness archive --before <date>` peut déplacer les anciens snapshots dans un dossier `.planning/archive/` moins accessible — commande v2.

**Référence spec** : `08-planning-state-schema.md` §8.3 — "Archivage — fin de run : copie `.planning/state/` → `.planning/timeline/<run-id>/state-snapshot/` et `.planning/logs/` → `.planning/timeline/<run-id>/logs/`." `09-cli-commands-spec.md` §9 (evidence) — `harness evidence show --run <run-id>` permet l'accès aux runs archivés.

---

*Document de décision — à versionner dans `docs/conception/open-questions/`. Les questions résolues ici sont retirées du backlog `openquestion.md` sections 8 et 9.*
