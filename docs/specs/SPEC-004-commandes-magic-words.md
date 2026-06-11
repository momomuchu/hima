# SPEC-004 — Commandes et Magic Words

status: draft
date: 2026-06-11
version: 0.1
source: PROPOSITION.md §7, §12 ; deep-interview-hima-positioning.md R3-2 ; lane-omo.md §5 ; ultragoal/brief.md critère binaire n°5
claim-bearing: true
cross-ref: SPEC-003 (profils activés par les commandes), SPEC-005 (boulder-state modifié par /plan et /ulw), SPEC-007 (localisation détecteur dans adapter Hermes)

---

## Contexte et décisions fondateur actées

Le fondateur a confirmé (R3-2, 2026-06-11) les points suivants — ne pas re-litiger :

- Surface principale d'interaction = **`/commandes` uniquement**.
- Magic words autorisés mais **ultra-spécifiques** : abréviations que personne n'écrit naturellement.
- Match strict mot-entier **ET en fin de message uniquement** (`\b(mot)\s*$`).
- Décision de design issue du faux-positif du 2026-06-11 : « ulw » cité en milieu de phrase a déclenché un mode — la contrainte fin-de-message corrige structurellement ce cas.
- Un magic word active **exactement un mode**.
- Strip des blocs de code **avant** le matching (ni bloc fencé ni inline code ne peuvent déclencher un mode).

---

## CRITICAL items

- [CRITICAL][BLOCKS:critical] La surface d'interaction principale est `/commandes` uniquement. Aucun mode ne peut être activé par une phrase en langage naturel sauf si elle se termine exactement par un magic word reconnu.

- [CRITICAL][BLOCKS:critical] Un magic word ne déclenche **aucun mode** s'il apparaît au milieu d'un message. Critère binaire n°5 de l'ultragoal : le mot cité en milieu de phrase → AUCUN déclenchement. Implémentation imposée : pattern `\b(mot)\s*$` (fin de chaîne après strip des retours à la ligne finaux).

- [CRITICAL][BLOCKS:critical] Avant toute tentative de matching, le texte du message est débarrassé de tous les blocs de code : blocs fencés (triple backtick ou triple tilde) ET inline code (backtick simple). Le matching s'exerce sur le texte résiduel uniquement.

- [CRITICAL][BLOCKS:high] Chaque magic word active **exactement un mode**. Aucune combinaison multi-mode depuis un seul magic word n'est autorisée en v0.1.

- [CRITICAL][BLOCKS:high] Les commandes `/` sont les seuls points d'entrée d'activation de mode qui ne requièrent pas la position fin-de-message. Une commande `/plan` fonctionne où qu'elle se trouve dans un message, pourvu qu'elle soit reconnue comme une commande slash (token débutant par `/` en début de ligne ou de message).

---

## HIGH items

- [HIGH][BLOCKS:high] Le détecteur de magic words vit dans le hook **`pre_llm_call`** (injection de contexte) et/ou **`pre_gateway_dispatch`** (réécriture de messages) de l'adapter Hermes — cf. PROPOSITION.md §4 et §7. Il ne vit pas dans la couche applicative amont.

- [HIGH][BLOCKS:high] Le jeu de commandes v0.1 (proposé, à valider fondateur) :

  | Commande | Description courte | Effet principal | État modifié |
  |---|---|---|---|
  | `/plan` | Lance le planificateur + crée ou reprend un boulder | Charge le profil `planner`, crée `.hima/boulder.json` si absent, écrit le plan `.hima/plans/<name>.md` | `boulder.json` : work créé ou réactivé |
  | `/ulw` | Lance l'exécution parallèle (ultrawork) | Charge le profil `executor`, lit la prochaine checkbox non cochée du plan actif, lance l'exécution | `boulder.json` : `active_work_id` mis à jour, tâche marquée `running` |
  | `/qa` | Lance la vérification/QA | Charge le profil `critic`, exécute les étapes de vérification définies dans la section `## Final Verification Wave` du plan | Ledger : entrée `verify` loguée |
  | `/status` | Affiche l'état courant | Lit `boulder.json`, affiche le work actif, la progression (N/M tâches cochées), le dernier événement ledger | Lecture seule |

- [HIGH][BLOCKS:high] Le jeu de magic words v0.1 (proposé, à valider fondateur) :

  | Magic word | Alias | Pattern regex | Mode activé | Notes |
  |---|---|---|---|---|
  | `ulw` | `ultrawork` | `\b(ulw\|ultrawork)\s*$` | Exécution parallèle (équivalent `/ulw`) | Abréviation choisie pour son caractère non-naturel |

