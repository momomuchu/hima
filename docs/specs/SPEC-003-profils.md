# SPEC-003 — Profils v0.1

**statut:** DRAFT — Wave 1.5 spécification  
**date:** 2026-06-11  
**claim-bearing:** true  
**source de vérité code:** `packages/behavior-core/src/behavior-override.ts` (CATALOG_RISK_FLOORS), lane-omo.md §1  
**auteur:** spec-protocole (lane Wave 15)  
**précédents:** PROPOSITION.md §2, §12 (blocage légal SUL-1.0) ; deep-interview-hima-positioning.md Round 1–3 ; lane-omo.md §1  
**cross-ref:** SPEC-001 (types canoniques), SPEC-002 (criticality → étapes), SPEC-004 (commandes activant les profils), SPEC-007 (adapter Hermes — propagation profil)

---

## Résumé

hima v0.1 démarre avec trois profils fonctionnels : `planner`, `executor`, `critic`. Chaque profil = un dossier `prompts/<profil>/` avec variants par modèle. Le mécanisme `resolveVariant` est réimplémenté (non copié — SUL-1.0 interdit la copie de code OMO). Les behaviors s'appliquent à tous les profils ; un profil ne peut pas désactiver un behavior dont le floor de criticité est atteint.

---

## CRITICAL items

### [CRITICAL][BLOCKS:critical] CR-001 — Blocage légal : réimplémentation obligatoire, pas copie

**Décision fondateur actée (PROPOSITION.md §12) :**

> OMO est sous Sustainable Use License (SUL-1.0), PAS open source MIT. Copier du code OMO est exclu. Autorisé : réimplémenter les patterns/idées (non protégeables), même architecture, mêmes mécanismes — écrits par nous.

Tout le code de `packages/prompts-core/` est écrit from scratch. Les noms de fonctions et d'interfaces peuvent être identiques (non protégeables), le code source doit être original.

---

### [CRITICAL][BLOCKS:critical] CR-002 — Structure d'un profil

Un profil hima = un dossier sous `packages/prompts-core/prompts/<profil>/` contenant des fichiers `.md` nommés par variant. Structure minimale v0.1 :

```
packages/prompts-core/
  src/
    types.ts          # LoadedPrompt, VariantTable, RuntimeInjection, PromptSource
    loader.ts         # loadPrompt(agentName, modelID, injections?) → LoadedPrompt
    variant-resolver.ts  # resolveVariant(agentName, modelID, variants) → variantName
  prompts/
    planner/
      default.md      # variant par défaut (obligatoire)
      claude-fable-5.md   # variant modèle (optionnel)
    executor/
      default.md
      claude-fable-5.md
    critic/
      default.md
      claude-fable-5.md
```

**Types requis (à écrire, pas à copier) :**

```typescript
// Deux sources possibles pour un prompt
type PromptSource =
  | { kind: "bundled"; content: string; filePath: string }
  | { kind: "filesystem"; baseDir: string };

// Une table de variants : variantName → source
type VariantTable = Record<string, PromptSource>;

// Injection dynamique : placeholder dans le .md → resolver appelé au chargement
interface RuntimeInjection {
  placeholder: string;
  resolver: () => string | Promise<string>;
}

// Résultat du chargement
interface LoadedPrompt {
  agentName: string;
  variantName: string;
  body: string;           // contenu après injections
  frontmatter: Record<string, unknown>;
  source: PromptSource;
}
```

**Garde anti path-traversal :** `resolvePromptFilePath(baseDir, variantName)` doit rejeter tout chemin qui s'échappe du `baseDir` (vérification `realpath` + containment).

---

### [CRITICAL][BLOCKS:critical] CR-003 — Mécanisme resolveVariant (réimplémenté)

`resolveVariant` sélectionne le variant à charger pour un couple `(agentName, modelID)`. Logique v0.1 :

