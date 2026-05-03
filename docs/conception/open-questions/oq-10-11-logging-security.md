# Réponses aux questions ouvertes — Sections 10 et 11

> **Statut** : décisions tranchées — prêtes pour implémentation.
> **Date** : 2026-05-03
> **Source** : `08-planning-state-schema.md`, `05-gates-policy-spec.md`, `01-state-machine-spec.md`
> **Périmètre** : Logging/métriques/observabilité (Q10.1–Q10.12) + Sécurité/permissions (Q11.1–Q11.11)

---

## Section 10 — Logging, métriques, observabilité

---

### Q10.1 — Quels événements sont systématiquement loggés ?

**Réponse** : Trois flux JSONL append-only couvrent l'exhaustivité des événements. Chaque événement appartient à exactement un flux.

**Justification** : `events.jsonl` capte tous les événements bruts (session, phases, outils, gates, subagents, loops, evidence). `state-transitions.jsonl` est un sous-ensemble ciblé servant à régénérer `state.yaml`. `decisions.jsonl` isole les décisions non triviales (classifications, promotions, overrides, gate blocks). Cette partition évite la redondance tout en permettant des requêtes ciblées sans scanner le flux brut complet.

Catégories loggées dans `events.jsonl` :
- Cycle de session : `session.start`, `session.end`
- Transitions de phase : `phase.transition`
- Classification et promotion de risque : `risk.classified`, `risk.promoted`
- Opérations d'outils : `tool.write`, `tool.read`, `tool.exec`
- Verdicts de gates : `gate.blocked`, `gate.allowed`
- Subagents : `subagent.spawned`, `subagent.completed`
- Sécurité opérationnelle : `loop.detected`, `attempt.incremented`
- Evidence : `evidence.added`, `final_state.set`

**Référence spec** : `08-planning-state-schema.md` §7.1 — types d'événements canoniques.

---

### Q10.2 — Format des logs : JSONL strict, JSON pretty, format custom ?

**Réponse** : JSONL strict — une ligne JSON compacte et valide par événement, jamais de pretty-print, jamais de trailing comma.

**Justification** : JSONL permet le streaming (`tail -f`), l'ingestion par `jq`, et la régénération des états YAML par replay chronologique. Le pretty-print casserait le parsing ligne-à-ligne. Un format custom créerait une dépendance de tooling sans valeur ajoutée. Chaque ligne est autonome : elle contient `v` (version schema), `id` (ULID), `run_id`, `at` (ISO 8601 UTC), `type`, `source`, `payload`, `phase`, `risk_class`.

La version de schéma `v: 1` est présente sur chaque ligne pour permettre la migration future sans changer le nom de fichier.

**Référence spec** : `08-planning-state-schema.md` §7 — "Chaque ligne est un objet JSON autonome et valide."

---

### Q10.3 — Politique de rotation des logs (`logs/*.jsonl` peut grossir indéfiniment) ?

**Réponse** : Pas de rotation en ligne. Les logs sont permanents et immuables. L'archivage est déclenché par `harness close` (fin de run), qui copie `logs/` vers `.planning/timeline/<run-id>/logs/`. Les logs originaux ne sont jamais supprimés.

**Justification** : Les logs sont la source d'autorité. Toute rotation ou troncature casserait la capacité de régénérer `state.yaml` depuis `state-transitions.jsonl`. Le volume par run reste borné — un run produit des dizaines à quelques centaines d'entrées, pas des millions. Sur un projet actif (10 runs/mois, 200 entrées/run), un an produit environ 24 000 lignes JSONL, soit moins de 5 Mo. Si le volume devient un problème (projet très long), la réponse est l'archivage dans `timeline/` plus tôt, pas la suppression.

**Référence spec** : `08-planning-state-schema.md` §8.3 (archivage) et §8.4 — "Les fichiers `*.jsonl` ne sont jamais supprimés ni tronqués."

---

### Q10.4 — Faut-il un niveau de log configurable (DEBUG, INFO, WARN, ERROR) ?

**Réponse** : Oui, mais avec une portée restreinte. Les niveaux s'appliquent uniquement à la **sortie console** du harness (stdout/stderr visible dans le terminal), pas aux fichiers JSONL. Les fichiers JSONL loggent toujours tout, sans filtrage.