- [HIGH][BLOCKS:low] Chaque commande `/` a un contrat d'interface complet :

  ### Contrat `/plan`
  - **Entrée** : message contenant `/plan` (optionnellement suivi d'un nom de plan). Contexte courant du projet disponible.
  - **Préconditions** : profil `planner` chargé et disponible.
  - **Effet** : le profil `planner` est injecté dans le contexte. Si aucun boulder actif, un nouveau work est créé dans `.hima/boulder.json` avec `status: active`. Le planificateur produit un fichier `.hima/plans/<nom>.md` avec sections `## TODOs` (checkboxes numérotées `- [ ] N. Titre`) et `## Final Verification Wave` (checkboxes `- [ ] F1. Titre`).
  - **État modifié** : `boulder.json` → champ `active_work_id` renseigné, work créé avec `status: active`, `session_ids` initialisé.
  - **Sortie attendue** : confirmation du plan créé + affichage de la première tâche non cochée.
  - **Erreurs** : si le profil `planner` est absent → erreur explicite, pas de mode silencieux.

  ### Contrat `/ulw`
  - **Entrée** : message contenant `/ulw`. Boulder actif requis.
  - **Préconditions** : `boulder.json` présent avec `active_work_id` et plan `.md` associé lisible.
  - **Effet** : profil `executor` injecté. Lit `readCurrentTopLevelTask()` → première checkbox non cochée de niveau 0. Lance l'exécution. Après chaque tâche complétée, coche la checkbox dans le `.md`, relance sur la suivante. S'arrête quand `getPlanProgress().isComplete === true` ou sur erreur.
  - **État modifié** : `boulder.json` → `task_sessions` mis à jour par tâche, timers démarrés/arrêtés. Plan `.md` : checkboxes cochées au fur et à mesure.
  - **Sortie attendue** : rapport de progression à chaque tâche complétée. État final DONE/PARTIAL/BLOCKED.
  - **Erreurs** : si aucun boulder actif → proposition d'exécuter `/plan` d'abord.

  ### Contrat `/qa`
  - **Entrée** : message contenant `/qa`. Plan actif avec section `## Final Verification Wave` requis.
  - **Préconditions** : `boulder.json` présent, section `Final Verification Wave` non vide.
  - **Effet** : profil `critic` injecté. Exécute chaque item de `Final Verification Wave` non coché. Produit un rapport de vérification.
  - **État modifié** : Ledger : entrée `verify` loguée avec hash de contenu. Plan `.md` : checkboxes F1…FN cochées si vérification réussie.
  - **Sortie attendue** : rapport vérification item par item. Verdict PASS/PARTIAL/FAIL.
  - **Erreurs** : si section `Final Verification Wave` absente dans le plan → avertissement, vérification partielle possible.

  ### Contrat `/status`
  - **Entrée** : message contenant `/status`. Pas de prérequis.
  - **Préconditions** : aucune (dégradation gracieuse si `.hima/boulder.json` absent).
  - **Effet** : lecture seule de `boulder.json` et du plan actif.
  - **État modifié** : aucun.
  - **Sortie attendue** : work actif, progression N/M, dernière tâche complétée, dernier événement ledger, date de mise à jour.
  - **Erreurs** : si aucun boulder → "Aucun plan actif. Utilise `/plan` pour démarrer."

- [HIGH][BLOCKS:low] Le message injecté par un magic word est une **fonction paramétrée** `(agentName?: string, modelID?: string) => string` — pas une chaîne statique. Cela permet d'adapter le prompt injecté au modèle actif (variantes par modèle), aligné sur le mécanisme `VariantTable` de `prompts-core`.

---

## MEDIUM items (convergence)

- [MEDIUM][BLOCKS:low] Les magic words sont **désactivables individuellement** par configuration (fichier `hima.config.json` ou champ dans `.hima/config.json`). Clé proposée : `keyword_detectors: { ulw: false }`.

- [MEDIUM][BLOCKS:low] Si plusieurs magic words sont définis dans le futur, chacun doit avoir un type unique. Aucun alias ne peut être partagé entre deux modes différents.

- [MEDIUM][BLOCKS:none] Les commandes `/` sont enregistrées via un handler `command.execute.before` — le hook interceptionne le message avant dispatch LLM, parse le token `/commande`, appelle le handler correspondant.

- [MEDIUM][BLOCKS:none] Les commandes non reconnues (`/foo` inexistant) retournent un message d'aide listant les commandes disponibles. Pas d'erreur silencieuse.

---

## LOW items (convergence tail)

- [LOW][BLOCKS:none] Les magic words et commandes sont documentés dans un fichier `.hima/commands.md` auto-généré à l'initialisation du projet (`project-init`).

- [LOW][BLOCKS:none] La liste des `KEYWORD_DETECTORS` est exportée comme type TypeScript depuis `packages/keyword-core/src/types.ts` pour permettre l'extension par l'utilisateur.

---

## Implémentation : localisation dans le runtime

### Localisation dans Hermes (adapter cible v0.1)

Le détecteur vit dans le plugin hima pour Hermes, accroché sur deux hooks :

1. **`pre_llm_call`** — premier point d'interception du message utilisateur avant envoi au LLM. Le détecteur lit le contenu du message, strip les blocs de code, teste les patterns `\b(mot)\s*$`. Si match : injecte le bloc prompt de mode dans le message (user message uniquement — contrainte Hermes : pas de hook system-prompt).

2. **`pre_gateway_dispatch`** — point alternatif si `pre_llm_call` est insuffisant pour réécrire le dispatch. Même logique de détection ; utilisé si le mode requiert une réécriture ou un skip de la gateway.

La localisation est cohérente avec PROPOSITION.md §4 (description des 17 hooks plugin Hermes) et §7 (magic-words : "le keyword-detector hima devra vivre dans le plugin `pre_llm_call`/`pre_gateway_dispatch`").

### Algorithme de matching (pseudo-code)

```typescript
function detectMagicWord(rawMessage: string): KeywordMatch | null {
  // Étape 1 : strip blocs de code
  const stripped = rawMessage
    .replace(/```[\s\S]*?```/g, '')   // blocs fencés
    .replace(/~~~[\s\S]*?~~~/g, '')   // blocs tilde
    .replace(/`[^`\n]+`/g, '')        // inline code
    .trimEnd();                        // normalise la fin

  // Étape 2 : tester chaque détecteur
  for (const detector of KEYWORD_DETECTORS) {
    if (detector.pattern.test(stripped)) {
      return { type: detector.type, message: detector.message };
    }
  }
  return null;
}