1. Si `agentName === "planner"` ET variant `"planner"` présent dans la table → retourner `"planner"`.
2. Sinon, chercher le premier variant dont le nom correspond au modèle actif (matchers à définir dans `packages/model-core/` : `isClaudeFable5Model`, `isClaudeOpus4Model`, etc.).
3. Fallback : `"default"`.
4. Si `"default"` absent : premier variant de la table (déterministe).

**Interface :**

```typescript
function resolveVariant(
  agentName: string,
  modelID: string,
  variants: VariantTable,
): string;  // retourne le nom du variant sélectionné
```

**Contrainte :** la fonction est pure (pas de I/O), testable unitairement avec `given/when/then`.

---

### [CRITICAL][BLOCKS:critical] CR-004 — Contrat du profil `planner`

**Rôle :** planifie. INTERDIT d'écrire du code.

**Invariants du contrat :**

- Le fichier `prompts/planner/default.md` DOIT commencer par une déclaration explicite d'interdiction d'écriture de code (équivalent fonctionnel du `<system-reminder>` prometheus d'OMO : "YOU ARE A PLANNER. YOU DO NOT WRITE CODE").
- Les outputs autorisés : `.hima/plans/*.md`, `.hima/drafts/*.md` uniquement.
- Tous les autres Write/Edit sont interdits.

**Enforcement par gate (pas uniquement par prompt) :**

```
GateType: pre_tool
Événement: Write ou Edit sur tout fichier qui ne correspond pas à .hima/plans/**  ou .hima/drafts/**
Profil actif: planner
Décision: block
ViolationType: FORBIDDEN_WRITE_ZONE
Reason: "planner profile: write outside .hima/plans/ or .hima/drafts/ is forbidden"
```

La gate `pre_tool` vérifie le profil actif depuis le run-set et applique cette restriction. Le prompt renforce l'interdiction mais la gate est l'enforcement réel (ADR-0017 : advisory prompt ≈ 0% adherence).

---

### [CRITICAL][BLOCKS:critical] CR-005 — Contrat du profil `executor`

**Rôle :** implémente sous contrat de lane.

**Invariants du contrat :**

- Reçoit un plan explicite (depuis `.hima/plans/*.md`) avant de démarrer.
- Peut écrire du code dans les fichiers définis dans son contrat de lane.
- Ne peut pas modifier des fichiers hors de sa `writeBoundary` (définie dans le contrat de lane du run-set).
- Ne peut pas spawner de sous-agents sans lane-contract (gate `subagent_start` → `SUBAGENT_CONTRACT_INCOMPLETE`).

**Enforcement :**

```
GateType: pre_tool
Événement: Write ou Edit hors writeBoundary du lane courant
Profil actif: executor
Décision: block
ViolationType: FORBIDDEN_WRITE_ZONE
```

```
GateType: subagent_start
Profil actif: executor
Condition: absence de lane-contract dans le run-set pour le sous-agent cible
Décision: block
ViolationType: SUBAGENT_CONTRACT_INCOMPLETE
```

---

### [CRITICAL][BLOCKS:critical] CR-006 — Contrat du profil `critic`

**Rôle :** review. Lecture seule.

**Invariants du contrat :**

- Aucun Write, Edit, Bash destructif autorisé.
- Outils autorisés : Read, Grep, Glob, Bash (lecture seule : git diff, git log, cat).
- Retourne un verdict structuré (approbation, objections, risques résiduels).

**Enforcement :**

```
GateType: pre_tool
Événement: Write, Edit, ou Bash avec commandes destructives
Profil actif: critic
Décision: block
ViolationType: FORBIDDEN_WRITE_ZONE
Reason: "critic profile: write and destructive commands are forbidden"
```

---

## HIGH items

### [HIGH][BLOCKS:high] H-001 — Interaction profils × behaviors

**Règle centrale :**

Un behavior s'applique à **tous les profils** sans exception. Un profil ne peut PAS désactiver un behavior dont la criticité est ≥ à son `CATALOG_RISK_FLOOR`.

**Référence code :** `packages/behavior-core/src/behavior-override.ts` — `CATALOG_RISK_FLOORS` :

```typescript
const CATALOG_RISK_FLOORS: Readonly<Record<string, RiskClass>> = {
  "BEH-010": "T",   // read-before-write : s'applique à tous profils, tous niveaux
  "BEH-011": "T",   // suppression-guard : idem
  "BEH-012": "M",   // chesterton-fence : s'applique à M+
  "BEH-013": "T",   // claim-source
  "BEH-014": "T",   // anti-sycophancy
  "BEH-020": "M",   // critic-gate
  "BEH-021": "M",   // dimension-retry
  "BEH-022": "M",   // loop-detector
  "BEH-023": "H",   // completion-status : bloquant à H+
  "BEH-030": "M",   // subagent-contract
  "BEH-031": "H",   // watcher
  "BEH-032": "T",   // kill-switch
};
```

**Règle d'override :** `resolveOverride(behaviorId, overrides, effectiveRiskClass)` dans `behavior-override.ts` :

- Un override `mode: "disabled"` est **refusé** (`forbiddenReason: "OVERRIDE_FORBIDDEN_FOR_RISK_CLASS"`) si `effectiveRiskClass >= catalogFloor`.
- Un override ne peut pas abaisser le `riskFloorOverride` sous le `catalogFloor` (`forbiddenReason: "OVERRIDE_FORBIDDEN_FLOOR_REDUCTION"`).
- Conséquence pour les profils : même le profil `critic` (lecture seule) est soumis à BEH-010 (read-before-write) à niveau T, et à BEH-023 à niveau H+.

**Exemple concret :**

```
Profil: planner
RiskClass: H
BEH-031 (watcher, floor H) → CATALOG_RISK_FLOOR "H" ≤ "H" → override "disabled" REFUSÉ
→ Le planner ne peut pas désactiver l'obligation de watcher en H.
```

---

### [HIGH][BLOCKS:high] H-002 — Sélection du profil actif

**Mécanisme de sélection :** QUESTION OUVERTE (§QO-001 ci-dessous).

Les sources disponibles n'indiquent pas de décision fondateur sur la méthode de sélection du profil actif dans hima v0.1. Les options connues :

**Option A — Sélection par commande :** `/plan` active `planner`, `/ulw` active `executor` (et en fin de tâche `critic`). Simple, cohérent avec « /commandes uniquement » (PROPOSITION.md §7).

**Option B — Sélection par `HERMES_HOME` :** profil Hermes global par invocation (`HERMES_HOME=~/.hermes/profiles/<name>`). Contrainte connue : profils Hermes sont sticky, pas de switch mid-session (PROPOSITION.md §4).

**Option C — Sélection automatique par le main agent :** le main agent inspecte le contexte (plan présent ? lane active ?) et sélectionne le profil sans intervention explicite.

Ces options ne sont pas mutuellement exclusives (A peut déclencher B). Aucune décision fondateur actée n'est disponible dans les sources lues.

---

### [HIGH][BLOCKS:low] H-003 — Injection dynamique : RuntimeInjection

Les prompts `.md` peuvent contenir des placeholders remplacés au chargement :

```typescript
// Exemple de RuntimeInjection pour injecter la criticality courante
const injections: RuntimeInjection[] = [
  {
    placeholder: "{{CURRENT_RISK_CLASS}}",
    resolver: () => currentRisk.risk_class,
  },
  {
    placeholder: "{{ACTIVE_PLAN_PATH}}",
    resolver: async () => readActivePlanPath(),
  },
];
```

`loadPrompt(agentName, modelID, injections)` applique chaque injection via `body = body.replaceAll(placeholder, await resolver())` après le chargement du `.md`. Les injections sont appelées dans l'ordre du tableau.

---

### [HIGH][BLOCKS:low] H-004 — Noms de profils v0.1

**Décision fondateur (PROPOSITION.md §12, Q1) :**

> Noms fonctionnels : `planner`, `executor`, `critic`. Famille nominale plus tard si envie.

Ces trois noms sont **actés** pour v0.1. Les 8 autres profils OMO-équivalents (Oracle, Librarian, Explore, Atlas, Metis, Momus, Multimodal-Looker, Junior) sont déférés à l'itération.

---

## MEDIUM items (convergence detail)

### [MEDIUM][BLOCKS:none] M-001 — Format des fichiers .md de profil

Chaque variant `.md` suit la structure :

```markdown
---
profile: planner          # nom du profil (obligatoire)
variant: default          # nom du variant (obligatoire)
model: "*"                # modèle cible ("*" = défaut, ou identifiant modèle)
version: "0.1"
---

<!-- Contenu du prompt. Placeholders: {{CURRENT_RISK_CLASS}}, {{ACTIVE_PLAN_PATH}}, etc. -->

# Rôle

...
```

Le frontmatter est parsé par `loadPrompt`. Les champs `profile`, `variant`, `model`, `version` sont les seuls requis. Le reste du frontmatter est passé tel quel dans `LoadedPrompt.frontmatter`.

---

### [MEDIUM][BLOCKS:none] M-002 — Bundled vs filesystem : stratégie v0.1

**v0.1 :** les prompts sont chargés depuis le filesystem (`kind: "filesystem"`, `baseDir: path.join(__dirname, "../prompts/<profil>/")`) — pas de bundling statique à la compilation. Le bundling (import `with { type: "text" }`) est une optimisation de distribution pour les binaires compilés, déférée à la release MIT.

---

### [MEDIUM][BLOCKS:none] M-003 — Cache des variants chargés

`loadPrompt` maintient un cache en mémoire `Map<string, LoadedPrompt>` indexé par `"${agentName}:${variantName}"`. Le cache est vidé entre les sessions (pas de persistance sur disque). Les `RuntimeInjection` avec resolvers asynchrones sont ré-évalués à chaque appel si le cache est invalidé (invalidation sur changement de `modelID` ou de `riskClass`).

---

### [MEDIUM][BLOCKS:none] M-004 — Propagation aux sous-agents Hermes

**Contrainte connue (PROPOSITION.md §4) :**

> Les sub-agents Hermes ne lisent pas les context files (`skip_context_files=True` hardcodé) → les règles hima injectées via `.hermes.md` ne se propagent PAS aux agents enfants ; la propagation devra passer par le hook `pre_tool_call`/`delegate_task` du plugin hima.

Conséquence pour les profils : le profil actif du main agent ne se propage pas automatiquement aux sous-agents Hermes. La gate `subagent_start` doit injecter explicitement le prompt de profil requis pour chaque sous-agent lancé.

---

## LOW items (convergence tail)

### [LOW][BLOCKS:none] L-001 — Extensibilité : ajouter un profil

Pour ajouter un profil (ex: `oracle` en itération) :

1. Créer `prompts/oracle/default.md` avec frontmatter `profile: oracle`.
2. Déclarer la `VariantTable` dans un fichier `src/oracle-prompts.ts`.
3. Enregistrer dans l'index de profils (`src/index.ts`).
4. Définir les write boundaries du profil dans la gate `pre_tool`.

Aucun changement au mécanisme `resolveVariant` ou `loadPrompt` n'est requis.

### [LOW][BLOCKS:none] L-002 — Conventions de nommage des variants

Les variants par modèle suivent la convention : `claude-fable-5.md`, `claude-opus-4-8.md`, `gpt.md`, `gemini.md`, `default.md`. Le nom du fichier sans extension = le `variantName`. La résolution par modèle se fait dans `model-core` (matchers `isClaudeFable5Model`, etc.) — ces matchers sont à écrire dans `packages/model-core/src/` (zéro copie OMO).

### [LOW][BLOCKS:none] L-003 — Priorité de variant pour le planner

`agentName === "planner"` est le seul trigger de sélection prioritaire de variant (step 1 de `resolveVariant`). Ce comportement reflète la décision OMO (prometheus = planner, variant `"planner"` de la table ultrawork) et est conservé pour hima.

---

## Contradictions détectées

### CONTRADICTION-001 — Enforcement écriture planner : gate vs prompt uniquement

**Référence A :** PROPOSITION.md §2 décrit le profil planner avec « INTERDIT d'écrire du code » et cite l'exemple OMO (prometheus a un hook `prometheus-md-only` côté adapter).  
**Référence B :** lane-omo.md §1 confirme que cette interdiction est enforced côté adapter (hook), pas uniquement dans le prompt (`default.md` de prometheus).  
**Point de décision :** la gate `pre_tool` de hima doit-elle être dans `behavior-core` (un behavior `BEH-xxx` générique de restriction de write par profil) ou dans l'adapter Hermes spécifiquement ? Les behaviors actuels (`BEH-010` à `BEH-032`) ne gèrent pas de restrictions par profil. Il manque soit un nouveau BEH-xxx, soit une logique dans l'adapter.  
**Non résolu** — architecture à trancher avant Wave 2.

### CONTRADICTION-002 — Profils Hermes vs profils hima : deux systèmes distincts

**Référence A :** PROPOSITION.md §4 : « Profils Hermes = `HERMES_HOME=~/.hermes/profiles/<name>` par invocation ».  
**Référence B :** SPEC-003 (ce document) définit les profils hima comme des dossiers `prompts/<profil>/` dans `packages/prompts-core/`.  
**Ambiguïté :** les deux systèmes coexistent. Un « profil hima » (prompt + behaviors) n'est pas un « profil Hermes » (configuration globale de l'agent Hermes). La relation entre les deux n'est pas spécifiée : est-ce que chaque profil hima correspond à un profil Hermes dédié, ou le profil hima est injecté dynamiquement dans un profil Hermes unique ?  
**Non résolu** — dépend du design de l'adapter-hermes (hors scope SPEC-003).

