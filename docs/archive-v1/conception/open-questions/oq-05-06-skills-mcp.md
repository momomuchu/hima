# OQ-05 & OQ-06 — Skills, Subagents, MCP Servers

> **Statut** : TRANCHÉES — phase Conception  
> **Date** : 2026-05-03  
> **Sources** : `06-skills-catalog-spec.md`, `07-subagents-catalog-spec.md`, `04-runtime-bindings-spec.md`

---

## Section 5 — Skills et Subagents

---

### Q5.1 — Liste exhaustive des skills à fournir par défaut

**Réponse** : 12 skills au total — 4 core (always-on) + 8 cycle-specific.

Core (toutes classes, tous cycles) :
- `classify-risk` — classification T/F/M/É/C, auto-invoquée avant toute action
- `propose-change` — formalisation Intent Set, scalée à la classe
- `transition-phase` — gate DoD + avancement state machine
- `status` — snapshot read-only de l'état courant

Cycle-specific (M/É/C sauf indication) :
- `discovery-validate` — cycle 01 : note découverte + recommandation build/pivot/kill
- `cadrage-dor` — cycle 02 : Definition of Ready (DoR) complète
- `conception-adr` — cycle 03 : ADRs MADR 4.0, C4, STRIDE, contrats API
- `build-inner-loop` — cycle 04 : boucle TDD RED/GREEN/REFACTOR + Tidy First (actif dès F)
- `validation-report` — cycle 05 : rapport Go/No-Go/Go-with-reservations
- `release-plan` — cycle 06 : SemVer, stratégie déploiement, rollback, smoke tests
- `run-monitor` — cycle 07 : Four Golden Signals, burn rate error budget, OODA
- `apprentissage-retro` — cycle 08 : PDCA/Kaizen + Kolb, DORA archive, harness-delta

**Justification** : chaque skill couvre exactement un cycle ou une responsabilité transverse. La liste est close pour le MVP — toute nouvelle skill passe par le SKILL.md template et le tableau de routage.

**Référence spec** : `06-skills-catalog-spec.md` §1 (inventory table), §2–§3 (skill drafts), §6 (matrice risk × skill).

---

### Q5.2 — Skills tournées vers l'utilisateur (slash commands) ou vers l'agent (auto-chargées) ?

**Réponse** : Les deux simultanément. Chaque skill est à la fois invocable en slash command (`/classify-risk`, `/status`, etc.) et auto-invoquée par le runtime agent via description-match. Il n'y a pas de mode exclusif — la même SKILL.md sert les deux vecteurs.

**Justification** : sur Claude Code et Hermes, les skills installées deviennent automatiquement des slash commands ET des cibles de routing par description. Le champ `AUTO-INVOKE` du SKILL.md template déclare la condition d'auto-déclenchement. Sur Codex, le routing par description est optionnel — le slash command reste le vecteur principal. Les 4 skills core (`classify-risk`, `propose-change`, `status`, `transition-phase`) sont prioritairement auto-invoquées ; les skills cycle-specific sont prioritairement en slash.

**Référence spec** : `06-skills-catalog-spec.md` §4 (template SKILL.md — champ AUTO-INVOKE), `04-runtime-bindings-spec.md` §3.2 (SKILL.md format differences — colonne "Auto-invocation").

---

### Q5.3 — Comment éviter la collision entre nos skills et les skills déjà installées par l'utilisateur ?

**Réponse** : Namespace préfixé `harness-` pour tous les noms de skills harness installées dans les répertoires globaux. Les skills core restent sans préfixe dans la source monorepo (`classify-risk/SKILL.md`) mais sont enregistrées avec préfixe côté plateforme : `harness-classify-risk`. Les trigger keywords du SKILL.md standard sont exclusifs — le harness possède les termes `classify`, `risk`, `advance`, `transition`, `retro`, etc. En cas de collision détectée à l'install, le harness loge un warning et renomme sa skill en `harness-<name>` sans casser l'existant.

**Justification** : `06-skills-catalog-spec.md` §4 Validation Rules impose l'unicité des trigger keywords. L'installateur implémente la détection de collision via `harness skill register --check-conflicts` avant toute écriture.

**Référence spec** : `06-skills-catalog-spec.md` §4 (validation rules — "Trigger keywords must be unique"), `04-runtime-bindings-spec.md` §5.1 step 5 (copy artifacts/skills — merge, pas overwrite).

---

