# OQ-02 — Classification de risque : réponses définitives

> **Source spec** : `harness-architecture/docs/conception/02-risk-classifier-spec.md`
> **Questions** : `docs/research-reports/openquestion.md` §2 (Q2.1–Q2.15)
> **Date** : 2026-05-03
> **Statut** : Tranché — toutes questions couvertes par la spec v1

---

### Q2.1 — Qui propose la classe de risque initiale ?

**Réponse** : L'agent IA propose la classe initiale via `classifyRisk(changeset)`. L'algorithme est déterministe (4 passes séquentielles), pas une inférence LLM. Le développeur valide au triage — il ne génère pas, il confirme ou override.

**Justification** : La séparation proposition-automatique / validation-humaine est la seule architecture qui garantit à la fois vitesse (< 30 ms) et accountability humaine sur les classes É/C.

**Référence spec** : `02-risk-classifier-spec.md` §2 (arbre déterministe) + §10 Q1 ("proposée par l'agent via `classifyRisk(changeset)` en < 30ms, validée par le développeur au triage")

---

### Q2.2 — Comment éviter le biais d'optimisme de l'agent ?

**Réponse** : Le biais est structurellement impossible sur les passes 1 et 2 : les signaux de forçage É/C sont des règles déterministes sur chemins de fichiers, labels et contenu du diff — l'agent n'a aucune marge d'interprétation. Sur la passe 3 (score composite), les seuils sont fixes et versionnés dans le harness. La première version des patterns est délibérément conservatrice : sur-classification préférable à sous-classification.

**Justification** : Un arbre déterministe non paramétrable par le LLM ne peut pas être biaisé par optimisme. Le biais serait possible uniquement si l'agent construisait le `Changeset` input — ce point est à surveiller lors de l'implémentation de l'adaptateur PR.

**Référence spec** : `02-risk-classifier-spec.md` §2 (propriété de monotonie) + §10 Q1 ("La première version des patterns est conservatrice")

---

### Q2.3 — Quels sont les critères mécaniques de classification ?

**Réponse** : Quatre catégories exhaustives : (1) patterns de chemins de fichiers (glob/regex, §3.1 — 8 patterns), (2) signaux dans le contenu du diff (§3.2 — DDL SQL, champs PII nommés, secrets), (3) labels de PR/backlog (§3.3 — 16 labels), (4) signaux structurels (§3.4 — taille du diff, nouvelles deps, CVSS score). Tout signal de forçage C/É est non négociable : toucher `auth/` force É minimum, sans exception.

**Justification** : La liste est fermée et versionnable dans le harness. Elle évolue uniquement via le cycle Apprentissage (§9.6), jamais par décision ad hoc.

**Référence spec** : `02-risk-classifier-spec.md` §3 (tableaux §3.1 à §3.4)

---

### Q2.4 — La classification est-elle binaire ou multidimensionnelle ?

**Réponse** : Hybride. Les passes 1 et 2 sont binaires (signal présent → classe minimale forcée, non pondérable). La passe 3 est multidimensionnelle : score composite = `impact_estimé (1–5) × probabilité_estimée (1–5)`, soit 25 combinaisons mappées vers T/F/M/É/C. La classe finale est le MAX des deux approches — pas une somme pondérée, pas une moyenne.

**Justification** : Le MAX garantit la propriété de monotonie : aucun signal de forçage ne peut être "dilué" par un score composite faible.

**Référence spec** : `02-risk-classifier-spec.md` §2 Passe 3 (score composite) + Passe 4 (MAX)

---

### Q2.5 — Comment combiner les dimensions pour produire la classe finale ?

**Réponse** : `classe_finale = MAX(classe_min, classe_calculée)`. `classe_min` est le maximum des classes forcées par les passes 1 et 2. `classe_calculée` est issue du score Impact×Probabilité de la passe 3. Le MAX est appliqué en passe 4 — pas de somme pondérée, pas de règle métier ad hoc.

**Justification** : Le MAX est la seule combinaison qui respecte la monotonie et empêche qu'un score faible "annule" un signal de forçage critique.

**Référence spec** : `02-risk-classifier-spec.md` §2 Passe 4 ("classe_finale = MAX(classe_min, classe_calculée)")

---

### Q2.6 — Quels sont les fichiers ou dossiers sentinelles ?

