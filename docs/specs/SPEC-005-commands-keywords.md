# SPEC-005 — Surface commandes + magic-words

status: draft
date: 2026-06-11
version: 0.1
source: PROPOSITION.md §7, §12 ; deep-interview-hima-positioning.md R3-2 ; lane-omo.md §5 ; ultragoal/brief.md critère binaire n°5
claim-bearing: true

Falsifies-If: si après Wave 3 un magic word se déclenche quand le mot est cité en milieu de phrase, ou si une commande `/` produit un effet différent de son contrat ci-dessous → cette spec est incorrecte ; corriger le détecteur et les handlers avant toute itération.

---

## Contexte et décisions fondateur actées (ne pas re-litiger)

- Surface principale d'interaction = **`/commandes` uniquement** (R3-2).
- Magic words autorisés mais **ultra-spécifiques** : abréviations que personne n'écrit naturellement.
- Match strict **mot entier ET fin de message uniquement** — contrainte issue du faux-positif vécu le 2026-06-11 : le keyword `ulw` cité en milieu de phrase a déclenché ultrawork (PROPOSITION.md §12). `\b` seul ne suffit pas ; il faut `\s*$`.
- Strip des blocs de code **avant** matching — ni bloc fencé ni inline code ne peuvent déclencher un mode.
- Un magic word active **exactement un mode**.
- Le détecteur vit dans le plugin Hermes (`pre_llm_call` / `pre_gateway_dispatch`) — pas interceptable côté CLI (PROPOSITION.md §4).

---

## CRITICAL items

- [CRITICAL][BLOCKS:critical] Un magic word ne déclenche **aucun mode** s'il apparaît en milieu de message. Test d'acceptation obligatoire (critère binaire n°5 ultragoal) :

  ```
  Input  : "je vais lancer ulw plus tard pour tester"
  Attendu : aucun déclenchement, aucune injection de prompt de mode
  ```

  Ce test DOIT passer avant tout merge de `keyword-core`.

- [CRITICAL][BLOCKS:critical] Pattern de matching obligatoire pour tout magic word : `/\b(<mot>|<alias>)\s*$/i` — le `\s*$` ancre le match en fin de chaîne après normalisation (trim final des retours à la ligne). Le `\b` seul (`/\b(ulw)\b/i`) est **insuffisant** et reproduit le faux-positif documenté.

- [CRITICAL][BLOCKS:critical] Avant tout test de magic word, le texte du message est débarrassé de :
  1. Blocs fencés : `/```[\s\S]*?```/g` et `/~~~[\s\S]*?~~~/g`
  2. Inline code : `` /`[^`\n]+`/g ``
  3. Suivi d'un `.trimEnd()` pour normaliser la fin de chaîne.
  Le matching s'exerce sur le texte résiduel uniquement.

- [CRITICAL][BLOCKS:critical] La surface d'interaction principale est `/commandes`. Aucun mode n'est activé par une phrase en langage naturel sauf si elle se termine exactement par un magic word reconnu (après strip).

- [CRITICAL][BLOCKS:high] Les commandes `/` sont interceptées **avant** les magic words. Si un message contient à la fois `/ulw` (commande slash) et se termine par `ulw` (magic word), la commande slash a priorité et le magic word n'est pas évalué.

---

## HIGH items

### Commandes v0.1

- [HIGH][BLOCKS:high] Jeu de commandes v0.1 (proposé — validation fondateur requise avant implémentation) :

  | Commande | Syntaxe | Mode activé | Préconditions |
  |---|---|---|---|
  | `/plan` | `/plan [nom-du-plan]` | Profil `planner` | Aucune (crée un boulder si absent) |
  | `/ulw` | `/ulw` | Profil `executor` | Boulder actif avec `status: active` |
  | `/qa` | `/qa` | Profil `critic` | Plan actif avec section `## Final Verification Wave` |
  | `/status` | `/status` | Lecture seule | Aucune (dégradation gracieuse si pas de boulder) |

#### Contrat `/plan`

- **Syntaxe** : `/plan` ou `/plan <nom>` en début de ligne ou de message.
- **Préconditions** : profil `planner` disponible dans `packages/prompts-core/`.
- **Effet** :
  1. Charge le profil `planner` via `resolveVariant` + `loadPrompt`.
  2. Injecte le prompt chargé dans le contexte via `pre_llm_call`.
  3. Si aucun boulder actif : crée `.hima/boulder.json` avec un nouveau work `status: active`.
  4. Le planificateur produit `.hima/plans/<nom>.md` avec sections `## TODOs` + `## Final Verification Wave`.