Niveaux définis :
- `ERROR` : seules les violations `HARD_BLOCK` et les exceptions non récupérées
- `WARN` : violations `WARN` + escalades automatiques
- `INFO` (défaut) : transitions de phase, verdicts de gates, résumé de session
- `DEBUG` : chaque entrée JSONL écrite, contenu des events bruts, évaluation de chaque guard

Configuration via variable d'environnement `HARNESS_LOG_LEVEL` ou clé `logLevel` dans `harness.config.yaml`. La valeur par défaut est `INFO`.

**Justification** : Le fichier JSONL est la source de vérité — il ne doit jamais être filtré, sous peine de rendre le replay impossible. En revanche, le bruit console en `DEBUG` est inutilisable en usage quotidien.

**Référence spec** : `05-gates-policy-spec.md` §3.3 — chaque gate produit une entrée dans `events.jsonl` sans condition.

---

### Q10.5 — Les logs contiennent-ils des données sensibles ? Stratégie de redaction.

**Réponse** : Les logs ne doivent jamais contenir de secrets en clair. La règle est : le `payload` d'un événement `tool.write` contient le `file_path` et la `decision`, pas le contenu du fichier. Le `toolInput` loggé dans `events.jsonl` est le nom de l'outil et le chemin cible, jamais le contenu.

Règles de redaction :
1. `toolOutput` n'est jamais loggé intégralement — seul un résumé structuré (`exit_code`, `files_modified`) est versé.
2. Si `post_tool` détecte un secret en clair dans `toolOutput`, il émet `gate.blocked` avec `violationType: SECRET_IN_PLAINTEXT` mais **sans reproduire le secret** dans le log.
3. Les champs `classifier_notes` et `reason` dans `decisions.jsonl` sont du texte libre — la convention est de ne jamais y inclure de valeurs de secrets, seulement des descriptions structurelles ("clé API détectée dans `config/prod.ts` ligne 42").
4. Les tokens OAuth et clés API transitant par les hooks ne sont jamais écrits dans les YAML ni les JSONL.

**Justification** : `post_tool` est le premier à inspecter les sorties d'outils. C'est le seul point où un secret pourrait être capturé. Son rôle est de bloquer, pas de reproduire.

**Référence spec** : `05-gates-policy-spec.md` §2.2 — "Secret en clair (clé API, token, mot de passe) → Regex + gitleaks intégré → HARD_BLOCK toutes classes."

---

### Q10.6 — Le harness exporte-t-il en OpenTelemetry ?

**Réponse** : Non pour la v1. Le harness produit des JSONL structurés qui peuvent être ingérés par un collecteur OpenTelemetry externe (Grafana Agent, otel-collector avec un receiver `filelog`), mais il n'expose pas nativement de spans OTLP.

**Justification** : OpenTelemetry ajoute une dépendance de runtime non négligeable (`@opentelemetry/sdk-node`) et suppose une infrastructure de collecte (endpoint OTLP). Le profil d'usage cible est un développeur solo sans infra observabilité. Le format JSONL est suffisamment structuré pour être transformé en traces OTLP par un adapter externe si besoin. L'ajout d'un export OTLP optionnel (activé par `HARNESS_OTEL_ENDPOINT`) est planifié en v2.

**Référence spec** : `08-planning-state-schema.md` §7 — le format `events.jsonl` avec `id` ULID, `at` ISO 8601, `type`, `source` est directement mappable sur un span OpenTelemetry (traceId ← run_id, spanId ← evt id, name ← type).

---

### Q10.7 — Quelles métriques DORA sont automatiquement calculées vs manuellement renseignées ?

**Réponse** :

| Métrique DORA | Calculable automatiquement | Source | Manuellement renseignée |
|---|:---:|---|:---:|
| Deployment Frequency | oui | `final_state.set` events dans `events.jsonl` | non |
| Lead Time for Changes | oui | delta `session.start` (phase Discovery) → `final_state=DONE_VERIFIED` | non |
| Change Failure Rate | oui | ratio `DONE_VERIFIED` / (`DONE_VERIFIED` + `BLOCKED_POLICY` + `MAX_ATTEMPTS`) par période | non |
| Time to Restore Service | non | dépend d'événements de production externes au harness | oui (champ `restore_at` dans `final-state.yaml`) |

