# SPEC-004 — Profils agents v0.1 (planner, executor, critic)

status: draft
date: 2026-06-11
version: 0.1
source: PROPOSITION.md §2, §12 ; lane-omo.md §1 ; ultragoal/brief.md Wave2-MélangeOMO ; deep-interview-hima-positioning.md R3-2
claim-bearing: true

Falsifies-If: si après Wave 3 un profil peut contourner une gate bloquante M+ (ex: planner écrit du code, executor contourne le verify obligatoire) → les contraintes de profil sont insuffisantes ; réécrire les hooks d'enforcement avant toute itération de profil.

---

## Contexte et décisions fondateur actées

- v0.1 = 3 profils fonctionnels : `planner`, `executor`, `critic`. Noms fonctionnels actés (PROPOSITION.md §12, Q1). Famille nominale différée.
- Mécanisme OMO `prompts-core` réimplémenté — jamais copié (licence SUL-1.0 incompatible MIT + offre payante).
- Les behaviors (gates bloquantes, criticality) s'appliquent à **tous** les profils ; un profil ne peut pas désactiver une gate M+.
- Vitesse et simplicité d'abord. 8 profils restants en Wave 4+.

---

## CRITICAL items

- [CRITICAL][BLOCKS:critical] Un profil est une `VariantTable` : `Record<variantName, PromptSource>`. Chaque variant est soit `{ kind: "bundled", content: string, filePath: string }` (importé statiquement à la compilation) soit `{ kind: "filesystem", baseDir: string }` (lecture disque async). Le mécanisme est réimplémenté dans `packages/prompts-core/`.

- [CRITICAL][BLOCKS:critical] Le profil `planner` est **interdit d'écrire du code**. Cette contrainte est enforced par un hook `pre_tool_call` bloquant (gate `planner-write-guard`) — pas uniquement par le prompt. La gate bloque toute tentative d'écriture de fichier non-`.md` et non-`.hima/plans/**` quand le profil actif est `planner`. Pattern OMO `prometheus-md-only` réimplémenté.

- [CRITICAL][BLOCKS:critical] Les behaviors (gates M+, verify obligatoire, worker-model, etc.) s'appliquent à tous les profils sans exception. Un profil ne peut pas déclarer `skipGate: true` ou équivalent. L'interaction profil × behaviors est unidirectionnelle : les behaviors contraignent les profils, jamais l'inverse.

- [CRITICAL][BLOCKS:high] `resolveVariant({ modelID, agentName, variants })` est le seul point de sélection de variant. Ordre de résolution :
  1. Si `agentName` appartient à `PLANNER_AGENT_NAMES` ET variant `"planner"` présent → `"planner"`.
  2. Sinon premier variant dont le matcher modèle (`MODEL_MATCHERS`) matche le `modelID`.
  3. Fallback `"default"`. Si absent → premier variant de la table.
  Aucun autre mécanisme de sélection n'est autorisé en v0.1.

- [CRITICAL][BLOCKS:high] Chaque fichier de prompt `.md` est chargé via `loadPrompt()` qui : (a) parse le frontmatter YAML, (b) applique les `RuntimeInjection[]` (`{ placeholder: string, resolver: () => string | Promise<string> }`). L'injection dynamique de contexte passe **uniquement** par les `RuntimeInjection` — pas d'interpolation template dans le source markdown.

---

## HIGH items

- [HIGH][BLOCKS:high] Structure de stockage des prompts (répertoire `packages/prompts-core/`) :

```
packages/prompts-core/
  src/
    types.ts          # PromptSource, VariantTable, RuntimeInjection, LoadedPrompt
    loader.ts         # loadPrompt(), loadPromptSync()
    variant-resolver.ts  # resolveVariant()
    planner-prompts.ts   # VariantTable bundlée pour planner
    executor-prompts.ts  # VariantTable bundlée pour executor
    critic-prompts.ts    # VariantTable bundlée pour critic
  prompts/
    planner/
      default.md      # variant par défaut (tous modèles non reconnus)
      claude.md       # variant Claude (Sonnet/Haiku/Fable)
    executor/
      default.md
      claude.md
    critic/
      default.md
      claude.md
```

  Variants v0.1 : `default` + `claude` pour chaque profil. Les variants GPT/Gemini/etc. sont ajoutés en Wave 4+ quand d'autres harnesses sont supportés.

