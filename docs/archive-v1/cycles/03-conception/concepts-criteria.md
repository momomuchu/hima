# Cycle 03 — Conception : Concepts et Critères

> **Version** : 1.0 — 2026-05-03
> **Statut** : livrable de référence, cycle Conception
> **Pipeline fractale v4** — Cycle 3/8
> **Auteur** : deep-researcher (claude-sonnet-4-6)
> **Source de vérité** : rapport-discovery-cadrage.md + cycle qualité v3 + standards 2026

---

## Sommaire

1. Résumé exécutif
2. Position dans le pipeline
3. Objectif du cycle
4. Entrées (DoR)
5. Sorties (DoD)
6. Concepts clés
7. Critères qualité — ISO/IEC 25010:2023
8. Modulation par classe de risque
9. Sous-cycle fractal (7 étapes)
10. Activités transversales
11. Artefacts produits
12. Métriques et indicateurs
13. Standards de référence
14. Questions ouvertes (RED CARDS)
15. Relations inter-cycles

---

## 1. Résumé exécutif

Le cycle Conception est le troisième cycle de la pipeline fractale v4. Il reçoit un cadrage validé (DoR remplie en Cadrage) et produit le plan architectural exploitable par le cycle Build — sans toucher au code de production.

**Ce que ce cycle fait :**
- Translate les décisions de cadrage en architecture concrète (C4, arc42, modèle de données, contrats API)
- Formalise les décisions techniques sous forme d'ADR signés
- Identifie les menaces STRIDE sur les flux nouveaux ou modifiés
- Prototypage ciblé sur les risques architecturaux non résolus (PoC timeboxé)
- Définit la testabilité dès la conception (hexagonal, ports/adapters, DI)

**Ce que ce cycle ne fait pas :**
- Ne code pas les fonctionnalités (domaine du cycle Build)
- Ne valide pas les exigences métier (domaine Cadrage)
- Ne déploie pas en production (domaine Release)

**Modulation par risque :** pour un changement T/L, le cycle Conception peut se réduire à un ADR d'une page et un diagramme de composant mis à jour. Pour H/C, chaque section de ce document s'applique intégralement, avec threat model et prototype de validation.

**Résultat attendu :** à la sortie de Conception, l'équipe (ou l'agent IA en mode auto) peut démarrer Build sans ambiguïté architecturale majeure. Les décisions sont tracées, les risques connus sont adressés, les contrats sont définis.

---

## 2. Position dans le pipeline

```
[discovery] → [cadrage] → [conception] → [build] → [validation] → [release] → [run] → [learning]
                               ↑ ici
```

### 2.1 Ce qui arrive en entrée (depuis Cadrage)

- Problem statement validé avec critères de succès mesurables
- Scope IN/OUT explicite
- Classification de risque globale T/L/M/H/C
- Backlog initial avec items DoR-conformes
- Contraintes réglementaires identifiées (RGPD, EAA, sectorielles)
- Performance budget (technique + financier)

### 2.2 Ce qui sort en sortie (vers Build)

- Architecture documentée C4 niveau 1-3 (Context, Container, Component)
- ADR signés pour toutes les décisions structurantes
- Modèle de données versionné
- Contrats d'API (OpenAPI 3.x ou AsyncAPI)
- Threat model STRIDE (si M+)
- Critères de testabilité explicites
- PoC résultat + décision si applicable
- Quality gates CI définis pour ce changement

### 2.3 Frontières strictes

| Ce que Conception produit | Ce que Conception ne produit pas |
|---|---|
| Architecture décisionnelle | Code de production |
| Contrats d'interface | Implémentation des contrats |
| Modèle de données logique | Scripts de migration |
| Threat model | Remédiation des menaces (→ Build) |
| PoC technique jetable | MVP ou prototype livré en prod |
| Quality gates définis | Exécution des quality gates (→ Build/CI) |

---

## 3. Objectif du cycle

### 3.1 Objectif principal

Produire une architecture suffisamment précise pour que le cycle Build puisse démarrer sans ambiguïté structurelle. Pas parfaite — suffisante. Le critère opérationnel est : *un agent IA ou un développeur peut implémenter le premier incrément Build sans poser de question d'architecture.*

### 3.2 Objectifs secondaires

1. **Traçabilité des décisions** : toute décision structurante a un ADR avec contexte, alternatives considérées, décision prise, conséquences.
2. **Réduction des risques architecturaux** : les risques H/C sont soit adressés par des décisions explicites, soit transformés en PoC timeboxé.
3. **Testabilité by design** : l'architecture résultante est testable à tous les niveaux (unitaire, intégration, contrat, E2E) sans refactoring majeur.
4. **Sécurité by design** : les flux sont modelisés STRIDE, les menaces prioritaires ont des mitigations planifiées dans le backlog Build.
5. **Contrats clairs** : les interfaces entre composants sont définies avant l'implémentation — découplage équipes/agents, parallélisation Build.

### 3.3 Anti-objectifs (ce que ce cycle n'optimise pas)

- Vitesse d'implémentation (domaine Build)
- Complétude des tests (domaine Validation)
- Expérience utilisateur finale (domaine Discovery/Cadrage)

---

## 4. Entrées (Definition of Ready)

Un cycle Conception peut démarrer ssi **tous** les critères stricts sont remplis.

### 4.1 Critères stricts (bloquants)