- **État modifié** : `boulder.json` → `active_work_id` renseigné, work créé.
- **Sortie** : confirmation du plan créé + première tâche non cochée affichée.
- **Erreur** : profil `planner` absent → erreur explicite, pas de mode silencieux.

#### Contrat `/ulw`

- **Syntaxe** : `/ulw` (aucun argument).
- **Préconditions** : `boulder.json` présent avec `active_work_id` et plan `.md` lisible.
- **Effet** :
  1. Charge le profil `executor`.
  2. Lit `readCurrentTopLevelTask()` → première checkbox non cochée de niveau 0.
  3. Exécute la tâche, coche la checkbox dans le `.md`, relance sur la suivante.
  4. S'arrête quand `getPlanProgress().isComplete === true` ou sur erreur bloquante.
- **État modifié** : `boulder.json` → `task_sessions` mis à jour, timers. Plan `.md` : checkboxes cochées au fur et à mesure.
- **Sortie** : rapport de progression par tâche. État final DONE/PARTIAL/BLOCKED.
- **Erreur** : aucun boulder actif → "Aucun plan actif. Lance `/plan` d'abord."

#### Contrat `/qa`

- **Syntaxe** : `/qa` (aucun argument).
- **Préconditions** : plan actif avec section `## Final Verification Wave` non vide.
- **Effet** :
  1. Charge le profil `critic`.
  2. Exécute chaque item `- [ ] F1…FN` non coché.
  3. Produit un verdict PASS/PARTIAL/FAIL par item.
  4. Logue dans le ledger hash-chain.
- **État modifié** : plan `.md` → checkboxes F1…FN cochées si PASS. Ledger → entrée `verify`.
- **Sortie** : rapport item par item. Verdict global PASS/PARTIAL/FAIL.
- **Erreur** : section `Final Verification Wave` absente → avertissement, vérification partielle possible.

#### Contrat `/status`

- **Syntaxe** : `/status` (aucun argument).
- **Préconditions** : aucune.
- **Effet** : lecture seule de `boulder.json` et du plan actif.
- **État modifié** : aucun.
- **Sortie** : work actif, progression N/M, dernière tâche complétée, dernier événement ledger, date mise à jour.
- **Erreur** : aucun boulder → "Aucun plan actif. Lance `/plan` pour démarrer."

### Magic words v0.1

- [HIGH][BLOCKS:high] Liste fermée des magic words v0.1 :

  | Magic word | Alias | Pattern | Mode activé |
  |---|---|---|---|
  | `ulw` | `ultrawork` | `/\b(ulw\|ultrawork)\s*$/i` | Exécution parallèle (équivalent `/ulw`) |

  Tout ajout de magic word requiert une mise à jour de cette spec + un nouveau test d'acceptation "milieu de phrase".

- [HIGH][BLOCKS:high] Le message injecté par un magic word est une **fonction** `(agentName?: string, modelID?: string) => string` — pas une chaîne statique. Le prompt injecté est adapté au modèle actif via la `VariantTable` de `prompts-core` (même mécanisme que les profils).