**Réponse** : Liste exhaustive versionnée en §3.1. Sentinelles É : `auth/`, `authorization/`, `sessions/`, `oauth/`, `sso/`, `payments/`, `billing/`, `invoices/`, `subscriptions/`, `migrations/`, `*.migration.ts`, `*.sql`, `api/public/`, `openapi.yaml`, `swagger.json`, `*.proto`, `infra/`, `terraform/`, `k8s/`, `docker-compose.prod*`, `.env*`, `config/security*`, `secrets/`. Sentinelles C : `health/`, `biometric/`, `medical/`.

**Justification** : La liste est close à la date de conception. Elle évolue uniquement via le module de calibration (§9.6) sur base de corrélation incidents/patterns.

**Référence spec** : `02-risk-classifier-spec.md` §3.1 (tableau complet)

---

### Q2.7 — Comment le harness détecte-t-il qu'un fichier sensible va être touché ?

**Réponse** : Trois points de scan distincts : (a) création de l'item en Cadrage (fichiers déclarés), (b) création de la PR/branche (fichiers commitués), (c) à chaque push via le hook `pre_tool_use` qui appelle `scanForForcingSignals(files, diffContent, labels)`. Le hook parse `tool_input` pour extraire les chemins de fichiers et le contenu du diff, puis applique les patterns §3.