- [ ] Problem statement écrit avec critères de succès mesurables
- [ ] Scope IN / OUT explicite — toute ambiguïté a un owner et une date de résolution
- [ ] Classification de risque globale proposée et validée (T/L/M/H/C)
- [ ] Parties prenantes identifiées avec rôles décision/consultation/information
- [ ] Contraintes techniques non négociables listées (stack imposée, contraintes d'infrastructure, licences)
- [ ] Contraintes réglementaires identifiées (RGPD, EAA, sectorielles) — même si "non applicable" doit être explicit
- [ ] Performance budget défini : latence cible, disponibilité cible, budget financier par unité si M+
- [ ] Backlog initial avec au moins les items du premier sprint en état DoR

### 4.2 Critères souhaitables (non bloquants, mais à résoudre en Conception)

- [ ] Intégrations avec systèmes existants cartographiées (même grossièrement)
- [ ] Première hypothèse de modèle de données esquissée
- [ ] Contraintes de sécurité connues (auth existante, périmètre réseau, secrets management)

### 4.3 Critères différés (peuvent attendre la Conception avancée)

- [ ] Stratégie de déploiement détaillée (relève de Release)
- [ ] Plan d'observabilité complet (relève de Build)
- [ ] Plan de migration de données (si applicable — déterminé en Conception)

### 4.4 Condition de démarrage minimal pour M/H/C

Pour M/H/C, si un critère strict manque : documenter explicitement le gap, son impact, son owner, et la date de résolution attendue. Ne pas démarrer la Conception sans avoir au moins les critères 1, 2, 3, 4 remplis.

---

## 5. Sorties (Definition of Done)

Le cycle Conception est terminé quand **tous** les critères obligatoires selon la classe de risque sont satisfaits.

### 5.1 Matrice DoD par classe de risque

| Livrable | T | L | M | H | C |
|---|:---:|:---:|:---:|:---:|:---:|
| Diagramme C4 Niveau 1 (Context) mis à jour | — | ◔ | ✅ | ✅ | ✅ |
| Diagramme C4 Niveau 2 (Container) | — | — | ✅ | ✅ | ✅ |
| Diagramme C4 Niveau 3 (Component) | — | — | ◔ | ✅ | ✅ |
| ADR pour décision structurante | — | ◔ | ✅ | ✅ | ✅ |
| Modèle de données logique | — | — | ✅ | ✅ | ✅ |
| Contrats API / interfaces (OpenAPI ou AsyncAPI) | — | ◔ | ✅ | ✅ | ✅ |
| Threat model STRIDE sur flux nouveaux | — | — | ◔ | ✅ | ✅ |
| AIPD/DPIA déclenchée si seuil RGPD | — | — | conditionnel | ✅ si PII | ✅ |
| Critères de testabilité explicites | ◔ | ✅ | ✅ | ✅ | ✅ |
| Quality gates CI définis | ✅ | ✅ | ✅ | ✅ | ✅ |
| PoC technique si risque architectural non résolu | — | — | ◔ | ✅ si besoin | ✅ si besoin |
| Plan d'observabilité (SLI/SLO définis) | — | — | ◔ | ✅ | ✅ |
| Architecture de sécurité (auth, authz, secrets) | — | ◔ | ✅ | ✅ | ✅ |
| Stratégie de migration (expand/contract) si schéma | — | — | ✅ | ✅ | ✅ |
| Estimation FinOps (coût mensuel à régime) | — | — | ◔ | ✅ | ✅ |

Légende : ✅ obligatoire — ◔ recommandé — — skippable

### 5.2 Condition de sortie universelle (toutes classes)

Indépendamment de la classe de risque, **la sortie de Conception est bloquée si** :
- Un décision d'architecture structurante est prise mais non documentée (même pour T : un commentaire minimal suffit)
- Un risque H/C identifié en Cadrage n'a pas été adressé (adressé = ADR + mitigation ou PoC + décision)
- Les quality gates CI pour le changement ne sont pas définis

---

## 6. Concepts clés

### 6.1 Architecture logicielle — modèle C4

Le C4 Model (Simon Brown) organise la documentation d'architecture en quatre niveaux hiérarchiques, du plus abstrait au plus concret.

**Niveau 1 — Context diagram**
Vue système dans son environnement. Montre le système en boîte opaque, ses utilisateurs, et les systèmes externes avec lesquels il interagit. Audience : toutes les parties prenantes, y compris non-techniques.

```
[Utilisateur] → [Système X] → [Système externe Y]
                            ↕
                    [Base de données Z]
```

**Niveau 2 — Container diagram**
Décomposition du système en conteneurs déployables (application web, API, base de données, message broker, worker, etc.). Montre les responsabilités et les technologies. Audience : développeurs et ops.

**Niveau 3 — Component diagram**
Décomposition d'un conteneur en composants (modules, services, repositories, controllers). Montre les relations internes. Audience : développeurs du composant concerné.

**Niveau 4 — Code**
Rarement produit en Conception — réservé aux zones ultra-critiques. Diagramme de classes, séquences. Souvent généré depuis le code plutôt qu'écrit à la main.

**Règle Conception :** produire jusqu'au niveau 3 pour les composants touchés. Ne pas aller au niveau 4 — c'est du sur-specification qui sera obsolète dès la première PR.

**Combinaison avec arc42 :** arc42 fournit la structure du document (12 sections), C4 fournit les visuels. Les deux sont compatibles et complémentaires. arc42 section 5 (Building block view) = C4 niveau 2-3. arc42 section 6 (Runtime view) = diagrammes de séquence sur les flux critiques.

### 6.2 Architecture Decision Records (ADR)

Un ADR capture une décision d'architecture significative : contexte, alternatives considérées, décision retenue, conséquences. Référence : Michael Nygard (2011), popularisé par Thoughtworks, formalisé en MADR 4.0.0 (2024).

**Template MADR minimal (obligatoire pour tout ADR en Conception) :**

```markdown
# ADR-NNN — Titre de la décision

**Date** : AAAA-MM-JJ
**Statut** : [Proposed | Accepted | Deprecated | Superseded by ADR-XXX]
**Décideurs** : [noms / rôles]

## Contexte

Quelle est la situation qui force une décision ?
Quelles sont les contraintes ?

## Décision

Quelle décision a été prise ?

## Alternatives considérées

| Alternative | Avantages | Inconvénients |
|---|---|---|
| Option A | ... | ... |
| Option B | ... | ... |

## Conséquences

### Positives
- ...

### Négatives / trade-offs
- ...

## Critères de révision

Dans quelles conditions cet ADR doit-il être révisé ?
```

**Quand créer un ADR :**
- Choix de stack ou de framework (toujours)
- Pattern d'architecture (monolithe modulaire, microservices, event-driven, hexagonal)
- Choix de base de données ou de moteur de persistance
- Stratégie d'authentification / autorisation
- Stratégie de versioning d'API
- Toute décision qui génèrerait un refactoring significatif si inversée

**Quand NE PAS créer un ADR :**
- Choix de librairie utilitaire sans impact architectural
- Détail d'implémentation interne à un composant
- Convention de nommage (→ guidelines/standards)

**Anti-patterns ADR :**
- ADR rétroactif écrit après implémentation pour justifier l'existant : valeur nulle, pire que rien
- ADR sans alternatives : prouve qu'on n'a pas vraiment décidé
- ADR jamais mis à jour : Deprecated/Superseded doit être explicite

### 6.3 Modélisation de la solution — Domain Driven Design

Pour les domaines métier non triviaux (M+), la modélisation DDD tactical fournit le vocabulaire des entités architecturales.

**Entités, Value Objects, Agrégats (Vernon, Evans) :**

- **Entity** : objet avec identité stable dans le temps. L'identité persiste même quand les attributs changent. Exemple : `Order` identifié par `orderId`.
- **Value Object** : objet défini uniquement par ses attributs, sans identité propre. Immuable, toujours valide. Exemple : `Money(amount: Int, currency: Currency)`.
- **Aggregate** : cluster d'entités et de value objects traité comme unité transactionnelle. L'Aggregate Root est le seul point d'entrée. Règle de Vernon : les agrégats ne référencent d'autres agrégats que par identité, pas par référence directe.
- **Domain Event** : fait passé immuable émis par un agrégat après un changement d'état. Dispatché après commit, jamais avant.
- **Repository** : abstraction de persistence pour un agrégat. Interface en couche domaine, implémentation en couche infrastructure.

**Bounded Context :** périmètre dans lequel un modèle de domaine est cohérent et un vocabulaire ubiquitaire s'applique sans ambiguïté. Les contextes communiquent via ACL (Anti-Corruption Layer) ou Domain Events.

**Ubiquitous Language :** le code utilise exactement les mêmes termes que le métier. Zéro traduction entre doc métier et code. Un terme = un concept dans le bounded context.

**Règle Conception :** identifier les bounded contexts avant de dessiner les containers C4. Un container ne doit pas chevaucher deux bounded contexts.

### 6.4 Prototypage et critères de PoC

Un PoC (Proof of Concept) en Conception répond à une question binaire : *cette approche architecturale est-elle faisable dans nos contraintes ?* Il n'est pas un MVP, pas un prototype UI, pas du code de production.

**Quand déclencher un PoC :**
- Intégration avec un système externe dont le comportement réel est inconnu
- Pattern architectural jamais utilisé par l'équipe (ex : event sourcing, CQRS, streaming)
- Contrainte de performance non prouvée (latence, throughput, volume)
- Dépendance à une technologie dont la maturité est incertaine

**Critères d'un bon PoC :**
1. **Question unique** : un PoC répond à UNE question. Si deux questions → deux PoC séparés.
2. **Timeboxé** : maximum 3 jours pour un PoC solo avec agent IA. Au-delà = implémentation déguisée.
3. **Critères de succès prédéfinis** : avant de commencer, définir ce que "succès" signifie et ce que "échec" signifie. Les deux doivent être acceptables comme résultats.
4. **Jetable** : le code du PoC ne va PAS en production. Si l'équipe hésite à jeter le PoC, c'est qu'il est devenu un MVP. Stop.
5. **Livrable** : rapport PoC (1 page) + ADR de décision basé sur le PoC.

**Template rapport PoC :**
```markdown
# PoC — [Titre de la question]

**Question** : [Question binaire]
**Date** : AAAA-MM-JJ
**Durée** : X jours

## Résultat

✅ Faisable / ❌ Non faisable / ⚠️ Faisable sous conditions

## Observations clés

- ...

## Conditions / contraintes découvertes

- ...

## Décision architecturale

→ ADR-NNN : [titre de la décision résultante]

## Code PoC

Archivé dans `.planning/spikes/poc-AAAA-MM-JJ-[slug]/`
NE PAS MERGER en main.
```

### 6.5 Contrats API et interfaces

**API Design-First (Schema-First) :** définir le contrat avant d'écrire le code. OpenAPI 3.x pour REST, AsyncAPI pour event-driven, Protobuf/gRPC pour RPC binaire.

**Pourquoi contract-first en Conception :**
- Découple implémentation provider et consumer → parallélisation Build
- Génération de mocks côté consumer dès la Conception
- Tests de contrat (Pact) rédigés dès Conception, validés en Build
- Versioning API anticipé (backwards compatibility rules)

**Éléments d'un contrat API minimal :**
```yaml
# OpenAPI 3.x skeleton
openapi: "3.1.0"
info:
  title: "[Service Name] API"
  version: "1.0.0"
paths:
  /resource/{id}:
    get:
      summary: "Get resource by ID"
      parameters: [...]
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Resource"
        "404": ...
        "401": ...
        "422": ...
components:
  schemas:
    Resource:
      type: object
      required: [id, ...]
      properties: ...
  securitySchemes: ...
```

**Règles de versioning d'API en Conception :**
- Tout breaking change → nouvelle version majeure (v2, v3)
- Additions backward-compatible → minor (header `Deprecation:` pour les champs à supprimer)
- Stratégie URL-based (`/v1/`, `/v2/`) ou header-based (`Accept: application/vnd.api+json; version=2`) — décision à prendre en ADR

**Interfaces internes (ports/adapters / hexagonal) :**
Les interfaces entre couches domaine et infrastructure sont définies en Conception. Le domaine ne dépend que d'abstractions, jamais de concrétions. Cette règle est la condition nécessaire de la testabilité (voir §6.7).

```typescript
// Interface définie en Conception (port)
interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// Implémentation concrète définie en Build (adapter)
class PostgresOrderRepository implements OrderRepository { ... }
class InMemoryOrderRepository implements OrderRepository { ... } // pour les tests
```

### 6.6 Modèle de données

**Modèle logique vs physique :**
En Conception, on produit le modèle **logique** (entités, attributs, relations, cardinalités). Le modèle physique (tables SQL, indexes, schémas NoSQL) relève de Build.

**Diagramme ERD minimal pour M+ :**
```
Entité A ─── [1:N] ─── Entité B
             └── Attributs : id, name, created_at, ...
```

**Invariants de données à spécifier en Conception :**
- Contraintes d'unicité
- Contraintes de non-nullité
- Contraintes de domaine (plage de valeurs, format)
- Durées de conservation (RGPD) — par entité/champ
- Catégorie de sensibilité (PII, données de santé, données financières)

**Argent = entiers (centimes), jamais float.** Règle absolue héritée du cadre qualité. `Money` est un Value Object avec `amount: Int` et `currency: Currency`.

**Stratégie de migration — expand/contract :**
Toute modification de schéma en Conception doit être planifiée en expand/contract :
1. **Expand** : ajouter le nouveau champ/table (backward compatible)
2. **Dual-write** : écrire dans l'ancien ET le nouveau
3. **Backfill** : migrer les données existantes en batch non bloquant
4. **Switch read** : basculer la lecture vers le nouveau
5. **Contract** : supprimer l'ancien (dans un déploiement séparé)

Un RENAME de colonne en un déploiement = anti-pattern d'incident garanti.

### 6.7 Design for Testability

La testabilité n'est pas une propriété émergente — elle se conçoit. Une architecture non testable en Conception coûte 10× plus à tester en Validation.

**Principes architecturaux pour la testabilité :**

1. **Inversion de dépendance (SOLID - D)** : les couches hautes ne dépendent pas des couches basses, les deux dépendent d'abstractions. Permet l'injection de doubles de test.

2. **Hexagonal Architecture (Ports & Adapters)** : le domaine métier est isolé de toute infrastructure (DB, HTTP, queue). Les ports (interfaces) sont définis en Conception. Les adapters (implémentations) sont interchangeables → tests unitaires sans DB, sans réseau.

3. **Absence de statics / singletons** : les méthodes statiques et les singletons sont non-injectables, non-mockables. Tout état partagé → service injectable.

4. **Constructors purs** : les constructeurs ne font pas d'I/O. L'initialisation asynchrone est explicite.

5. **Observable state** : les effets de bord (envoi d'email, écriture en DB, publication d'événement) sont isolés en adapters, pas mélangés avec la logique métier.

**Niveaux de test anticipés en Conception :**

| Niveau | Ce qu'il teste | Dépendances |
|---|---|---|
| Unitaire (domaine) | Règles métier, invariants d'agrégat, Value Objects | Aucune infrastructure |
| Unitaire (service) | Orchestration, cas d'usage | Repositories en mémoire (InMemory Fake) |
| Intégration (adapter) | Repository SQL, client HTTP | DB de test, serveur mock |
| Contrat (Pact) | Interface provider/consumer | Consumer-driven contract |
| E2E (parcours critique) | Flux complet utilisateur | Environnement staging |

**La Conception doit répondre à :** "Comment testerons-nous ceci sans accéder à la production ?" Si la réponse est "impossible", l'architecture est défectueuse.

### 6.8 Architecture de sécurité

**Threat Modeling STRIDE :** méthode Microsoft pour énumérer les menaces sur les flux d'un système. Itératif, léger, 90 min max.

Six catégories STRIDE :
- **S**poofing — usurpation d'identité
- **T**ampering — altération de données en transit ou au repos
- **R**epudiation — nier avoir effectué une action (absence de logs)
- **I**nformation disclosure — fuite d'information confidentielle
- **D**enial of service — saturation/indisponibilité
- **E**levation of privilege — accès non autorisé à des droits supérieurs

**Processus STRIDE en Conception (90 min max) :**
1. Dessiner le Data Flow Diagram (DFD) avec les trust boundaries
2. Pour chaque flux et chaque datastore : parcourir les 6 catégories STRIDE
3. Lister les menaces avec priorité (impact × vraisemblance)
4. Définir les mitigations → pousser dans le backlog Build avec niveau de priorité
5. Documenter dans `.planning/security/threat-model-[feature].md`

**Architecture d'authentification / autorisation :**
Décision à prendre en ADR en Conception :
- Auth : JWT stateless vs sessions avec serveur d'état vs OAuth2/OIDC vs SAML
- Authz : RBAC (rôles) vs ABAC (attributs) vs ReBAC (relations)
- Rotation des secrets : gestionnaire dédié (Vault, AWS KMS, Azure KV), jamais en clair en repo

**Principe du moindre privilège :** chaque service/composant ne dispose que des droits strictement nécessaires à sa fonction. Définir les permissions en Conception, pas en Build "quand ça bloque".

### 6.9 Trade-off Analysis

Toute décision d'architecture est un trade-off. La Conception explicite ces trade-offs plutôt que de les ignorer.

**ATAM (Architecture Tradeoff Analysis Method — SEI Carnegie Mellon) :** méthode structurée pour évaluer comment des décisions architecturales impactent plusieurs attributs qualité simultanément. En mode solo/IA, une version légère suffit.

**Trade-off matrix (version légère pour Conception) :**

| Décision | Performance | Maintenabilité | Sécurité | Coût | Testabilité | Verdict |
|---|:---:|:---:|:---:|:---:|:---:|---|
| Microservices vs Monolithe | + | - | + | -- | - | ADR-001 |
| JWT vs Session | + | + | ~ | + | + | ADR-002 |
| ... | ... | ... | ... | ... | ... | ... |

Légende : ++ très positif, + positif, ~ neutre, - négatif, -- très négatif

**Sensitivity points et trade-off points (ATAM) :**
- **Sensitivity point** : une décision qui a un fort impact sur UN attribut qualité
- **Trade-off point** : une décision qui impacte positivement UN attribut et négativement UN AUTRE
- **Risk** : une décision qui peut empêcher d'atteindre un SQR (Software Quality Requirement)

Ces trois catégories doivent être documentées dans les ADR.

---

## 7. Critères qualité — ISO/IEC 25010:2023

ISO/IEC 25010:2023 définit 9 caractéristiques de qualité produit. En Conception, chaque caractéristique se traduit en critères architecturaux concrets. La version 2023 introduit **Safety** comme nouvelle caractéristique et renomme *Usability* en *Interaction capability* et *Portability* en *Flexibility*.

### 7.1 Adéquation fonctionnelle (Functional suitability)

**Sous-caractéristiques :** completeness, correctness, appropriateness

**Critères Conception :**
- Les use cases couverts par l'architecture sont tracés aux exigences du Cadrage (couverture ≥ 100 % des items DoR)
- Les fonctions hors scope sont explicitement exclues dans les contrats API (404, 403 explicites, pas de comportement implicite)
- L'architecture ne sur-spécifie pas : aucune abstraction sans use case correspondant dans le backlog (YAGNI)

**GateType `stop` :** vérifier la couverture use cases → architecture avant de valider la Conception pour M+.

### 7.2 Efficacité de performance (Performance efficiency)

**Sous-caractéristiques :** time behaviour, resource utilization, capacity

**Critères Conception :**
- Latence p99 cible définie par endpoint critique (issue du performance budget)
- Stratégie de caching identifiée : cache-aside, write-through, TTL par entité
- Anti-patterns de performance identifiés et interdits : N+1 (boucle + DB call), joins sur données non indexées, full table scans sur tables larges
- Capacité estimée : nombre d'utilisateurs concurrents, volume de données à horizon 12 mois

**Indicateur chiffré obligatoire pour H/C :** p99 latency ≤ X ms, throughput ≥ Y req/s, sous Z utilisateurs concurrents.

### 7.3 Compatibilité (Compatibility)

**Sous-caractéristiques :** co-existence, interoperability

**Critères Conception :**
- Toutes les intégrations avec systèmes externes documentées dans C4 Context + Container
- Formats d'échange définis (JSON/REST, gRPC, AMQP, HL7/FHIR pour santé)
- Rétrocompatibilité des API : stratégie versioning définie en ADR
- Contraintes de co-existence avec systèmes legacy identifiées

### 7.4 Capacité d'interaction (Interaction capability — ex-Usability)

**Sous-caractéristiques :** appropriateness, learnability, operability, accessibility, UX, user error protection

**Critères Conception (architecture) :**
- Accessibilité WCAG 2.2 AA intégrée dans l'architecture front : composants sémantiques, pas de `div` cliquable, ARIA seulement si HTML natif insuffisant
- Gestion des erreurs côté API : codes HTTP corrects, messages d'erreur non techniques, localisation possible
- Internationalisation by design : pas de chaîne hardcodée dans les composants, extraction ICU dès la Conception

**Obligation EAA (European Accessibility Act, en vigueur depuis 28 juin 2025) :** les produits B2C dans l'UE sont soumis à l'EAA. La non-conformité WCAG 2.2 AA est un risque juridique. La Conception doit prévoir l'architecture d'accessibilité.

### 7.5 Fiabilité (Reliability)

**Sous-caractéristiques :** faultlessness, availability, fault tolerance, recoverability

**Critères Conception :**
- Disponibilité cible définie : 99.9 % (8.7 h/an), 99.95 % (4.4 h/an), 99.99 % (52 min/an). Proportionnel à la classe de risque.
- Circuit breaker identifié pour les appels vers systèmes externes instables
- Graceful degradation : que se passe-t-il si le service X est indisponible ? L'architecture le prévoit (mode dégradé, queue, cache)
- Plan de rollback défini à ce stade : le rollback d'une fonctionnalité H/C doit être planifié en Conception, pas improvisé en Release

**SLO défini en Conception pour M+ :**
```
SLI : taux de requêtes réussies (HTTP 2xx+3xx / total)
SLO : ≥ 99.9 % sur fenêtre glissante 28 jours
Error budget : 43.8 min/mois
```

### 7.6 Sécurité (Security)

**Sous-caractéristiques :** confidentiality, integrity, non-repudiation, accountability, authenticity, resistance

**Critères Conception :**
- Threat model STRIDE produit pour M+ (voir §6.8)
- Modèle d'authentification défini en ADR
- Modèle d'autorisation défini en ADR (RBAC/ABAC/ReBAC)
- Données sensibles identifiées avec niveau de chiffrement requis (au repos, en transit)
- Secrets management : aucun secret dans le code ou dans les fichiers de configuration versionnés
- Non-repudiation : audit trail défini pour les actions sensibles (qui a fait quoi, quand)
- OWASP ASVS v5 : niveau 1 minimum pour tout projet, niveau 2 pour H, niveau 3 pour C

**Référentiel NIST SSDF SP 800-218 :** quatre groupes de pratiques applicables en Conception :
- **PO (Prepare Organization)** : formation sécurité, environnement de développement sécurisé
- **PS (Protect Software)** : contrôle des composants, gestion des secrets
- **PW (Produce Well-secured)** : threat modeling, revue de sécurité de conception
- **RV (Respond to Vulnerabilities)** : processus de disclosure, SLA de remédiation

### 7.7 Maintenabilité (Maintainability)

**Sous-caractéristiques :** modularity, reusability, analysability, modifiability, testability

**Critères Conception :**
- Couplage faible entre modules : dépendances uniquement vers des abstractions (interfaces/ports), jamais vers des implémentations
- Cohésion forte : chaque module a une responsabilité unique (SRP)
- Complexité cognitive cible : ≤ 15 par fonction (issu des règles du harness)
- Testabilité : voir §6.7 — architecture hexagonale, inversion de dépendance
- Documentation as code : ADR dans le repo, diagrammes en code (PlantUML, Mermaid, Structurizr DSL), pas en Visio ou Miro

**Métriques de maintenabilité à définir en Conception :**
```
Lignes/fichier : ≤ 300 (warn) / 500 (block)
Lignes/fonction : ≤ 50 (warn) / 80 (block)
Complexité cyclomatique : ≤ 15
Couplage afférent : surveiller pour les modules centraux
```

### 7.8 Flexibilité (Flexibility — ex-Portability)

**Sous-caractéristiques :** adaptability, scalability, installability, replaceability

**Critères Conception :**
- Scalabilité horizontale vs verticale : décision explicite en ADR (stateless facilite horizontal)
- Replaceabilité : les adapters (infrastructure) sont interchangeables sans modification du domaine
- Configuration par variables d'environnement (12-factor app principle 3)
- Pas de dépendance à une version spécifique de l'OS ou de l'environnement de déploiement non documentée

### 7.9 Sûreté (Safety — nouveau en ISO 25010:2023)

**Sous-caractéristiques :** operational constraint, risk identification, fail safe, hazard warning, safe integration

**Critères Conception (applicables à un système solo + IA) :**
- **Fail safe** : en cas d'erreur de l'agent IA, le système ne doit pas écrire en production sans validation humaine
- **Operational constraint** : les frontières du harness (.planning/state.yaml, .planning/current-risk.yaml, .planning/run-set.json) définissent ce que l'agent peut faire selon la phase — défini en Conception, pas au fil de l'eau
- **Safe integration** : toute intégration avec un système tiers est validée en staging avant prod (smoke tests obligatoires)
- **Hazard warning** : les quality gates CI bloquants jouent le rôle d'avertisseur — aucun humain ne peut merger sans que les gates soient verts (sauf waiver explicite, enregistré, limité dans le temps)

---

## 8. Modulation par classe de risque

### 8.1 Classe T — Trivial

**Exemples :** changement cosmétique, doc, refactor sans changement de comportement, mise à jour de dépendance sans CVE.

**Cycle Conception pour T :**
- Vérifier que le changement ne touche PAS à une interface publique, une API, un schéma DB, une règle d'auth
- Si oui → reclasser en L minimum
- Si non → documenter en un commentaire dans la PR : "Pas d'impact architectural"
- Durée cible : < 5 minutes

**Artefacts :** aucun ADR formel. Un commentaire PR suffit.

### 8.2 Classe L — Low

**Exemples :** nouvelle fonctionnalité isolée derrière feature flag, sans donnée personnelle, sans migration DB.

**Cycle Conception pour L :**
- Vérifier la compatibilité avec l'architecture existante (C4 niveau 2 — est-ce que le nouveau composant s'insère proprement ?)
- Créer un ADR si et seulement si une nouvelle décision structurante est prise
- Définir les quality gates CI pour ce changement
- Durée cible : 30 minutes à 2 heures