// Exemple de détecteur
const KEYWORD_DETECTORS: KeywordDetector[] = [
  {
    type: 'ultrawork',
    pattern: /\b(ulw|ultrawork)\s*$/i,
    message: (agentName?: string, modelID?: string) => getUltraworkMessage(agentName, modelID),
  },
];
```

---

## Contradictions détectées

Aucune contradiction inter-spec détectée pour ce fichier. Points d'attention à valider :

1. **Set de commandes v0.1 non confirmé** : PROPOSITION.md §7 propose `/plan`, `/ulw`, `/qa`, `/status` mais indique explicitement « à valider ». Cette spec les documente comme proposition ; la validation fondateur est requise avant implémentation.
2. **Un seul magic word en v0.1** : `ulw`/`ultrawork`. PROPOSITION.md §7 mentionne un « set initial proposé » sans liste complète. Cette spec retient `ulw` comme seul magic word ; tout ajout doit passer par une mise à jour de cette spec.
3. **Interaction commande + magic word** : si un message contient `/ulw` (commande) ET se termine par `ulw` (magic word), le comportement n'est pas défini. Décision proposée : les commandes `/` ont priorité sur les magic words. À confirmer fondateur.

---

## Questions ouvertes pour le fondateur

1. Le set `/plan`, `/ulw`, `/qa`, `/status` est-il validé pour v0.1 ?
2. Y a-t-il d'autres magic words à inclure en v0.1 au-delà de `ulw`/`ultrawork` ?
3. En cas de conflit commande + magic word dans le même message, la commande a-t-elle priorité ? (proposition : oui)
4. Les commandes doivent-elles être désactivables individuellement comme les magic words ?

---

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: |
    Le magic word `ulw` (ou tout autre magic word de la liste fermée v0.1) se déclenche
    alors qu'il apparaît au milieu d'un message (non en fin de message) — alors la
    contrainte regex \b(mot)\s*$  est fausse ou mal implémentée, et le critère binaire
    n°5 de l'ultragoal n'est pas satisfait. La spec doit être révisée pour renforcer
    le matching ou supprimer les magic words au profit des commandes / uniquement.
  checkpoint-date: 2026-07-15 (premier test d'intégration détecteur dans adapter Hermes)
  evidence-anchor: |
    Test d'acceptation obligatoire : message contenant `ulw` en milieu de phrase →
    detectMagicWord() retourne null. Test unitaire dans packages/keyword-core/src/.
    Localisation vérifiée dans hook pre_llm_call de l'adapter Hermes (PROPOSITION.md §4).
  on-fail: |
    Supprimer les magic words de la surface v0.1 et documenter la décision dans
    SPEC-004 §Contradictions ; conserver uniquement les commandes /plan /ulw /qa /status
    comme points d'entrée. Ouvrir une question fondateur avant tout re-ajout.
```