- [HIGH][BLOCKS:high] Contrat du profil `planner` :

  | Champ | Valeur |
  |---|---|
  | Mission | Analyser le contexte, créer ou mettre à jour le plan `.hima/plans/<nom>.md`, structurer les tâches en checkboxes numérotées. **Ne jamais écrire de code.** |
  | Sorties autorisées | `.hima/plans/**/*.md`, `.hima/drafts/**/*.md` uniquement |
  | Outils autorisés | Lecture de fichiers (tous), écriture limitée aux paths ci-dessus |
  | Outils bloqués | Toute écriture hors `.hima/plans/` et `.hima/drafts/` — gate `planner-write-guard` bloquante |
  | Invocation | Commande `/plan`, ou par le main agent lors de la classification d'une tâche H/C nécessitant un plan explicite |
  | Behaviors applicables | Tous — dont verify obligatoire en fin de tâche, worker-model explicite, read-first |
  | RuntimeInjections | `{{boulder_context}}` → état actuel du boulder (work_id, progression, prochaine tâche) ; `{{project_disciplines}}` → contenu de `disciplines.md` |

- [HIGH][BLOCKS:high] Contrat du profil `executor` :

  | Champ | Valeur |
  |---|---|
  | Mission | Exécuter les tâches du plan actif une à une, cocher les checkboxes dans le `.md`, signaler DONE/PARTIAL/BLOCKED après chaque tâche. |
  | Sorties autorisées | Tous les fichiers du projet (dans les limites des gates M+/C et de la gate `decision-authority`) |
  | Outils autorisés | Lecture, écriture, édition, bash — soumis aux gates bloquantes selon criticality |
  | Outils bloqués | Aucun outil intrinsèquement bloqué au niveau profil ; les gates M+/C bloquent selon le contexte |
  | Invocation | Commande `/ulw`, ou magic word `ulw`/`ultrawork` en fin de message |
  | Behaviors applicables | Tous — dont verify obligatoire en fin de chaque tâche (pas seulement en fin de plan), worker-model explicite |
  | RuntimeInjections | `{{current_task}}` → label de la tâche courante depuis `readCurrentTopLevelTask()` ; `{{criticality}}` → niveau T/L/M/H/C classifié ; `{{boulder_context}}` → état boulder |

- [HIGH][BLOCKS:high] Contrat du profil `critic` :

  | Champ | Valeur |
  |---|---|
  | Mission | Vérifier chaque item de la `## Final Verification Wave` du plan, produire un verdict PASS/PARTIAL/FAIL par item, loguer dans le ledger. |
  | Sorties autorisées | Lecture de tous fichiers ; écriture limitée au plan `.md` (cocher les checkboxes F1…FN) et au ledger |
  | Outils autorisés | Lecture (tous), bash (exécution de tests uniquement), écriture limitée aux paths ci-dessus |
  | Outils bloqués | Toute écriture de code source — le critic ne modifie pas l'implémentation |
  | Invocation | Commande `/qa`, ou automatiquement par l'executor quand `getPlanProgress().isComplete === true` |
  | Behaviors applicables | Tous |
  | RuntimeInjections | `{{verification_items}}` → liste des items F1…FN non cochés ; `{{boulder_context}}` → état boulder |