**Artefacts :** ADR (si applicable), mise à jour C4 niveau 2 (si nouvelle box).

### 8.3 Classe M — Moyen

**Exemples :** nouvelle fonctionnalité visible utilisateur, pas de PII sensible, pas de schéma DB, pas d'impact tiers.

**Cycle Conception pour M :**
- Tous les éléments L +
- Modèle de données logique (ERD) pour les nouvelles entités
- Contrat API (OpenAPI) pour les nouveaux endpoints
- Critères de testabilité explicites
- STRIDE light (15-30 min) : identifier les menaces critiques sur les nouveaux flux
- Plan d'observabilité léger (quels logs, quelles métriques)

**Durée cible :** 2 à 8 heures.

**Artefacts :** ADR(s), C4 niveaux 2-3, modèle de données, contrat API, threat model léger, critères testabilité.

### 8.4 Classe H — High

**Exemples :** touche authentification, autorisation, paiement, données personnelles, schéma DB, API publique, infra de production.

**Cycle Conception pour H :**
- Tous les éléments M +
- Threat model STRIDE complet (90 min) avec toutes les menaces documentées et mitigations planifiées
- AIPD/DPIA si données personnelles (méthode CNIL, 7 étapes)
- Architecture de sécurité complète (auth, authz, secrets, audit trail)
- SLO/SLI définis avec error budget calculé
- Estimation FinOps (coût mensuel régime de croisière)
- PoC si risque architectural non résolu
- Revue Conception par un pair (ou agent IA antagoniste en mode solo)
- Plan de migration expand/contract si schéma DB

