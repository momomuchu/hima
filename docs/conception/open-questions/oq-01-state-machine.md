# OQ-01 — State Machine et Phases

> **Statut** : réponses définitives — Section 1 du fichier `open-questions.md`
> **Date** : 2026-05-03
> **Source spec** : `docs/conception/01-state-machine-spec.md`
> **Décisions de référence** : D7 (mono-état), D12 (TypeScript/xstate), D15 (YAML + JSONL)

---

### Q1.1 — Quel framework de state machine en TypeScript ?

**Réponse** : XState v5. Pas de robot, pas d'implémentation maison.

**Justification** : XState v5 est le seul framework TypeScript qui supporte nativement les Harel statecharts (hiérarchie, régions orthogonales, history pseudo-states), les guards purs typés, et les actions nommées — tout ce que la spec requiert. Son modèle `setup()` + `createMachine()` correspond exactement au squelette implémenté dans la spec. Robot est trop limité pour les méta-états orthogonaux. Une implémentation maison introduirait 400+ lignes de boilerplate non testé pour réinventer ce que XState fournit avec 0 bug.

**Référence spec** : `01-state-machine-spec.md §8` — squelette XState v5 complet fourni.

---

### Q1.2 — Les 8 phases sont-elles toutes des états distincts, ou certaines sont-elles regroupées ?

**Réponse** : Les 8 phases sont 8 états composites distincts dans la state machine. Aucun regroupement.

**Justification** : chaque phase a des guards d'entrée différents (ex. `adrSigned` pour BUILD, `smokeTestsGreen` pour APPRENTISSAGE), des territoires d'écriture différents, et des transitions de rollback spécifiques (VALIDATION peut revenir à BUILD, RELEASE aussi — mais pas DISCOVERY). Regrouper des phases différerait les problèmes de guards sans gain de simplicité. IDLE est un 9e état (terminal de départ/sortie), distinct des 8 phases actives.

**Référence spec** : `01-state-machine-spec.md §1.1` — énumération explicite des 9 MacroStates (IDLE + 8 phases).

---

### Q1.3 — Quels sont les états transitoires vs les états stables ?

**Réponse** : Les états stables sont tous les états `MacroCycle.SubPhase` (56 combinaisons) et IDLE. Les états transitoires sont ERROR.RECOVERABLE, ERROR.ESCALATED, et SUSPENDED — ils sont orthogonaux et ne remplacent pas l'état courant, ils se superposent.

**Justification** : la spec modélise ERROR et SUSPENDED comme une région orthogonale (MetaRegion) dans ActiveCycle. Le MacroCycle reste "gelé en place" pendant qu'ERROR est actif — il ne quitte pas son état. `lastStableState` capture le snapshot avant entrée en méta-état, permettant la reprise exacte. Pas d'état transitoire "vide" entre deux phases : la transition est atomique (persistState sur chaque transition).

**Référence spec** : `01-state-machine-spec.md §1.3` (meta-states), `§6.3` (parallel regions), `§9.3 règle 1`.

---

### Q1.4 — Comment représenter les phases concurrentes (multi-états) ? Le passage va-t-il casser la persistence des sessions en cours ?

**Réponse** : Le multi-état est implémenté par remplacement de `HarnessMachineContext` par `Map<itemId, HarnessMachineContext>` et extension de `current-state.yaml` en `current-state/{itemId}.yaml`. La migration est non-destructive : les sessions mono-état existantes sont lues comme un `Map` à une entrée (itemId = `default`).

**Justification** : la spec définit explicitement le chemin de migration (§10, Q7). La précondition est 2 cycles complets sans ABORTED. La compatibilité ascendante est garantie par la convention `default` — un fichier `current-state.yaml` existant est traité comme `current-state/default.yaml` par le runtime migré. Aucune session en cours ne casse.

**Référence spec** : `01-state-machine-spec.md §10 — Q7` (migration path détaillé). Décision D7 dans `checkpoint-implementation.md`.

---

### Q1.5 — Les transitions sont-elles toujours initiées par l'humain, ou certaines peuvent-elles être déclenchées automatiquement ?

**Réponse** : Les transitions peuvent être déclenchées par 4 sources : `agent`, `human`, `ci`, `hook`. Les transitions inter-phases (macro-cycle) peuvent être déclenchées automatiquement par l'agent ou la CI quand tous les guards sont satisfaits — sauf pour les classes É/C qui exigent `humanValidationObtained` comme guard obligatoire.