**Justification** : Le scan continu à chaque push est le seul mécanisme qui détecte les signaux apparus après la classification initiale (ex : ajout d'un fichier `auth/` en cours de Build).

**Référence spec** : `02-risk-classifier-spec.md` §9.5 (hook pre_tool_use) + §10 Q1 ("automatiquement déclenchée à trois moments")

---

### Q2.8 — Comment gérer les classifications fausses (l'agent dit F, c'est É) ?

**Réponse** : Le protocole de promotion §5 gère exactement ce cas. Dès qu'un signal É est détecté dans un commit sur un item classé F : (1) PR mise en pause immédiate, (2) notification au développeur avec signal + fichier + commit déclencheur, (3) reclassification automatique F → É, (4) déclenchement du chemin obligatoire É complet, (5) log dans `escalation_history`. Le développeur peut contester dans les 4h ; passé ce délai, la promotion est confirmée par défaut conservateur.

**Justification** : La correction est automatique, non optionnelle, et irréversible sans dérogation documentée. Il n'existe pas d'état silencieux où une fausse classification persiste.

**Référence spec** : `02-risk-classifier-spec.md` §5 (protocole de promotion complet) + §10 Q6

---

### Q2.9 — La promotion est-elle réversible ? Peut-on rétrograder une classe ?

**Réponse** : Oui, via `demoteRisk()`, mais sous contraintes strictes. La rétrogradation É → M requiert : humain + justification documentée + contresignature agent. La rétrogradation C → É requiert en plus une date de revue obligatoire. Les sauts de classe sont interdits (M → T = interdit). É → F/T et C → M/F/T sont absolument interdits. Tant qu'un signal de forçage actif est incompatible avec la classe cible, le déclassement est rejeté par `RiskClassificationError('FORCING_SIGNAL_ACTIVE')`.

**Justification** : La réversibilité existe pour accommoder les vrais faux positifs (ex : migration DB sur staging isolé), pas pour contourner les garde-fous.

**Référence spec** : `02-risk-classifier-spec.md` §4.2 (tableau de déclassement) + §8.2 (`demoteRisk`)

---

### Q2.10 — Doit-on logger toutes les classifications, même les fausses ?

**Réponse** : Oui, sans exception. Chaque `ClassificationResult` est horodaté et inclut `proposedBy`, `activeSignals`, `compositeScore`. Les promotions et déclassements sont loggés dans `escalation_history` (format §5.3). Le module `calibration.ts` (§9.6) consomme cet historique pour calculer les taux de promotions et de déclassements, et proposer des mises à jour des patterns.

**Justification** : Sans log des faux positifs/négatifs, la boucle de calibration auto-améliorante ne peut pas fonctionner. L'historique complet est la matière première du cycle Apprentissage.

**Référence spec** : `02-risk-classifier-spec.md` §8.1 (`ClassificationResult.classifiedAt`) + §9.6 (Cycle Apprentissage) + §5.3 (format `escalation_history`)

---

### Q2.11 — La classe de risque peut-elle évoluer entre les phases ?

**Réponse** : Oui, c'est le comportement normal et attendu. La classification est déclenchée à trois moments : Cadrage, création de PR, et à chaque push. Une story classée F en Discovery peut être promue M ou É en Build si de nouveaux signaux apparaissent. Le protocole de promotion §5 formalise exactement cette évolution. La propriété de correction garantit que toute élévation détectée produit soit une promotion tracée, soit une dérogation documentée — jamais un silence.

**Justification** : Figer la classe à la Discovery serait dangereux : l'implémentation révèle souvent des dépendances imprévues (ex : un refactor qui touche finalement `auth/`).

**Référence spec** : `02-risk-classifier-spec.md` §5 (machine à états de promotion) + §9.5 (scan continu) + §10 Q6 ("propriété de correction")

---

### Q2.12 — Faut-il des classes intermédiaires (T+, F-, M+, etc.) ?

**Réponse** : Non. La matrice à 5 niveaux (T/F/M/É/C) est suffisante et fermée. La spec ne prévoit aucune classe intermédiaire. La granularité fine est gérée par le score composite (25 combinaisons mappées vers 5 classes) et par la passe 4 (MAX), qui couvrent la continuité des cas réels sans introduire une complexité taxonomique supplémentaire.

**Justification** : Des classes intermédiaires rendraient l'arbre non déterministe (comment interpréter F- vs F ?) et compliqueraient la matrice Risque × Mode (§6) et Risque × Profondeur de cycle (§7) sans gain mesurable.

**Référence spec** : `02-risk-classifier-spec.md` §1 ("Cinq classes ordonnées, non chevauchantes") + §2 Passe 3 (mapping score → classe, 5 buckets)

---

### Q2.13 — Comment classifier les changements transverses (refactor 50 fichiers hétérogènes) ?

**Réponse** : Deux mécanismes s'appliquent en parallèle. (1) Les signaux de forçage des passes 1 et 2 sont évalués sur l'union de tous les fichiers modifiés — un seul fichier `auth/` dans les 50 suffit à forcer É. (2) Si ≥ 2 repos/services distincts sont touchés, le signal `cross_repo` force C (passe 1c). En pratique, un refactor de 50 fichiers hétérogènes tombera au minimum en M via le signal structurel "diff net > 300 lignes" (§3.4), et potentiellement en É/C si les fichiers incluent des zones sensibles.

**Justification** : L'union des signaux garantit qu'on ne rate aucun risque dans un diff hétérogène. Le signal `cross_repo` couvre spécifiquement les refactors multi-services.

**Référence spec** : `02-risk-classifier-spec.md` §2 Passe 1c (cross-repo → C) + §3.4 (diff > 300 lignes → M)

---

### Q2.14 — La classe doit-elle être stockée par story (PBI) ou par PR ?

**Réponse** : Par les deux, avec la même source de vérité. La classe est initialement assignée à l'item backlog (PBI) en Cadrage. Elle est ensuite portée par la PR via `route_set.risk_class` (§9.3). Si une PR couvre plusieurs stories, la classe de la PR est le MAX des classes des stories concernées — la propriété de monotonie s'applique à l'agrégation.

**Justification** : Stocker uniquement par PR perd le contexte backlog. Stocker uniquement par PBI empêche de piloter les gates CI par PR. Les deux niveaux sont nécessaires.

**Référence spec** : `02-risk-classifier-spec.md` §9.3 (Route Set — `route_set.risk_class`) + §2 Passe 4 (propriété de monotonie, applicable à l'agrégation)

---

### Q2.15 — Comment la classification interagit-elle avec les classes de stories (feature/bug/refactor/spike) ?

**Réponse** : Le `changeType` du `Changeset` est un signal d'entrée parmi d'autres — il n'est pas déterminant seul. `architecture_refactor` est un signal de forçage C (passe 1d). `migration` force É (passe 2 implicite via les patterns de fichiers). `spike` sera généralement T ou F (code throwaway, sans impact prod) mais reste soumis à l'arbre : un spike touchant `auth/` serait quand même É. La classe de risque prime sur la classe de story : un `fix` peut être C, un `refactor` peut être T.

**Justification** : La classe de story indique l'intention ; la classe de risque indique l'impact réel. Les deux sont orthogonaux et doivent être traités séparément.

**Référence spec** : `02-risk-classifier-spec.md` §8.1 (`Changeset.changeType` — input) + §2 Passe 1d (`architecture_refactor` → C) + §1.T (critères d'inclusion du refactor mécanique)

---

*Produit par agent general-purpose — Pipeline Fractale v4 — 2026-05-03*
*Spec source : `harness-architecture/docs/conception/02-risk-classifier-spec.md`*