- [HIGH][BLOCKS:low] Sécurité de chargement des prompts :

  - `resolvePromptFilePath()` rejette tout chemin qui s'échappe du `baseDir` (anti path-traversal). Si le chemin calculé n'est pas sous `baseDir` après `path.resolve()`, le chargement échoue avec une erreur explicite.
  - Les fichiers `.md` de prompt ne sont pas exécutés — uniquement lus comme texte. Les placeholders `{{...}}` sont remplacés par les resolvers `RuntimeInjection` uniquement (pas d'évaluation de code dans le template).

- [HIGH][BLOCKS:low] Invocation d'un profil par le main agent :

  1. Le main agent classifie la tâche (criticality T/L/M/H/C).
  2. Selon la criticality et le type de tâche, il sélectionne le profil approprié :
     - Tâche de planification (H/C, ou toute tâche sans plan existant) → `planner`
     - Tâche d'exécution (plan existant, tâche non cochée) → `executor`
     - Tâche de vérification (plan complet, section Final Verification Wave non vide) → `critic`
  3. Il appelle `resolveVariant({ modelID: currentModelID, agentName: profileName, variants: profileVariantTable })`.
  4. Il charge le prompt via `loadPrompt()` avec les RuntimeInjections du profil.
  5. Il injecte le prompt chargé dans le contexte (user message via `pre_llm_call` sur Hermes).

---

## MEDIUM items (convergence)

- [MEDIUM][BLOCKS:low] `MODEL_MATCHERS` v0.1 : un seul matcher `claude` couvrant tous les modèles Claude (`modelID.startsWith("claude-")`). Les matchers GPT/Gemini/etc. sont ajoutés quand les adapters correspondants sont activés.

- [MEDIUM][BLOCKS:low] `PLANNER_AGENT_NAMES` v0.1 : `new Set(["planner"])`. Extensible pour supporter des alias (`["planner", "plan", "architect"]`).

- [MEDIUM][BLOCKS:low] Température par profil (valeur proposée, à ajuster à l'usage) :
  - `planner` : 0.3 (réponses structurées, moins de créativité)
  - `executor` : 0.2 (exécution déterministe)
  - `critic` : 0.1 (verdicts reproductibles)

- [MEDIUM][BLOCKS:none] Les variants sont testés unitairement : `resolveVariant` est une fonction pure (`(params) => variantName`), testable sans runtime ni LLM.

- [MEDIUM][BLOCKS:none] Le frontmatter d'un fichier `.md` de prompt peut contenir des métadonnées optionnelles : `version`, `author`, `last_updated`. Pas utilisés en v0.1 mais réservés pour la traçabilité des prompts.

---

## LOW items (convergence tail)

- [LOW][BLOCKS:none] Les profils restants (8 profils Wave 4+) héritent du même mécanisme `VariantTable` + `resolveVariant`. Aucune modification d'architecture requise pour les ajouter.

- [LOW][BLOCKS:none] Un profil peut définir des variants nommés arbitrairement (`haiku`, `fast`, `deep`) que `resolveVariant` sélectionne par matcher modèle. Cela permet des prompts optimisés par modèle sans changer l'interface d'invocation.

- [LOW][BLOCKS:none] La commande `/profiles` (v0.2) pourra lister les profils disponibles et leurs variants chargés.

---

## Contradictions détectées

1. **Gate `planner-write-guard` vs périmètre SPEC-003** : la gate bloquante `planner-write-guard` est spécifiée ici comme implémentée dans `pre_tool_call`. Elle doit être également documentée dans SPEC-003 (Gates, verdicts et dégradation par runtime) comme gate de type `permission` avec `action: "block"`. Si SPEC-003 ne l'inclut pas, il y aura une contradiction entre les deux specs sur l'inventaire des gates. À synchroniser lors de la rédaction de SPEC-003.

2. **Invocation profil via `pre_llm_call` Hermes** : l'injection du prompt chargé se fait via `pre_llm_call` (user message uniquement — contrainte Hermes sans hook system-prompt). Cela signifie que le prompt de profil est visible dans l'historique de messages comme un message utilisateur, pas comme un system prompt. Ce comportement est différent de ce qu'un utilisateur attendrait intuitivement. Documenté ici comme contrainte Hermes (PROPOSITION.md §4), pas une erreur de design — mais à confirmer que c'est acceptable pour le fondateur.

3. **Temperatures proposées non validées** : les valeurs 0.3 / 0.2 / 0.1 sont des propositions basées sur le pattern OMO. OMO utilise des températures différentes par agent mais les valeurs exactes ne sont pas documentées dans lane-omo.md. Ces valeurs sont à valider empiriquement à l'usage.

---

## Questions ouvertes pour le fondateur

1. Le prompt de profil injecté via `pre_llm_call` apparaît comme un message utilisateur (contrainte Hermes). Est-ce acceptable pour v0.1, ou faut-il trouver un contournement ?
2. Les températures 0.3/0.2/0.1 par profil sont-elles un bon point de départ, ou le fondateur a-t-il des préférences ?
3. La gate `planner-write-guard` doit-elle bloquer aussi les outils bash qui pourraient écrire du code (ex: `git apply`, `patch`) ? Proposition : oui, bloquer tout outil dont l'effet est une écriture de fichier non-`.md`.