---

## Questions ouvertes

### QO-001 — Mécanisme de sélection du profil actif (QUESTION OUVERTE — pas de décision fondateur)

Les sources lues ne tranchent pas entre les options A (sélection par commande), B (HERMES_HOME), C (automatique). Cette décision bloque l'implémentation de la gate `pre_tool` profile-aware et du routing des commandes `/plan`/`/ulw`. À soumettre au fondateur avant Wave 2.

### QO-002 — Behavior de restriction d'écriture par profil : BEH-xxx ou logique adapter ?

Voir CONTRADICTION-001. Un `BEH-040` (profile-write-guard) serait cohérent avec l'architecture behavior-core, mais introduit un couplage profils → behaviors qui n'existe pas encore. Alternative : logique dans chaque adapter (`adapter-hermes`, `adapter-claude`). À décider avant d'implémenter la gate planner.

### QO-003 — Critic : vote ou advisory ?

Le contrat du profil `critic` (CR-006) spécifie un verdict structuré. La spec ne définit pas si ce verdict est bloquant (gate `stop` attend l'approbation du critic) ou advisory (le main agent peut ignorer). Décision à prendre avant Wave 2.

---

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: |
    Un profil (planner, executor, ou critic) peut exécuter une action explicitement
    interdite par son contrat (ex: planner écrit du code hors .hima/plans/, executor
    écrit hors writeBoundary, critic écrit quoi que ce soit) sans que la gate pre_tool
    ne bloque — alors CR-004/CR-005/CR-006 sont faux et la spec doit être révisée pour
    déplacer l'enforcement vers un mécanisme plus fort (hook PreToolUse systématique).
  checkpoint-date: 2026-07-15 (premier test d'intégration profil × gate)
  evidence-anchor: |
    packages/behavior-core/src/behavior-override.ts (CATALOG_RISK_FLOORS) +
    gate pre_tool implémentée dans adapter-hermes + test d'acceptation unitaire
    resolveVariant (CR-003) + test d'intégration planner-write-guard
  on-fail: |
    Ouvrir QO-002 comme décision bloquante ; ajouter BEH-040 (profile-write-guard)
    ou câbler le guard dans PreToolUse hook de l'adapter avant toute exécution
    de profil en production.
```