**Durée cible :** 1 à 3 jours.

**Checkpoint humain obligatoire :** en mode auto, les décisions H doivent être validées par le développeur avant que l'agent commence Build. Format : proposition Architecture (problème, alternatives, décision, critère de succès, classe de risque).

### 8.5 Classe C — Critique

**Exemples :** impact transverse multi-services, données de santé/biométrie/financières, refonte d'architecture, rupture de contrat API, exigence réglementaire (RGPD, EAA, NIS2, DORA financier).

**Cycle Conception pour C :**
- Tous les éléments H +
- arc42 complet (12 sections) avec C4 niveaux 1-2-3
- Threat model STRIDE + LINDDUN (pour menaces privacy)
- AIPD/DPIA obligatoire (si PII)
- Revue de sécurité par expert externe ou processus de revue formelle
- Validation Strangler Fig : le changement C doit être décomposé en une séquence de changements L/M via Strangler Fig ou Branch by Abstraction
- Prototype ou PoC validé avant toute implémentation Build
- Checkpoint humain obligatoire + ratio de rejet mental ≥ 20 % (anti rubber-stamp)

**Durée cible :** 3 à 10 jours.

**Règle invariante :** aucun démarrage de Build sur un changement C sans que l'architecture soit validée par le développeur. En mode bypass, c'est interdit absolument.