**Justification** : le champ `triggered_by` dans `LastTransition` encode les 4 sources. En mode `bypass`, l'agent peut déclencher toutes les transitions T/F sans intervention humaine. En mode `auto`, les gates CI (testsGreen, ciGatesGreen) suffisent pour BUILD → VALIDATION. La règle É/C est structurelle, pas conventionnelle : `humanValidationObtained` est un guard pur qui retourne `false` tant que l'humain n'a pas posé l'evidence.

**Référence spec** : `01-state-machine-spec.md §2` (champ `triggered_by`), `§3.1` (guards T008, T037), `§4` (guard `humanValidationObtained`).

---

### Q1.6 — Quelles sont les guards précises pour chaque transition ? Sont-elles formellement définies ?

**Réponse** : Toutes les guards sont formellement définies comme prédicats purs TypeScript dans `guards.ts`. Aucune n'est laissée à l'appréciation de l'agent.

**Justification** : la spec fournit l'implémentation complète de chaque guard (§4, ~25 fonctions). Chaque guard est `(ctx: HarnessMachineContext) => boolean`, sans effet de bord, testable en isolation. Les seules "décisions" laissées à l'agent sont la production des preuves (écriture dans `evidence[]`) — mais la transition elle-même est mécanique une fois la preuve présente. Laisser des guards à l'appréciation de l'agent serait une violation du principe "boundaries effectives, pas seulement déclaratives" (D9, couche 3).

**Référence spec** : `01-state-machine-spec.md §4` — implémentation complète de tous les guards. Table `§3.1` à `§3.8` — guards listés par transition.

---

### Q1.7 — Que se passe-t-il si une transition échoue (guard non satisfait) ?

**Réponse** : La machine reste dans l'état courant. Aucun rollback, aucun blocage de l'agent. Un événement `ERROR_DETECTED` est émis si l'échec de guard provient d'une violation de politique (ex. bypass sur É/C → `BLOCKED_POLICY`). Pour un guard simplement non satisfait (CI pas encore verte), la machine attend silencieusement le prochain événement.

**Justification** : XState v5 ignore les transitions dont les guards retournent `false` — la machine reste dans son état courant sans erreur. La distinction est : guard non satisfait par manque de preuve = attente normale ; guard structurellement impossible (bypassStructurallyImpossible) = finalState `BLOCKED_POLICY` immédiat. Cette distinction évite de polluer les logs avec des "échecs" qui sont en réalité des attentes normales de CI.

**Référence spec** : `01-state-machine-spec.md §1.4` (BLOCKED_POLICY), `§3.4` (E001), `§7` (table final states).

---

### Q1.8 — Comment gérer les rollbacks de phase (revenir de Build à Conception parce qu'on s'est trompé) ?

**Réponse** : Deux rollbacks sont définis : VALIDATION → BUILD.Vérifier sur `DOD_FAIL`, et RELEASE → BUILD.Vérifier sur `ROLLBACK_REQUEST`. Il n'y a pas de rollback de BUILD vers CONCEPTION dans la spec — si l'erreur de conception est découverte en BUILD, la bonne réponse est de créer un nouveau PBI de type Conception, pas de reculer la machine d'état.

**Justification** : les rollbacks spec (R001, R002) ciblent BUILD.Vérifier — le point d'entrée de la vérification post-build. Reculer vers CONCEPTION signifierait annuler des artefacts déjà produits (ADR signé, code partiellement écrit). Le pattern correct est : émettre `CYCLE_ABORT` (→ CANCELLED), créer un nouveau PBI qui re-traverse CONCEPTION avec les corrections, puis relancer. Cela maintient la traçabilité intégrale sans corrompre l'historique du cycle courant.

**Référence spec** : `01-state-machine-spec.md §3.5` (R001, R002), `§1.4` (CANCELLED final state).

---

### Q1.9 — La phase Run est continue par nature. Comment la modélise-t-on dans la state machine ?

**Réponse** : RUN est un état composite ordinaire avec le même sous-cycle à 7 étapes que les autres phases. La nature "continue" de Run est capturée par le fait que `RUN.Transmettre` peut déclencher une nouvelle instance du cycle (retour à IDLE puis nouveau CYCLE_START) plutôt qu'une transition finale.