`harness metrics dora` calcule les trois premières depuis les JSONL. La quatrième requiert une saisie manuelle de la date de rétablissement.

**Justification** : Les trois métriques calculables sont entièrement dérivables du flux `events.jsonl` et `final-state.yaml`. Time to Restore Service nécessite de savoir quand un incident production est résolu, ce qui est hors du périmètre du harness (pas de monitoring de production intégré en v1).

**Référence spec** : `08-planning-state-schema.md` §6 — `final-state.yaml` avec `closed_at`, `final_state`, `run_id` ; §7.1 — événements `session.start`, `final_state.set`.

---

### Q10.8 — Le harness expose-t-il un dashboard (CLI ou web) ? Ou juste des fichiers à lire ?

**Réponse** : CLI uniquement en v1. Commandes `harness status` et `harness metrics`. Pas de dashboard web.

**Justification** : Un dashboard web nécessite un serveur local (port, dépendances frontend) et crée des problèmes de sécurité (exposition locale). La CLI couvre 100 % des besoins d'un développeur solo. Si un dashboard devient nécessaire, l'export vers Grafana (via `harness metrics --format prometheus`) est la voie préférable à un dashboard embarqué.

**Référence spec** : `05-gates-policy-spec.md` §7.2 — "Le harness n'envoie pas de notifications push (pas de daemon). `harness status` affiche les violations actives du run courant."

---

### Q10.9 — Faut-il un `harness status` qui résume l'état courant ?

**Réponse** : Oui. `harness status` est une commande obligatoire. Elle affiche :

```
Run ID    : run-abc123
Phase     : BUILD.Exécuter
Risk class: M
Mode      : auto-decision
Attempt   : 1 / 3
Warnings  : 2 / 5 (seuil d'escalade)
Last gate : pre_tool → allow (2026-05-03T14:45:00Z)
Open tasks: 2
Blockers  : 0
Final state: —
```

La commande lit `run.yaml` et `state.yaml` uniquement — pas de JSONL pour des raisons de performance. Si les YAML sont absents ou invalides, elle indique `ÉTAT INCONNU — exécuter harness rebuild`.

**Justification** : C'est la commande la plus fréquemment utilisée. Elle doit être instantanée (< 50ms). La lecture des YAML (quelques Ko) est 100× plus rapide que le parsing du JSONL complet.

**Référence spec** : `08-planning-state-schema.md` §1 — `run.yaml` (état vivant, mis à jour à chaque gate) et `state.yaml` (phase courante, historique de transitions).

---

### Q10.10 — Comment l'utilisateur visualise-t-il les métriques dans le temps (séries temporelles) ?

**Réponse** : `harness metrics` produit un rapport CLI textuel. Pour les séries temporelles, `harness metrics --format json` exporte un JSON compatible avec Grafana (via datasource JSON simple) ou Excel/Numbers. Pas de TUI graphique en v1.

Format de sortie `--format json` :

```json
{
  "period": "2026-04",
  "runs": 12,
  "dora": {
    "deploymentFrequency": 3.0,
    "leadTimeHours": { "p50": 4.2, "p90": 8.7 },
    "changeFailureRate": 0.08
  },
  "riskDistribution": { "T": 3, "F": 5, "M": 3, "É": 1, "C": 0 },
  "finalStates": { "DONE_VERIFIED": 10, "DONE_WITH_GAPS": 1, "BLOCKED_POLICY": 1 }
}
```

**Justification** : Une TUI graphique (courbes ASCII) est séduisante mais peu lisible et fragile selon la taille du terminal. L'export JSON vers Grafana ou un tableur couvre le besoin de visualisation temporelle sans ajouter de dépendance UI au harness.

**Référence spec** : `08-planning-state-schema.md` §6 — `final-state.yaml` comme source pour la métrologie DORA.

---

### Q10.11 — Les logs et métriques sont-ils committés dans Git ou exclus ?

**Réponse** : Exclus de Git par défaut. `.gitignore` du harness inclut `.planning/logs/` et `.planning/timeline/`. Seuls les artefacts de décision humaine sont committés : `docs/`, `.planning/registry/`, `.planning/agent/boundaries.yaml`.