---

## 9. Sous-cycle fractal — 7 étapes

Chaque cycle de la pipeline fractale v4 suit le même sous-cycle universel à 7 étapes. Voici leur application concrète au cycle Conception.

### 9.1 Observer

**But :** comprendre l'état actuel avant de concevoir.

**Activités :**
- Lire les ADR existants — identifier ceux qui seront affectés par ce changement
- Analyser le C4 actuel (niveaux 1-2) — identifier les composants touchés
- Inventorier les dépendances (bibliothèques, services externes) — vérifier SCA (Software Composition Analysis) : licences, CVE ouvertes
- Lire les postmortems et rétrospectives des cycles précédents — patterns d'incidents répétitifs = contraintes architecturales

**Artefacts :** liste des ADR impactés, liste des composants C4 touchés, rapport SCA initial.

### 9.2 Define

**But :** formuler les contraintes et objectifs architecturaux.

**Activités :**
- Identifier les Quality Attribute Requirements (QAR) prioritaires pour ce changement (3-5 depuis ISO 25010:2023)
- Définir les sensitivity points et trade-off points (ATAM)
- Formuler les contraintes architecturales non négociables (stack imposée, contraintes réseau, compliance)
- Identifier les risques architecturaux non résolus → candidats PoC

**Artefacts :** liste QAR prioritaires avec seuils, liste des contraintes, liste des risques candidats PoC.

### 9.3 Design

**But :** produire les livrables architecturaux.

**Activités :**
- Produire les diagrammes C4 (niveau adapté à la classe de risque)
- Rédiger les ADR pour chaque décision structurante
- Modéliser les données (ERD logique)
- Définir les contrats API (OpenAPI / AsyncAPI)
- Réaliser le threat model STRIDE (si M+)
- Concevoir l'architecture de testabilité (ports/adapters, interfaces, fakes)
- Lancer le(s) PoC si risques architecturaux non résolus

**C'est le cœur du cycle.** Les activités précédentes (Observer, Define) et suivantes (Execute, Verify) sont au service de cette étape.

### 9.4 Execute

**But :** finaliser et valider les livrables architecturaux produits.

**Activités :**
- Terminer les PoC et documenter les résultats
- Valider les contrats API avec des exemples réels (mocks, tests de validité du schéma)
- Vérifier la cohérence entre C4, ADR, modèle de données et contrats API
- Pousser les menaces STRIDE dans le backlog avec priorité

**Durée :** proportionnelle à la classe de risque (voir §8).

### 9.5 Verify

**But :** confirmer que les artefacts produits permettent de démarrer Build sans ambiguïté.

**Checklist de vérification Conception :**
- [ ] Tous les use cases du scope peuvent être tracés à une décision architecturale
- [ ] Aucun "on verra en Build" sur un sujet H/C sans ADR explicite + owner
- [ ] Les quality gates CI sont définis (pas seulement "les tests passeront")
- [ ] Un agent IA en mode auto peut démarrer Build avec ces artefacts sans poser de question architecturale
- [ ] Les ADR ont été révisés pour cohérence mutuelle (pas de contradiction entre ADR-001 et ADR-003)
- [ ] Le threat model a des mitigations dans le backlog, pas juste des menaces listées