**Justification** : modéliser RUN comme un état parallèle permanent ou un sous-état permanent est inutilement complexe. La continuité opérationnelle de Run (monitoring, SLO, OODA loop) est dans les activités transverses de l'agent — pas dans la state machine. La machine ne pilote pas le rythme de l'agent en production ; elle enregistre les cycles d'Apprentissage déclenchés par les signaux Run. `RUN.Exécuter` peut durer des semaines ; la machine n'a pas de timeout.

**Référence spec** : `01-state-machine-spec.md §1.1` (RUN dans l'énumération standard), `§8` (RUN.onDone → APPRENTISSAGE, même pattern que les autres).

---

### Q1.10 — Comment le harness gère-t-il une interruption (Ctrl+C, crash) en milieu de phase ?

**Réponse** : Sur interruption propre (Ctrl+C / SESSION_END), la machine émet `CYCLE_SUSPEND` → SUSPENDED, persiste `current-state.yaml`, et reprend automatiquement sur le prochain `SESSION_START` via le history pseudo-state. Sur crash (aucun hook fired), le dernier `current-state.yaml` écrit atomiquement est la reprise — pas de confirmation demandée à l'utilisateur.

**Justification** : `persistState` est appelé sur chaque transition (règle 1 §9.3). L'écriture atomique (write-then-rename, §9.3 règle 2) garantit qu'aucun état corrompu n'est jamais persisté. Sur `SESSION_START`, la machine lit `current-state.yaml` et reprend depuis `lastStableState` via le history pseudo-state XState. La demande de confirmation serait du rubber-stamping déguisé — si l'état est cohérent, la reprise est automatique ; si l'état est incohérent (fichier absent/invalide), la machine repart de IDLE.

**Référence spec** : `01-state-machine-spec.md §3.7` (SP01-SP02), `§9.3 règles 2 et 4`, `§8` (SESSION_START handler).

---

### Q1.11 — Y a-t-il un état "frozen" (gel volontaire) ou "incident" (gel d'urgence) ?

**Réponse** : Oui. SUSPENDED est le gel volontaire (`CYCLE_SUSPEND` depuis n'importe quel état, toutes les écritures interdites sauf audit-append). Il n'y a pas d'état "incident" séparé — les incidents sont gérés par ERROR.ESCALATED (méta-état orthogonal qui gèle le macro-cycle en place sans le quitter). Le bypass des règles normales est interdit dans les deux cas.

**Justification** : SUSPENDED interdit toutes les écritures (`all writes forbidden` §1.3) et ne peut être quitté que par SESSION_START (reprise) ou CYCLE_ABORT (abandon). ERROR.ESCALATED est distinct : la machine reste "active" pour recevoir ERROR_RECOVERED ou ERROR_UNRECOVERABLE, mais le macro-cycle est gelé. Il n'y a pas de "bypass des règles normales" même en incident — c'est un invariant architectural : les règles É/C ne s'assouplissent pas sous pression.

**Référence spec** : `01-state-machine-spec.md §1.3` (SUSPENDED, ABORTED), `§3.4` (E004-E006), `§6.3` (parallel regions diagram).

---

### Q1.12 — Comment représenter le sous-cycle à 7 étapes dans la state machine globale ?

**Réponse** : Sub-state machine partagée (`subCycleStates` object), réutilisée par spread (`...subCycleStates`) dans chaque macro-état. À l'exécution, la position dans le sous-cycle est stockée dans le champ `subPhase` du contexte — pas comme une machine imbriquée séparée. C'est la propriété fractale : même patron, même implémentation, instancié 8 fois.

**Justification** : XState v5 permet le partage de définitions d'états via des objets réutilisés. La spec définit `subCycleStates` une seule fois (§8) et le spread dans chaque `MacroCycle.states`. À l'exécution, XState ne voit pas "une même machine imbriquée 8 fois" — il voit 8 états composites avec des sous-états identiques, ce qui est correct. Le champ `subPhase: SubPhase | null` dans le contexte permet à tout guard ou action de connaître la position exacte sans traverser la hiérarchie XState. Deux niveaux de hiérarchie suffisent ; un troisième niveau (sous-machine autonome) serait une complexité sans valeur ajoutée.

**Référence spec** : `01-state-machine-spec.md §1.2` (composite states enumeration), `§6.1` (structure hiérarchique), `§6.2` (fractal pattern — "represented as a single `subPhase` field in context, not as nested machines"), `§8` (subCycleStates definition).

---

*Document produit depuis `docs/conception/01-state-machine-spec.md` + `docs/research-reports/checkpoint-implementation.md` (D7, D12, D15).*