### Q5.4 — Les skills sont-elles versionnées séparément ou ensemble avec le harness ?

**Réponse** : Les skills sont versionnées ensemble avec le harness dans le monorepo sous `packages/artifacts/skills/`. Il n'y a pas de versioning indépendant par skill au MVP. La version du harness (SemVer) couvre l'ensemble des skills. Un champ `version` optionnel dans le frontmatter SKILL.md est réservé pour tracking interne mais ne déclenche pas de résolution de dépendance séparée.

**Justification** : les skills sont des artefacts purs (Markdown), sans runtime propre. Leur sémantique est étroitement couplée aux types TS du core (`RiskClass`, `EvidenceSet`). Versionner séparément créerait des incompatibilités silencieuses entre skill v1.2 et core v2.0. Le couplage délibéré simplifie les migrations.

**Référence spec** : `06-skills-catalog-spec.md` §5.4 (monorepo source of truth — `packages/artifacts/skills/`), `04-runtime-bindings-spec.md` §5 (install behavior — skills copiées par l'installateur sans version autonome).

---

### Q5.5 — Liste exhaustive des subagents à fournir

**Réponse** : 9 subagents au total — 4 MVP core + 5 post-MVP étendus.

MVP (livrés avec le harness dès l'Étape 2) :
- `reviewer` — revue de code antagoniste, verdict APPROVED/CHANGES_REQUIRED, obligatoire M+
- `threat-modeler` — analyse STRIDE sur nouveaux flux de données, obligatoire É/C
- `test-writer` — rédige tests TDD RED aveugle à l'implémentation, obligatoire M+ en TDD
- `evidence-collector` — consolide l'Evidence Set, obligatoire toutes classes, toujours séquentiel en dernier

Post-MVP (Étape 3 et au-delà) :
- `security-auditor` — OWASP ASVS + DAST simulé + CVE dependencies, obligatoire É/C
- `accessibility-checker` — WCAG 2.2 AA, accessibility tree, obligatoire M+ (si UI)
- `perf-profiler` — latence p99/throughput/error rate contre SLO, obligatoire É/C
- `doc-generator` — README/ADR/CHANGELOG depuis diff, obligatoire É/C user-facing
- `retro-facilitator` — anime rétrospective cycle, collecte DORA, obligatoire M+

**Justification** : la liste MVP couvre les 4 rôles minimaux pour que l'Evidence Set soit complet (revue qualité, sécurité É/C, tests RED, consolidation). Les 5 post-MVP adressent des dimensions non bloquantes en MVP (a11y, perf, doc, retro animée).

**Référence spec** : `07-subagents-catalog-spec.md` §1 (inventory table), §2 (MVP core), §3 (post-MVP), §6 (matrice risk × subagent).

---

### Q5.6 — Les subagents sont-ils spawnés explicitement ou automatiquement sur certains événements ?

**Réponse** : Le harness spawne toujours explicitement. Aucun subagent ne se déclenche spontanément. C'est le hook `pre_tool` ou la logique de cycle dans le runtime qui appelle `spawnSubagent()` ou `spawnSubagentBatch()` au moment précis défini par le séquençage de cycle. Sur Claude Code, la description-match peut théoriquement auto-sélectionner un subagent, mais le harness désactive ce mode en spawnant toujours par nom pour garantir la portabilité.

**Justification** : `07-subagents-catalog-spec.md` §4 Annexe B — "Spawn : Auto (description match) ou explicite" pour Claude Code, mais "Harness spawn toujours explicite" est la règle transverse. Cela garantit la portabilité sur Codex (explicite uniquement) et Hermes (`delegate_task` explicite).

**Référence spec** : `07-subagents-catalog-spec.md` Annexe B (portabilité — colonne Spawn), `04-runtime-bindings-spec.md` §1 (worker.spawn_mode — "explicit" harness rule).

---

### Q5.7 — Les subagents ont-ils accès à `.planning/` ? En lecture, en écriture ?

**Réponse** : Les subagents n'ont pas accès à `.planning/`. Ils écrivent uniquement dans `.rms/runs/<run-id>/evidence/<subagent-name>/`. L'accès en lecture est limité aux fichiers explicitement passés en input JSON par le thread parent (ex : `diff`, `design_doc`, `interface_contracts`). Le thread parent lit `.planning/` et fournit les extraits pertinents — le subagent ne fait jamais de lecture directe sur le filesystem harness.

**Justification** : l'isolation de contexte est garantie nativement par les 3 plateformes. Le principe "le subagent reçoit uniquement son prompt système + input JSON + fichiers explicitement passés" (§7.2) empêche toute dépendance implicite sur `.planning/`. La règle `allowedTools: Write(path:.rms/runs/**/evidence/*)` dans le frontmatter Claude Code enforce la restriction.

**Référence spec** : `07-subagents-catalog-spec.md` §4.1 (frontmatter `allowedTools` — `Write(path:.rms/runs/**/evidence/*)`), §7.2 (isolation — "Il ne voit pas l'historique complet du thread parent"), §5.1 (circuit obligatoire — écriture dans `.rms/runs/<run-id>/evidence/` uniquement).

---

### Q5.8 — Le mode de l'agent principal s'applique-t-il aussi aux subagents ?

**Réponse** : Oui, par héritage de contrainte — pas par propagation de variable. Le thread parent n'envoie pas le mode (pairing/auto/bypass) au subagent. En revanche, c'est le thread parent qui décide de spawner ou non le subagent selon le mode courant. En mode bypass (T/F uniquement), seul `evidence-collector` est spawné. En mode pairing (É/C), tous les subagents obligatoires sont spawnés et leurs verdicts bloquants suspendent le run en attendant la décision humaine.

**Justification** : les subagents sont des workers techniques sans connaissance du mode opératoire. Le mode est une politique du harness, pas une variable d'exécution subagent. La matrice risk × subagent (§6) encode cette décision : le spawn conditionnel au mode est implicite dans la colonne applicable.

**Référence spec** : `07-subagents-catalog-spec.md` §6 (matrice — règle bypass : "en mode bypass, seul evidence-collector reste mandatory"), §5.3 (traitement des échecs — "verdict bloquant : suspendre le run, notifier le développeur").

---

### Q5.9 — Comment contraindre les subagents à respecter la classe de risque ?

**Réponse** : Deux mécanismes complémentaires. (1) Le champ `risk_class` est passé explicitement dans l'input JSON de chaque subagent — le subagent calibre sa profondeur d'analyse en fonction (ex : `reviewer` applique la checklist sécurité complète pour É/C, allégée pour M). (2) Le harness ne spawne que les subagents dont la colonne dans la matrice risk × subagent est M ou O pour la classe courante — les autres sont skipped sans même être instanciés.

**Justification** : `07-subagents-catalog-spec.md` §2.1 input schema du `reviewer` inclut `"risk_class": "M"`. La matrice §6 encode le filtre au niveau du runtime, via `getRequiredSubagents(riskClass, cycle)` (§8.2).

**Référence spec** : `07-subagents-catalog-spec.md` §2.1–§2.4 (champ `risk_class` dans tous les inputs), §6 (matrice), §8.2 (`getRequiredSubagents` — API TypeScript).

---

### Q5.10 — Les subagents peuvent-ils déclencher des hooks ?

**Réponse** : Non. Les subagents s'exécutent dans un contexte isolé qui n'a pas accès aux hooks du harness. Ils ne peuvent pas émettre d'événements hook vers le parent. Les résultats remontent exclusivement via le circuit Evidence Set → `events.jsonl` → thread parent. Sur Claude Code, un subagent peut potentiellement déclencher des hooks Claude natifs (PreToolUse, etc.) si ses tools sont autorisés à écrire des fichiers, mais le harness n'exploite pas ce canal — tout passe par le JSON structuré.

**Justification** : `07-subagents-catalog-spec.md` §5.2 Interdits explicites — "Un subagent ne doit jamais spawner d'autres subagents". Dans la même logique, déclencher des hooks harness constituerait un couplage implicite au-delà du périmètre déclaré. Le circuit obligatoire (§5.1) est le seul canal de communication autorisé.

**Référence spec** : `07-subagents-catalog-spec.md` §5.1 (circuit obligatoire), §5.2 (interdits explicites — profondeur 0 en MVP).

---

### Q5.11 — Y a-t-il une notion de subagent persistant (survit entre sessions) ou tous sont-ils éphémères ?

**Réponse** : Tous les subagents sont éphémères. Chaque spawn crée une conversation fraîche sans historique partagé. La persistance inter-sessions est assurée exclusivement via les artefacts écrits dans `.rms/runs/<run-id>/evidence/` et consolidés dans `evidence-set.json`. Un subagent spawné dans une session suivante reçoit en input les fichiers evidence de la session précédente si le thread parent juge pertinent de les inclure — mais le subagent lui-même n'a aucune mémoire propre.

**Justification** : `07-subagents-catalog-spec.md` §7.2 — "Chaque subagent reçoit un contexte isolé : il ne voit pas l'historique complet du thread parent." Cette isolation est garantie nativement par les 3 plateformes (Claude Code : contexte propre, Codex : thread séparé, Hermes : conversation fraîche). La persistance via fichiers est la seule mémoire cross-session.

**Référence spec** : `07-subagents-catalog-spec.md` §7.2 (isolation), Annexe B (portabilité — "Isolation contexte : Garantie sur les 3").

---

### Q5.12 — Comment partager du contexte entre subagents sans tout dupliquer ?

**Réponse** : Via les fichiers de l'Evidence Set en lecture partagée. Le thread parent passe à chaque subagent uniquement les références aux fichiers pertinents produits par les subagents précédents (ex : `threat_model_ref` passé au `reviewer` pour qu'il lise le threat model produit par `threat-modeler`). Les subagents ne se lisent pas directement — c'est toujours le thread parent qui orchestre quelles sorties alimentent quels inputs. Le séquençage recommandé (§7.4) encode l'ordre des dépendances : les subagents parallèles n'ont pas de dépendances inter-elles ; les dépendances sont séquentielles.

**Justification** : `07-subagents-catalog-spec.md` §2.1 input `reviewer` — champ `"threat_model_ref"` est un chemin fichier écrit par `threat-modeler`. §7.4 séquençage — les parallèles (`reviewer`, `security-auditor`, `accessibility-checker`) n'ont pas de dépendance mutuelle ; `evidence-collector` séquentiel les consolide en dernier.

**Référence spec** : `07-subagents-catalog-spec.md` §2.1 (reviewer input — `threat_model_ref`), §5.1 (circuit obligatoire — consolidation par evidence-collector), §7.4 (séquençage recommandé par cycle).

---

## Section 6 - MCP Servers

---

### Q6.1 — Le harness expose-t-il lui-même un MCP server ?

**Réponse** : Oui. Le harness expose un MCP server via le binaire `harness-mcp-server`. Les plateformes peuvent l'enregistrer sous le nom local `harness-state`, mais le binaire executable et le `serverInfo.name` MCP sont `harness-mcp-server`. Le contrat outil canonique est documente dans `11-mcp-tools-spec.md`.

**Justification** : `packages/mcp-server/package.json` declare le bin `harness-mcp-server`. `packages/mcp-server/src/index.ts` expose le MCP JSON-RPC surface `initialize`, `tools/list`, `tools/call`, et les outils `rms.*` plus les alias de compatibilite `harness:*`.

**Référence spec** : `04-runtime-bindings-spec.md` §4, `11-mcp-tools-spec.md`.

---

### Q6.2 — Quel transport pour le MCP server harness ? Quelle authentification ?

**Réponse** : Transport **stdio** uniquement pour le MVP. Le harness MCP server s'execute comme sous-processus local lance par la plateforme via `harness-mcp-server` - pas d'exposition reseau, pas de port. L'authentification est implicite par le fait que le processus est lance localement par l'utilisateur courant.

**Justification** : stdio ne requiert aucune configuration reseau, est disponible partout, et correspond au modele de confiance local pour un outil de developpement mono-utilisateur.

**Référence spec** : `04-runtime-bindings-spec.md` §1 et §4, `11-mcp-tools-spec.md`.

---

### Q6.3 — Les outils MCP exposés sont-ils accessibles sur les 3 plateformes de la même manière ?

**Réponse** : Oui, avec une nuance de configuration. Le MCP server peut etre enregistre sous une cle locale differente selon la plateforme, mais le `command` reste `harness-mcp-server`, les `args` restent vides, et les outils exposes sont les memes.

**Justification** : La semantique MCP elle-meme est cross-plateforme par construction. La divergence acceptable est uniquement le format de fichier de configuration.

**Référence spec** : `04-runtime-bindings-spec.md` §4 et §7.

---

### Q6.4 — Comment configurer les MCP servers tiers (GitHub, Slack, etc.) de manière portable entre les 3 plateformes ?

**Réponse** : Differe pour le MVP. Le CLI actuel ne fournit pas de namespace `harness mcp`. La v0.1 configure uniquement le MCP server harness lui-meme via les installateurs plateforme. Les MCP servers tiers restent geres par les plateformes ou par une future extension explicite.

**Justification** : Ajouter `harness mcp add/sync/test` maintenant creerait un contrat CLI non implemente. Le contrat executable actuel ne liste aucun sous-commande `harness mcp`.

**Référence spec** : `09-cli-commands-spec.md`, `11-mcp-tools-spec.md`.

---

### Q6.5 — Le harness doit-il proxifier certains MCP servers (intercepter pour appliquer la classe de risque) ou les exposer directement ?

**Réponse** : Exposition directe. Le harness ne proxifie pas les MCP servers tiers. La classe de risque est appliquée en amont via le hook `pre_tool` qui intercepte tous les appels d'outils — y compris les outils MCP — avant leur exécution. Ce hook analyse `tool_name` et `tool_input` pour décider allow/deny selon la phase et la classe courante. Un proxy MCP serait une surcouche redondante et coûteuse en latence.

**Justification** : `04-runtime-bindings-spec.md` §2.3 `gate.pre_tool` — "Payload received : tool_name, tool_input, session_id, cwd, permission_mode". Le hook `PreToolUse` reçoit le nom de l'outil MCP et son input, ce qui suffit pour appliquer les règles harness. La proxification ajouterait un hop réseau sans gain fonctionnel.

**Référence spec** : `04-runtime-bindings-spec.md` §2.3 (gate.pre_tool — payload tool_name/tool_input, harness use : "enforce write-protection by phase, block destructive ops in wrong phase").

---

### Q6.6 — Comment gérer les MCP servers qui exigent OAuth (login interactif) en mode auto-décision ou bypass ?

**Réponse** : Le harness délègue entièrement la gestion OAuth à la plateforme. En mode auto-décision ou bypass, si un MCP server exige un flow OAuth non encore complété, la plateforme (Claude Code, Codex, Hermes) présente le flow interactif à l'utilisateur — le harness ne l'intercepte pas. Le harness logue l'événement `MCP_AUTH_REQUIRED` dans `events.jsonl` et continue. Si l'authentification échoue et que l'outil MCP est critique pour le cycle courant, le harness marque le gap dans l'Evidence Set (`known_gaps`) et continue en mode dégradé.

**Justification** : `04-runtime-bindings-spec.md` §9.1 Degradation Strategy Matrix — "MCP server registration : Any → Skip MCP server ; harness operates in file-only mode ; Log MCP_UNAVAILABLE". La même logique s'applique à l'indisponibilité OAuth. Le harness ne peut pas et ne doit pas tenter de gérer des flows OAuth — c'est le domaine de la plateforme et de l'utilisateur.

**Référence spec** : `04-runtime-bindings-spec.md` §9.1 (degradation matrix — MCP server indisponible → file-only mode), §9.2 (decision tree — fail-open sur erreur non gérée).

---

### Q6.7 — Comment versionner la configuration MCP (changer un endpoint) sans casser les sessions actives ?

**Réponse** : Pour le MVP, seule la configuration du MCP server harness est geree. Le changement de version passe par la mise a jour du package et la reinstallation/reparation plateforme via les commandes de lifecycle. Il n'existe pas encore de `mcp-registry.yaml` canonique ni de commande `harness mcp sync`.

**Justification** : Les configs MCP sont des fichiers statiques lus au demarrage de la plateforme. Le lifecycle existant couvre deja l'application, la reparation et la desinstallation du serveur MCP harness.

**Référence spec** : `09-cli-commands-spec.md` §6, `11-mcp-tools-spec.md`.

---

### Q6.8 — Le harness fournit-il une CLI `harness mcp test` pour vérifier qu'un MCP server est bien configuré ?

**Réponse** : Non pour la v0.1 executable actuelle. La verification MCP est couverte par les tests package et par le contrat `tools/list`/`tools/call` du serveur. Une future commande `harness mcp test` peut etre ajoutee uniquement apres extension explicite du CLI et mise a jour de `09-cli-commands-spec.md`.

**Justification** : Documenter une commande absente recree la derive que le Sprint 25 corrige. Le contrat executable impose que toute commande documentee dans la surface CLI existe dans `packages/cli/src/index.ts`.

**Référence spec** : `09-cli-commands-spec.md`, `11-mcp-tools-spec.md`, `packages/mcp-server/test/index.test.ts`.

---

*Toutes les questions Q5.1–Q5.12 et Q6.1–Q6.8 sont tranchées. Aucune n'est différée.*