Exception explicite : `final-state.yaml` **peut** être commité si l'équipe veut une trace Git de la clôture de chaque run. C'est opt-in via la clé `commitFinalState: true` dans `harness.config.yaml`.

**Justification** : Les logs JSONL sont append-only et potentiellement volumineux. Ils n'ont pas de valeur dans l'historique Git (ils ont leur propre historique immuable). Les committer pollue le diff Git, alourdit le repo, et peut accidentellement inclure des données sensibles (chemins internes, notes de classification). Les artefacts humains (`docs/`, ADR, specs) sont les seuls qui méritent un historique Git.

**Référence spec** : `08-planning-state-schema.md` §8.4 — "Les fichiers `*.jsonl` ne sont jamais supprimés ni tronqués" (gestion harness-side, pas Git-side).

---

### Q10.12 — Comment partager des métriques entre projets (vue agrégée multi-projets) ?

**Réponse** : Pas de support natif en v1. La voie recommandée est d'exporter depuis chaque projet avec `harness metrics --format json --output metrics.json` et d'agréger avec un script externe ou Grafana.

Pour v2, `harness metrics --global` est planifié : il lit une liste de projets depuis `~/.config/harness/projects.yaml` et agrège les métriques DORA sur tous les projets enregistrés.

**Justification** : Le harness est un outil de projet, pas un outil d'organisation. Ajouter une couche d'agrégation multi-projets en v1 complexifie l'architecture sans valeur prouvée pour un développeur solo. L'export JSON est suffisant pour un dashboard Grafana maison.

**Référence spec** : `09-cli-commands-spec.md` (contexte général des commandes CLI) ; `08-planning-state-schema.md` §6 — `final-state.yaml` comme source primaire.

---

## Section 11 — Sécurité et permissions

---

### Q11.1 — Le harness lui-même peut-il être un vecteur d'attaque (un mauvais hook qui exfiltre `.planning/`) ?

**Réponse** : Oui, le risque existe et est mitigé par trois mécanismes distincts :

1. **Isolation de l'exécution** : les hooks sont des scripts TypeScript compilés, exécutés par Node.js sans accès réseau par défaut (pas de `fetch` dans le scope hook — le harness n'importe pas `node-fetch` dans ses hooks). L'accès réseau dans un hook est une anomalie détectable par `harness audit`.

2. **Signature des releases** : les artefacts npm publiés sont signés via Sigstore/npm provenance. Un hook modifié post-publication cassera la signature.

3. **Surface d'attaque bornée** : les hooks lisent `stdin` (l'événement de la plateforme) et écrivent sur `stdout` (la décision) + `.planning/logs/`. Ils n'ont pas de raison légitime d'accéder à `~/.ssh/`, aux variables d'environnement système, ou de faire des requêtes réseau. Tout accès hors de ce périmètre est un signal d'alerte.

Le risque résiduel principal est la supply chain (dépendance npm compromise). La mitigation est le lockfile strict (`package-lock.json` avec `integrity` SHA-512) et le scan SCA en CI.

**Référence spec** : `05-gates-policy-spec.md` §2.2 — `post_tool` détecte les patterns interdits dans les outputs.

---

### Q11.2 — Comment auditer les hooks installés par le harness pour vérifier qu'ils ne font que ce qu'ils doivent ?

**Réponse** : `harness audit hooks` compare chaque hook installé (hash SHA-256) contre le registre signé de la release installée. Toute divergence produit une erreur bloquante.

Comportements vérifiés statiquement :
- Aucun import réseau (`fetch`, `axios`, `http`, `https`) dans le code hook compilé
- Aucun accès à des chemins hors `.planning/`, `stdin`, `stdout`
- Présence de la signature `// @harness-hook verified: <hash>` en tête de chaque hook compilé

`harness audit hooks --verbose` affiche le code source de chaque hook et le diff avec la baseline signée si divergence.

**Justification** : L'audit statique (hash + analyse d'imports) est plus fiable qu'un audit dynamique (sandboxing) et ne nécessite pas de runtime isolé. La comparaison de hash couvre les modifications accidentelles et les altérations malveillantes.

**Référence spec** : `05-gates-policy-spec.md` §3.1 — interface stdin/stdout des gates comme surface d'exécution bornée.

---

### Q11.3 — Le harness peut-il être désactivé localement (`harness off`) sans tout désinstaller ?