### 9.6 Capitalize

**But :** extraire les apprentissages architecturaux pour les cycles futurs.

**Activités :**
- Mettre à jour le glossaire du domaine (Ubiquitous Language) avec les nouveaux termes apparus en Conception
- Documenter les alternatives rejetées dans les ADR (valeur pour les nouvelles personnes qui rejoignent le projet)
- Identifier les patterns architecturaux réutilisables (→ `docs/07-architecture/patterns/`)
- Documenter les dettes architecturales acceptées (→ `.planning/02-backlog/tech-debt/`)

### 9.7 Transmit

**But :** s'assurer que le cycle Build a tout ce dont il a besoin.

**Activités :**
- Mettre à jour le dashboard `.planning/00-dashboard/current-status.md`
- Écrire le brief de transmission Build : "voici l'architecture, voici les ADR, voici les contraintes, voici les quality gates"
- Identifier les décisions ouvertes résiduelles avec owner et date de résolution
- Archiver les PoC dans `.planning/spikes/`

---

## 10. Activités transversales

Ces activités ne sont pas des phases séquentielles — elles imprègnent toute la Conception.

### 10.1 Sécurité shift-left

La Conception est le moment le moins coûteux pour intégrer la sécurité. Coût d'une faille corrigée en Conception : 1x. En Build : 6x. En Validation : 15x. En Production : 60x (NIST, données confirmées par plusieurs études de coût de remédiation).

**Actions continues en Conception :**
- SCA sur les dépendances envisagées : vérifier CVE et licences AVANT de les adopter
- Revue des ADR avec regard sécurité : chaque décision architecturale a un implication sécurité
- STRIDE déclenché dès qu'un nouveau flux apparaît, même partiel

### 10.2 Privacy by Design

La DPIA (AIPD) doit être déclenchée **avant** la mise en œuvre du traitement (RGPD art. 35). La Conception est le dernier moment légalement conforme pour le faire.

**Actions continues en Conception :**
- Pour chaque nouvelle entité de données : identifier la classification (PII, données sensibles, données de santé)
- Durée de conservation définie par entité dès le modèle logique
- Minimisation by design : supprimer tout attribut du modèle sans use case justifié
- Pseudonymisation planifiée pour les logs et l'observabilité

### 10.3 FinOps

**Actions continues en Conception :**
- Estimer le coût par composant majeur (cloud, LLM si applicable, observabilité)
- Identifier les hot paths (chemins de requête fréquents) et planifier le caching en conséquence
- Anti-pattern : concevoir sans penser au coût de l'observabilité (5-15 % du coût cloud typiquement)

### 10.4 Accessibilité et i18n by Design

En Conception, définir :
- Architecture front : composants accessibles dès leur conception (sémantique HTML, rôles ARIA si nécessaire)
- i18n : système d'extraction des chaînes défini (i18next, FormatJS, etc.) — aucune chaîne hardcodée dans les contrats d'interface

---

## 11. Artefacts produits

### 11.1 Artefacts principaux

| Artefact | Emplacement | Format | Classe déclenchante |
|---|---|---|---|
| Diagrammes C4 (niveaux 1-3) | `docs/07-architecture/c4/` | Structurizr DSL ou Mermaid | L+ |
| ADR(s) | `docs/07-architecture/decisions/ADR-NNN.md` | MADR 4.0 | L+ si décision structurante |
| arc42 document | `docs/07-architecture/arc42.md` | Markdown 12 sections | C |
| Modèle de données logique (ERD) | `docs/06-data/data-model.md` | Mermaid ERD | M+ |
| Contrats API (OpenAPI / AsyncAPI) | `contracts/` | YAML OpenAPI 3.1+ | M+ |
| Threat model STRIDE | `.planning/security/threat-model-[feature].md` | Tableau Markdown | M+ |
| AIPD/DPIA | `docs/09-security-compliance/dpia-[feature].md` | Méthode CNIL 7 étapes | H si PII / C |
| Rapport PoC | `.planning/spikes/poc-[date]-[slug]/README.md` | Markdown | si risque architectural |
| Plan SLI/SLO | `docs/11-operations/slo-[service].md` | Markdown + formules | M+ |
| Estimation FinOps | `.planning/00-dashboard/finops-estimate.md` | Tableau Markdown | H+ |

### 11.2 Mises à jour déclenchées par Conception

| Fichier mis à jour | Condition |
|---|---|
| `.planning/00-dashboard/current-status.md` | À chaque étape du sous-cycle |
| `.planning/02-backlog/` | Ajout des mitigations STRIDE, dettes architecturales |
| `.planning/08-risks/technical-risks/` | Risques architecturaux identifiés |
| `.planning/09-logs/decision-log.md` | Chaque ADR créé ou modifié |
| `docs/07-architecture/patterns/` | Patterns réutilisables identifiés |

### 11.3 Ce qui N'est PAS produit en Conception

- Migrations SQL concrètes (→ Build)
- Code d'implémentation des adapters (→ Build)
- Configurations d'infrastructure (→ Build / Release)
- Tests automatisés (définis en Conception, écrits en Build)
- Runbooks opérationnels (→ Build / Run)

---

## 12. Métriques et indicateurs

### 12.1 Métriques de qualité de la Conception elle-même

| Métrique | Cible | Mode de mesure |
|---|---|---|
| Taux de couverture use cases → ADR | 100 % pour H/C | Revue manuelle ou script de traçabilité |
| Nombre d'ADR sans alternatives documentées | 0 | Linting Markdown sur le template MADR |
| Menaces STRIDE sans mitigation dans backlog | 0 pour High/Critical | Revue threat model |
| Ratio PoC réalisés / PoC identifiés nécessaires | 100 % avant démarrage Build | Dashboard |
| Durée du cycle Conception vs classe risque | T<5min, L<2h, M<8h, H<3j, C<10j | Métadonnées sprint |

### 12.2 Indicateurs de qualité des artefacts

| Indicateur | Seuil d'alerte | Seuil bloquant |
|---|---|---|
| ADR sans statut | > 0 | n/a |
| ADR "Proposed" depuis > 5 jours | > 2 | > 5 |
| Contrat API sans exemples de réponse | > 20 % des endpoints | > 50 % |
| Entités sans durée de conservation (si PII) | > 0 | > 0 |
| Composants sans critères de testabilité (M+) | > 10 % | > 30 % |

### 12.3 DORA — impact de la Conception sur les métriques DORA 2024/2025

La Conception de qualité est un prédicteur direct de la stabilité DORA :

| Métrique DORA | Impact d'une mauvaise Conception |
|---|---|
| **Change Lead Time** | Refactoring architectural en Build = lead time × 3-5x |
| **Change Failure Rate** | Threat model absent en Conception = source #1 d'incidents de sécurité en prod |
| **Failed Deployment Recovery Time** | Plan de rollback absent en Conception = recovery time imprévisible |
| **Rework Rate** (nouveau 2024) | Architecture mal conçue = rework rate élevé en Build + Validation |

Source : DORA 2024 State of DevOps Report (dora.dev/research/2024/dora-report/)

### 12.4 Indicateurs ISO 25010:2023 à définir en Conception

Pour chaque projet, instancier le Quality Model en sélectionnant 3-5 caractéristiques prioritaires avec seuils mesurables. Exemple pour un système à forte contrainte de sécurité :