- [HIGH][BLOCKS:high] Localisation du détecteur sur Hermes :

  1. **`pre_llm_call`** — interception du message utilisateur avant envoi au LLM. Le détecteur strip le texte, teste les patterns `\s*$`. Si match : injecte le bloc prompt de mode dans le message (user message uniquement — Hermes n'a pas de hook system-prompt, PROPOSITION.md §4).
  2. **`pre_gateway_dispatch`** — point alternatif si le mode requiert une réécriture ou un skip de la gateway.

  Le détecteur ne vit **pas** côté CLI (magic-words non interceptables côté CLI sur Hermes, PROPOSITION.md §4).

---

## MEDIUM items (convergence)

- [MEDIUM][BLOCKS:low] Les magic words sont désactivables individuellement par configuration : clé `keyword_detectors: { ulw: false }` dans `.hima/config.json`.

- [MEDIUM][BLOCKS:low] Les commandes non reconnues (`/foo` inexistant) retournent un message d'aide listant les commandes disponibles. Pas d'erreur silencieuse.

- [MEDIUM][BLOCKS:none] Les commandes `/` sont enregistrées via un handler `command.execute.before` — parse le token `/commande` en début de ligne ou de message, appelle le handler correspondant.

- [MEDIUM][BLOCKS:none] Structure du tableau `KEYWORD_DETECTORS` (type TypeScript exporté depuis `packages/keyword-core/src/types.ts`) :

  ```typescript
  interface KeywordDetector {
    type: string;
    pattern: RegExp;  // DOIT être ancré \s*$ — jamais \b seul
    message: string | ((agentName?: string, modelID?: string) => string);
  }

  const KEYWORD_DETECTORS: KeywordDetector[] = [
    {
      type: 'ultrawork',
      pattern: /\b(ulw|ultrawork)\s*$/i,
      message: (agentName, modelID) => getUltraworkMessage(agentName, modelID),
    },
  ];
  ```

---

## LOW items (convergence tail)

- [LOW][BLOCKS:none] Les commandes et magic words sont documentés dans `.hima/commands.md` auto-généré par `project-init`.

- [LOW][BLOCKS:none] La commande `/commands` (v0.2) listera les commandes disponibles et leur état (activé/désactivé).

---

## Test d'acceptation obligatoire — magic word milieu de phrase

Ce test est non-négociable. Il DOIT passer avant tout merge de `keyword-core` (critère binaire n°5 ultragoal).

```
# Cas 1 — déclenchement ATTENDU (fin de message)
Input  : "lance l'exécution ulw"
Stripped: "lance l'exécution ulw"
Pattern: /\b(ulw|ultrawork)\s*$/i → MATCH
Résultat: mode ultrawork injecté ✓

# Cas 2 — PAS de déclenchement (milieu de phrase)
Input  : "je vais lancer ulw plus tard pour tester"
Stripped: "je vais lancer ulw plus tard pour tester"
Pattern: /\b(ulw|ultrawork)\s*$/i → PAS DE MATCH
Résultat: aucun mode injecté ✓

# Cas 3 — PAS de déclenchement (dans un bloc de code)
Input  : "voici la commande : \`ulw\`"
Stripped (après strip inline code): "voici la commande : "
Pattern: /\b(ulw|ultrawork)\s*$/i → PAS DE MATCH
Résultat: aucun mode injecté ✓

# Cas 4 — PAS de déclenchement (dans un bloc fencé)
Input  : "exemple :\n\`\`\`\nulw\n\`\`\`"
Stripped (après strip blocs fencés): "exemple :\n"
Pattern: /\b(ulw|ultrawork)\s*$/i → PAS DE MATCH
Résultat: aucun mode injecté ✓

# Cas 5 — déclenchement avec whitespace final
Input  : "go ulw   "
Stripped + trimEnd: "go ulw"
Pattern: /\b(ulw|ultrawork)\s*$/i → MATCH
Résultat: mode ultrawork injecté ✓
```

---

## Contradictions détectées

1. **Numérotation SPEC-004 en doublon** : une version antérieure de cette spec a été écrite sous le nom `SPEC-004-commandes-magic-words.md` (produit en début de session). Ce fichier `SPEC-005-commands-keywords.md` est la version canonique pour la numérotation de la wave 1.5. Le fichier `SPEC-004-commandes-magic-words.md` doit être archivé ou supprimé pour éviter la confusion. À décider avec le team-lead.

2. **Commandes v0.1 non encore validées fondateur** : `/plan`, `/ulw`, `/qa`, `/status` sont documentés ici comme contrats complets mais restent des propositions (PROPOSITION.md §7 : « à valider »). Aucune implémentation avant confirmation.

3. **Interaction commande + magic word** : si un message contient `/ulw` ET se termine par `ulw`, la priorité commande-slash est posée ici mais non confirmée fondateur. Risque d'incohérence avec SPEC-004-profiles.md si la règle de priorité change.

---

## Questions ouvertes pour le fondateur

1. Le set `/plan`, `/ulw`, `/qa`, `/status` est-il validé pour v0.1 ?
2. Y a-t-il d'autres magic words à inclure en v0.1 au-delà de `ulw`/`ultrawork` ?
3. La règle "commandes `/` ont priorité sur magic words" est-elle confirmée ?
4. Les commandes doivent-elles être désactivables individuellement comme les magic words ?