**Réponse** : Oui. `harness off` écrit un fichier sentinel `.harness-disabled` à la racine du projet. Tous les hooks vérifient la présence de ce fichier en premier et retournent immédiatement `allow` sans évaluation si présent.

`harness on` supprime ce fichier et réactive l'évaluation normale.

Le désactivation est **locale au projet** (le fichier est dans le répertoire courant). Elle n'affecte pas les autres projets. Elle est **non commitée** par défaut (`.harness-disabled` est dans `.gitignore`).

Un WARN est émis dans la console à chaque session tant que le harness est désactivé : `[HARNESS OFF] Évaluation des gates suspendue — harness on pour réactiver`.

**Justification** : Il doit exister une trappe d'urgence sans désinstallation (qui modifierait la config globale de la plateforme). Le sentinel fichier est idiomatique, simple à implémenter, et auditable.

**Référence spec** : `05-gates-policy-spec.md` §6.1 — distinction entre bypass de mode opératoire et bypass de gate individuelle. `harness off` est un bypass global d'urgence, distinct des deux.

---

### Q11.4 — Quels chemins sont non éditables par l'agent, garantis par le harness ?

**Réponse** : La matrice de permissions par phase dans `pre_tool` définit les zones interdites en écriture. Les zones **absolument interdites quelle que soit la phase** sont :

| Chemin | Raison | Violation |
|---|---|---|
| `.git/` | Corruption possible de l'historique Git | HARD_BLOCK toutes classes |
| `~/.ssh/`, `~/.gnupg/` | Exfiltration de clés privées | HARD_BLOCK toutes classes |
| `.env.production`, `.env.prod`, `*.prod.env` | Secrets de production | HARD_BLOCK toutes classes |
| `.harness-disabled` (si É/C) | Désactivation du harness en production | HARD_BLOCK si É/C |
| `.planning/agent/boundaries.yaml` | Config de territoire — human-only | HARD_BLOCK toutes classes |
| `package-lock.json` (sans `npm install` dans la commande) | Altération silencieuse du lockfile | HARD_BLOCK toutes classes |

Ces interdictions sont encodées dans `registry/policies.yaml` sous `hardBlockViolations` et dans la matrice de zones par phase dans `pre_tool`.

**Justification** : Ces chemins représentent la surface irréversible — une écriture accidentelle ou malveillante dans `.git/`, `~/.ssh/` ou `.env.production` peut avoir des conséquences de sécurité non récupérables.

**Référence spec** : `05-gates-policy-spec.md` §2.1 — matrice zones d'écriture par phase ; §4.3 — signaux de forçage de classe (`.env.production` → classe É minimale).

---

### Q11.5 — Comment gérer les secrets (clés API, tokens) qui transitent par les hooks ?

**Réponse** : Les secrets ne transitent pas par les hooks. Les hooks reçoivent uniquement les métadonnées de l'événement (nom d'outil, chemin de fichier cible, phase, classe de risque) — pas le contenu des fichiers ni les variables d'environnement.