```
Priorité 1 — Sécurité : 0 CVE Critical en prod, 0 secret en repo, OWASP ASVS L2
Priorité 2 — Fiabilité : disponibilité ≥ 99.9 %, Recovery Time ≤ 1h
Priorité 3 — Maintenabilité : complexité cognitive ≤ 15, couverture tests zones critiques ≥ 80 %
Priorité 4 — Performance : p99 latency ≤ 200 ms, throughput ≥ 1000 req/s
Priorité 5 — Interaction capability : conformité WCAG 2.2 AA (axe-core vert + 3 parcours manuels)
```

---

## 13. Standards de référence

| Domaine | Standard | Version | Source |
|---|---|---|---|
| Qualité produit | ISO/IEC 25010 | 2023 | iso.org/standard/78176.html |
| Architecture documentation | C4 Model | 2024 | c4model.com |
| Architecture documentation | arc42 | 8.x | arc42.org |
| ADR format | MADR | 4.0.0 (2024-09-17) | adr.github.io/madr/ |
| Threat modeling | STRIDE | Microsoft (itératif) | owasp.org/www-community/Threat_Modeling_Process |
| Privacy threat modeling | LINDDUN | v2 | linddun.org |
| Sécurité cycle | NIST SSDF | SP 800-218 v1.1 (v1.2 en draft) | csrc.nist.gov/pubs/sp/800/218/final |
| Sécurité applicative | OWASP ASVS | v5 | owasp.org |
| Sécurité conception | OWASP Secure by Design | 2024 | owasp.org/www-project-secure-by-design-framework/ |
| Privacy | RGPD art. 25, 35 | 2016/679 | eur-lex.europa.eu |
| Privacy méthode | CNIL Guide PIA | 2024 | cnil.fr |
| Accessibilité | WCAG 2.2 AA | Oct 2023 | w3.org/TR/WCAG22 |
| Accessibilité UE | EAA / Directive 2019/882 | En vigueur 28 juin 2025 | digital-strategy.ec.europa.eu |
| API design | OpenAPI Specification | 3.1.x (3.2 en draft) | spec.openapis.org |
| API async | AsyncAPI | 3.0 | asyncapi.com |
| Domain modeling | DDD (Evans, Vernon) | — | domainlanguage.com |
| Architecture eval | ATAM (SEI CMU) | — | sei.cmu.edu |
| Performance livraison | DORA | 2024/2025 | dora.dev/research/2024/dora-report/ |
| FinOps | FinOps Foundation Framework | 2024 | finops.org |
| Trade-off analysis | ATRAF (2025) | arxiv 2505.00688 | arxiv.org/html/2505.00688v1 |

---

## 14. Questions ouvertes (RED CARDS)

Les RED CARDS sont des questions sans réponse définitive à la date de rédaction de ce document. Elles doivent être résolues avant de clôturer le cycle Conception pour un changement H/C.

### RC-01 — Mécanisation de la classification de risque

**Question :** comment mécaniser la classification T/L/M/H/C pour éviter la subjectivité ?

**Impact si non résolu :** classification floue → mauvaise modulation du cycle → sur-ingénierie sur T ou sous-sécurisation sur H.

**Piste :** arbre de décision déterministe basé sur : fichiers touchés (auth/ → H minimum), présence de migrations DB, présence de données personnelles, nombre de services impactés.

**Owner :** développeur principal
**Deadline :** avant Build du premier sprint H ou C

**Statut :** fermé pour la taxonomie par PFV4 (`RiskClass = T/L/M/H/C`) ; la mécanisation fine reste une amélioration non bloquante.

### RC-02 — Frontières harness pour la phase Conception

**Question :** quelles actions l'agent IA est-il autorisé à prendre SEUL en phase Conception ?

**Proposé :**
- Autorisé seul (bypass) : changements T/L bornés, sans décision H/C ni signal de forçage
- auto : mode autonome par défaut avec checkpoints et validation humaine pour ADR H/C, PoC risqué ou politique projet
- Interdit : modifier `docs/09-security-compliance/` sans review humaine, modifier les quality gates CI

**Impact si non résolu :** soit l'agent est trop limité (ralentit la Conception), soit trop libre (décisions architecturales non validées).

**Owner :** développeur principal
**Deadline :** avant activation du mode auto sur H/C

**Statut :** fermé par PFV4 (`OperatingMode = bypass/auto/pairing`) ; les exemples de permissions restent des politiques projet.

### RC-03 — Format de revue de la Conception en mode solo + IA

**Question :** comment remplacer la revue par un pair humain en mode solo ?

**Piste :** agent IA en rôle antagoniste ("avocat du diable") avec prompt explicite : "joue le rôle d'un architecte senior sceptique. Trouve les failles dans cette conception. Tu as 15 minutes."

**Critère de qualité de la revue IA :** la revue identifie ≥ 3 problèmes potentiels ou confirme qu'aucun problème majeur n'est trouvé avec justification.

**Impact si non résolu :** biais de confirmation — on valide une architecture non challengée.

**Owner :** développeur principal
**Deadline :** avant fin Wave 38 (backlog item existant)

**Statut :** PARTIELLEMENT résolu — le harness a un agent code-reviewer, à étendre pour la revue architecturale

### RC-04 — Seuil de déclenchement AIPD

**Question :** pour un système interne solo sans traitement de données de tiers, quand l'AIPD est-elle obligatoire ?

**Contexte :** RGPD art. 35 déclenche l'AIPD pour les traitements à risque élevé. Pour un harness de développement solo qui ne traite pas de données de tiers, le seuil est probablement non atteint. Mais si le harness traite des logs contenant des données utilisateurs de l'application développée, le seuil peut être atteint.

**Owner :** développeur principal (consultation DPO recommandée si incertitude)
**Deadline :** avant Conception d'un cycle touchant à des données utilisateurs

**Statut :** OUVERT — single source, à vérifier

### RC-05 — Niveaux OWASP ASVS par classe de risque

**Question :** quelle correspondance entre la matrice T/L/M/H/C et les niveaux OWASP ASVS (L1/L2/L3) ?

**Proposition initiale :**
- T/L : ASVS L1 (auto-vérification, liste des exigences de base)
- M : ASVS L1 obligatoire, L2 recommandé pour les composants exposés
- H : ASVS L2 obligatoire
- C : ASVS L3 (vérification par tiers indépendant sur les composants critiques)

**Owner :** développeur principal
**Deadline :** avant Conception du premier cycle H ou C

**Statut :** PROPOSÉ — à valider en pratique

---

## 15. Relations inter-cycles

### 15.1 Ce que Conception reçoit des cycles précédents

**De Discovery :**
- Hypothèses validées sur le problème et les utilisateurs
- Résultat des spikes Discovery (faisabilité technique de haut niveau)
- Contraintes métier non négociables

**De Cadrage :**
- Scope IN/OUT validé
- Classification de risque globale
- Backlog initial avec items DoR
- Performance budget
- Contraintes réglementaires
- Parties prenantes et rôles décision

### 15.2 Ce que Conception envoie aux cycles suivants

**Vers Build :**
- C4 + ADR + modèle de données + contrats API = le "brief d'implémentation"
- Quality gates CI définis pour ce changement
- Critères de testabilité → les tests seront écrits en Build selon ces critères
- Mitigations STRIDE → implémentées en Build
- Plan de rollback esquissé → finalisé en Release

**Vers Validation :**
- Critères d'acceptation architecturaux (depuis les ADR et les contrats API)
- SLO/SLI définis → validés en Validation
- Threat model → tests de sécurité (DAST, pentest léger) en Validation

**Vers Run :**
- Plan d'observabilité (SLI/SLO, alerting) → activé en Run
- Architecture de sécurité → monitoring en Run

**Vers Apprentissage :**
- ADR = mémoire des décisions prises — alimentation de la base de patterns
- Dettes architecturales acceptées = candidats pour un futur cycle de refactoring