Si un secret apparaît dans un `toolOutput` (ex : `cat .env.production` exécuté par l'agent), `post_tool` le détecte via regex + gitleaks intégré, émet `HARD_BLOCK` avec `violationType: SECRET_IN_PLAINTEXT`, et ne reproduit **pas** le secret dans le log. Seule la localisation (fichier + ligne estimée) est enregistrée.

Les secrets légitimes nécessaires au harness lui-même (ex : token Sigstore pour la signature) sont passés via des variables d'environnement lues à l'initialisation, jamais via les fichiers `.planning/`.

**Référence spec** : `05-gates-policy-spec.md` §2.2 — "Secret en clair → Regex + gitleaks intégré → HARD_BLOCK toutes classes" ; §3.3 — format de l'événement entrant (pas de contenu de fichier dans `GateEvent`).

---

### Q11.6 — Le harness vérifie-t-il les signatures des artefacts (skills, subagents) avant installation ?

**Réponse** : Oui pour les composants distribués via npm ; non pour les composants locaux (skills personnalisés dans `.planning/`).

Pour les composants npm (`@harness/skills-*`, `@harness/subagents-*`) :
- Vérification de la provenance npm (npm provenance attestation, disponible depuis npm 9.5)
- Hash SHA-512 dans `package-lock.json` vérifié à l'installation
- `harness install` refuse si la provenance est absente sur les packages critiques

Pour les skills locaux (fichiers Markdown dans `.planning/skills/`) :
- Pas de signature — ce sont des fichiers texte écrits par l'utilisateur
- `harness audit skills` vérifie leur conformité structurelle (champs obligatoires) mais pas leur authenticité

**Justification** : Signer les fichiers Markdown locaux créerait une friction sans valeur (l'utilisateur les écrit lui-même). La signature s'applique aux artefacts distribués où la supply chain est un vecteur d'attaque réaliste.

**Référence spec** : `05-gates-policy-spec.md` §4.2 — `slsa_provenance` et `cosign_signature` comme items d'evidence obligatoires pour É/C (appliqués aux artefacts produits par le projet, pas au harness lui-même, mais même principe).

---

### Q11.7 — Y a-t-il une liste de permissions explicites par mode ?

**Réponse** : Oui. La matrice est définie dans `registry/policies.yaml` (champ `allowedModes`) et dans la matrice de zones par phase. En bypass, les restrictions de zones restent actives — le bypass signifie absence de validation humaine, pas absence de gates.

Permissions par mode (en classe F, la plus permissive pour le bypass) :

| Action | pairing | auto-decision | bypass (T/F only) |
|---|:---:|:---:|:---:|
| Écrire dans `src/` (phase Build) | oui | oui | oui |
| Écrire dans `migrations/` | oui (avec ADR) | oui (avec ADR) | non (HARD_BLOCK) |
| Écrire dans `auth/` | oui (classe É forcée) | oui (classe É forcée) | non (signal forçage) |
| Écrire dans `infra/` | oui (classe É forcée) | oui (classe É forcée) | non (signal forçage) |
| Skip gate `pre_tool` | oui | non | oui (T/F only) |
| Merger sans review humaine | non | non | oui (T only) |

**Justification** : Le bypass ne désactive pas les hard-blocks universels (secrets, migrations sans ADR, zones absolument interdites). Il désactive uniquement la validation humaine active et les gates `user_prompt`/`pre_tool` pour les classes T/F.

**Référence spec** : `05-gates-policy-spec.md` §6.2 — conditions de bypass par classe ; §6.3 — bypass de gate individuelle.

---

### Q11.8 — Comment gérer les CVE qui apparaîtraient dans les dépendances du harness lui-même ?

**Réponse** : Processus en trois temps :

1. **Détection automatique** : Dependabot (ou Renovate) configuré sur le repo du harness, avec alertes CVE Critical/High en notification immédiate. Le workflow CI inclut `npm audit --audit-level=high` — un finding bloque le build.

2. **Triage** : Le harness expose `harness audit deps` qui lance `npm audit` sur le projet utilisateur ET sur l'installation globale du harness. Les CVE sont triées : Critical/High → patch dans les 48h, Medium → patch dans le sprint, Low → planifié.

3. **Distribution** : Un patch est publié en patch SemVer (`x.y.Z`). La mise à jour est signalée à l'utilisateur via `harness status` : `[SECURITY] Harness v1.2.3 disponible — CVE-2026-XXXXX corrigée. npm update -g @harness/cli`.

**Justification** : Le harness a peu de dépendances runtime (xstate, yaml, zod) — la surface CVE est limitée. L'essentiel du risque CVE vient du projet utilisateur, pas du harness lui-même.

**Référence spec** : `05-gates-policy-spec.md` §4.1 — `SCA sans CVE Critical/High non triée` comme item d'evidence obligatoire pour toutes les classes.

---

### Q11.9 — Le harness expose-t-il une commande `harness audit` qui scanne le projet pour les violations de politique ?

**Réponse** : Oui. `harness audit` est une commande de diagnostic statique (ne modifie rien). Elle produit un rapport structuré.

Sous-commandes :
- `harness audit policy` — vérifie la cohérence de `policies.yaml` et `gates.yaml` contre les schémas attendus
- `harness audit state` — vérifie que `state.yaml`, `mode.yaml`, `current-risk.yaml` sont cohérents entre eux
- `harness audit hooks` — vérifie les hashes des hooks installés (cf. Q11.2)
- `harness audit deps` — lance `npm audit` sur le projet courant
- `harness audit secrets` — lance gitleaks sur l'historique Git du projet (staging + commités)
- `harness audit` — exécute les cinq sous-commandes en séquence

Sortie : rapport Markdown écrit dans `.planning/logs/audit-<date>.md` + résumé console.

`harness audit` en CI (`--ci` flag) : exit code 1 si au moins un finding Critical/High, 0 sinon.

**Justification** : L'audit statique découple la vérification de l'exécution. Il peut être lancé avant de commencer un run, en CI, ou après une mise à jour du harness.

**Référence spec** : `05-gates-policy-spec.md` §7 — protocole d'escalade ; les mêmes règles de hard-block s'appliquent en mode audit.

---

### Q11.10 — Comment gérer la conformité RGPD pour les données traversant le harness (logs avec PII) ?

**Réponse** : Le harness ne traite pas de données personnelles d'utilisateurs finaux par design. Les seules données dans `.planning/logs/` sont des métadonnées de développement (chemins de fichiers, noms d'outils, phases, classes de risque, timestamps).

Deux cas résiduels à gérer :

1. **Noms de développeurs dans les logs** : `triggered_by: "human"` et `decided_by: "risk-classifier"` — pas de nom réel. Si le projet utilise des identifiants nominatifs dans `run_id` ou `activeItemRef` (ex : `PBI-42-dupont.md`), c'est une convention du projet, pas du harness.

2. **Données PII accidentelles dans `classifier_notes`** : si le développeur saisit des données personnelles dans un champ de texte libre, elles se retrouvent dans `decisions.jsonl`. La convention documentée interdit les données personnelles dans les champs de texte libre des logs. `harness audit secrets` inclut un scan de patterns PII basiques (email, numéro de téléphone) dans les JSONL.

Pour les projets traitant des données personnelles (classe É/C avec flag `touches_pii: true`), l'AIPD est un item d'evidence obligatoire — mais elle documente le projet, pas le harness.

**Justification** : Le harness est un outil de pipeline de développement. Il ne stocke pas de données d'utilisateurs finaux. La conformité RGPD s'applique au projet géré par le harness, pas au harness lui-même.

**Référence spec** : `08-planning-state-schema.md` §4 — champ `touches_pii` dans `current-risk.yaml` ; `05-gates-policy-spec.md` §4.2 — AIPD obligatoire si PII pour É/C.

---

### Q11.11 — Quelle politique de "secrets in git" ? Est-ce que le harness scanne et bloque ?

**Réponse** : Oui, en deux points d'enforcement :

**Point 1 — `post_tool` en temps réel** : à chaque écriture de fichier par l'agent, `post_tool` inspecte le contenu produit via regex + gitleaks. Si un secret est détecté, `HARD_BLOCK` immédiat avant que le fichier ne soit commité. Le fichier peut avoir été écrit sur disque, mais le git commit est bloqué.

**Point 2 — `harness audit secrets`** : scan rétrospectif de l'historique Git et du staging area via gitleaks. Produit un rapport des secrets déjà committés (pour les projets existants) et des secrets en staging non encore committés.

La politique est :
- Tout secret détecté → HARD_BLOCK toutes classes, sans exception
- Un secret déjà commité dans l'historique Git → `harness audit secrets` l'identifie et génère un plan de remédiation (rotation de clé + `git filter-repo` ou BFG)
- `.env*` files → interdits de staging par `pre_tool` (phase check), sauf `.env.example` explicitement permis

Le harness installe un hook Git `pre-commit` local (via `harness install`) qui lance gitleaks avant chaque commit, indépendamment de la plateforme agent active.

**Justification** : Le coût d'une clé API leakée dépasse largement le coût d'un faux positif. La double couverture (runtime `post_tool` + hook Git `pre-commit`) garantit qu'aucun secret ne passe même en cas de contournement du harness.

**Référence spec** : `05-gates-policy-spec.md` §2.2 — "Secret en clair → HARD_BLOCK toutes classes" ; §5.2 — matrice hard-block/warning (colonne secrets : BLOCK pour toutes les classes).

---

*Document de décision — à maintenir dans `docs/conception/open-questions/`. Quand une décision est implémentée, déplacer la question correspondante vers le document de conception concerné avec une référence à ce fichier.*