### 15.3 Feedbacks inter-cycles que Conception doit traiter

**Depuis Apprentissage (cycle précédent) :**
- Patterns d'incidents architecturaux → contraintes à intégrer en Conception
- ADR invalidés par l'expérience → décisions à réouvrir

**Depuis Build (en cours) :**
- Si un développeur/agent découvre en Build qu'une décision architecturale est erronée → promotion de classe + retour en Conception (pas de correctif architectural silencieux en Build)

**Depuis Validation :**
- Si un test révèle une faille architecturale → retour en Conception pour révision ADR + re-modélisation partielle

### 15.4 Strangler Fig et promotion de classe inter-cycles

Un changement C doit être décomposé en séquence de changements L/M via le pattern Strangler Fig. Cette décomposition se fait **en Conception**, pas en Build.

**Processus :**
1. Identifier la frontière entre l'ancien et le nouveau (façade de routage)
2. Concevoir la migration progressive case par case
3. Chaque cas migré est un changement L/M indépendant avec son propre sous-cycle
4. Le changement C n'est clôturé que quand tous les cas sont migrés et l'ancien supprimé

Référence : rapport-discovery-cadrage.md §3.5 — Décision Strangler Fig validée en Discovery.

---

## Annexe A — Checklist rapide Conception par classe de risque

### Pour T
```
[ ] Le changement ne touche pas d'interface publique, d'API, de schéma DB, d'auth
[ ] Quality gates CI déjà couverts par la config existante
[ ] Commentaire PR : "Pas d'impact architectural"
```

### Pour L
```
[ ] Compatibilité vérifiée avec C4 niveau 2 existant
[ ] ADR créé si nouvelle décision structurante
[ ] Quality gates CI définis pour ce changement
[ ] Critères de testabilité définis
```

### Pour M
```
[ ] C4 niveaux 2-3 mis à jour
[ ] ADR(s) rédigés
[ ] Modèle de données logique (ERD)
[ ] Contrats API (OpenAPI)
[ ] STRIDE léger (15-30 min) sur nouveaux flux
[ ] Critères de testabilité explicites
[ ] Plan SLI/SLO esquissé
[ ] Estimation FinOps si applicable
```

### Pour H
```
[ ] Tout M +
[ ] Threat model STRIDE complet (90 min)
[ ] AIPD déclenchée si PII
[ ] Architecture de sécurité (auth, authz, secrets, audit trail)
[ ] SLO/SLI définis avec error budget calculé
[ ] Estimation FinOps obligatoire
[ ] PoC si risque architectural non résolu
[ ] Plan migration expand/contract si schéma DB
[ ] Checkpoint humain avant démarrage Build
[ ] Revue antagoniste (pair ou agent IA)
```

### Pour C
```
[ ] Tout H +
[ ] arc42 complet (12 sections)
[ ] Threat model STRIDE + LINDDUN
[ ] AIPD obligatoire
[ ] Revue sécurité formelle
[ ] Décomposition Strangler Fig validée
[ ] PoC / prototype validé
[ ] Checkpoint humain + ratio rejet ≥ 20 %
[ ] Aucun démarrage Build sans validation développeur
```

---

## Annexe B — Template ADR MADR 4.0 complet

```markdown
---
status: "proposed"
date: AAAA-MM-JJ
decision-makers: [liste des décideurs]
consulted: [personnes consultées]
informed: [personnes informées]
---

# ADR-NNN — [Titre court de la décision]

## Contexte et problème

[Décrivez le contexte et le problème. Pourquoi cette décision est-elle nécessaire ?]

## Facteurs de décision

* [Facteur 1 — contrainte, exigence, risque]
* [Facteur 2]
* ...

## Options considérées

* Option A — [Titre]
* Option B — [Titre]
* Option C — [Titre]

## Décision retenue

**Option A**, parce que [justification basée sur les facteurs de décision].

## Conséquences

### Positives
* [Conséquence positive]

### Négatives / trade-offs
* [Conséquence négative ou trade-off accepté]

### Neutres
* [Information contextuelle]

## Validation

[Comment vérifier que cette décision est correctement implémentée ?]

## Pros et Cons des options

### Option A — [Titre]

* ✅ [Avantage]
* ✅ [Avantage]
* ❌ [Inconvénient]

### Option B — [Titre]

* ✅ [Avantage]
* ❌ [Inconvénient]
* ❌ [Inconvénient]

### Option C — [Titre]

* ✅ [Avantage]
* ❌ [Inconvénient]

## Liens

* [Lien vers ADR précédent si supersedes/related]
* [Lien vers issue tracker]
* [Lien vers documentation externe]
```

---

*Document produit en Conception du cycle 03 — Pipeline fractale v4.*
*Versionner dans `docs/cycles/03-conception/concepts-criteria.md`.*
*Réviser à chaque évolution majeure de la pipeline ou des standards de référence.*

---

## Sources

- [ISO/IEC 25010:2023 — Software Product Quality Model](https://www.iso.org/standard/78176.html)
- [DORA 2024 State of DevOps Report](https://dora.dev/research/2024/dora-report/)
- [DORA Metrics History](https://dora.dev/insights/dora-metrics-history/)
- [NIST SP 800-218 SSDF v1.1](https://csrc.nist.gov/pubs/sp/800/218/final)
- [NIST SP 800-218 Rev.1 Draft (v1.2)](https://csrc.nist.gov/pubs/sp/800/218/r1/ipd)
- [OWASP Secure by Design Framework](https://owasp.org/www-project-secure-by-design-framework/)
- [OWASP Threat Modeling Process](https://owasp.org/www-community/Threat_Modeling_Process)
- [Architectural Decision Records — adr.github.io](https://adr.github.io/)
- [MADR 4.0 — Markdown Architectural Decision Records](https://adr.github.io/madr/)
- [Martin Fowler — Architecture Decision Record](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html)
- [AWS ADR Best Practices (mars 2025)](https://aws.amazon.com/blogs/architecture/master-architecture-decision-records-adrs-best-practices-for-effective-decision-making/)
- [C4 Model — c4model.com](https://c4model.com/faq)
- [arc42 — Principles of Technical Documentation](https://arc42.org/principles-of-technical-documentation)
- [arc42 + C4 combined example](https://bitsmuggler.github.io/arc42-c4-software-architecture-documentation-example/)
- [ISO/IEC 25010:2023 Update — arc42 Quality Model](https://quality.arc42.org/articles/iso-25010-update-2023)
- [ATRAF — Architecture Tradeoff and Risk Analysis Framework (2025)](https://arxiv.org/html/2505.00688v1)
- [SEI ATAM Collection](https://www.sei.cmu.edu/library/architecture-tradeoff-analysis-method-collection/)
- [Design for Testability — InfoQ](https://www.infoq.com/articles/Testability/)
- [OpenAPI Specification v3.2.0](https://spec.openapis.org/oas/v3.2.0.html)
- [Contract-First API Design](https://treblle.com/knowledgebase/design-phase/contract-definition-using-openapi-specification)
- DDD Aggregate Design — Martin Fowler reference
- [DDD Beyond Basics — SSENSE Tech](https://medium.com/ssense-tech/ddd-beyond-the-basics-mastering-aggregate-design-26591e218c8c)
- [2025 DORA State of AI-Assisted Software Development](https://cloud.google.com/devops/state-of-devops)
- [PoC Success Criteria — diceus.com](https://diceus.com/poc-success-criteria/)
- rapport-discovery-cadrage.md (source de vérité interne — 2026-05-02)
- compass_artifact_wf-049348c3 (cycle qualité v3 interne)
- folder.md (architecture .planning/ interne)
