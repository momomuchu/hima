# Cycle 07 — Run : Concepts et Critères

> **Statut** : référence architecturale v1.0
> **Date** : 2026-05-03
> **Pipeline fractale v4** — Cycle 7/8
> **Positionnement** : après Release (06), avant Apprentissage (08)
> **Standards de référence** : Google SRE Book + Workbook, DORA 2024/2025, Westrum, OpenTelemetry, FinOps Foundation Framework 2024/2025, ISO/IEC 25010:2023

---

## 1. Résumé exécutif

Le cycle **Run** est la phase d'opérations en production. Une fois un incrément livré via le cycle Release, il entre dans une boucle continue d'observation, de stabilisation et d'optimisation. C'est ici que la qualité abstraite (specs, tests, gates) devient réalité mesurable : un SLO tenu ou brisé, un coût unitaire qui dérive ou se stabilise, un incident qui révèle une fragilité systémique.

En contexte solo + agents IA, le cycle Run présente une tension spécifique : il n'y a ni équipe on-call de rotation, ni NOC dédié. Tout repose sur une **automatisation maximale de la détection** (alertes multi-burn-rate, automated rollback) et une **réponse humaine ciblée** sur les seuls incidents qui nécessitent un jugement. Les runbooks deviennent donc des artefacts critiques — ils remplacent la mémoire collective.

**Trois invariants du cycle Run** :
1. **Observer avant d'agir** — aucune intervention sans signal mesurable (OODA : Observer, Orienter, Décider, Agir).
2. **Error budget comme arbitre** — si le budget est épuisé, les nouvelles features attendent ; la fiabilité prime.
3. **Tout incident génère un test** — chaque défaillance en production doit se traduire en un test qui aurait détecté la cause avant déploiement.

---

## 2. Position dans le pipeline

```
Discovery → Cadrage → Conception → Build → Validation → Release → [RUN] → Apprentissage
                                                                      ↑          ↓
                                                                  Feedback continu
```

Le cycle Run reçoit ses entrées du cycle Release (incrément déployé, canary stabilisé, smoke tests verts). Il alimente le cycle Apprentissage en signaux : métriques DORA mesurées, error budgets consommés, incidents survenus, runbooks mis à jour, coûts observés.

Le Run est le cycle **le plus long** dans le temps : une feature peut rester en Run des mois ou années. C'est aussi le cycle où le coût réel de la dette technique se manifeste (MTTR qui s'allonge, reliability qui dégrade, FinOps qui dérive).

**Flux de données Run ↔ autres cycles** :
- Run → Apprentissage : postmortems, métriques agrégées, coûts réels, patterns récurrents
- Run → Conception : retours sur l'opérabilité, les runbooks manquants, les SLO mal calibrés
- Run → Build : bugs produits par les signaux opérationnels (chaque incident génère un PBI)
- Run → Release : rollback déclenché par burn rate = retour à Release pour re-déploiement

---

## 3. Objectif du cycle

### 3.1 Objectif principal

Maintenir et améliorer en continu la fiabilité, la performance et la maîtrise des coûts du système en production, en générant des signaux exploitables pour les cycles amont.

### 3.2 Objectifs spécifiques

| Objectif | Indicateur de succès |
|----------|---------------------|
| Respecter les SLO définis | Error budget > 0 en fin de fenêtre |
| Détecter les anomalies avant les utilisateurs | Alerte synthétique avant ticket utilisateur |
| Répondre aux incidents avec un MTTR < seuil | FDRT < 1 h pour incidents P1 |
| Maîtriser les coûts en production | Coût unitaire stable ± 10 % vs baseline |
| Capitaliser chaque incident en amélioration | 100 % des incidents P1/P2 → postmortem dans 72 h |
| Maintenir les runbooks à jour | Runbook testé < 30 jours pour chaque alerte P1 |

### 3.3 Ce que le Run n'est pas

- Pas un cycle de développement : aucun nouveau code n'est écrit ici (le code produit en Run va dans un PBI Build).
- Pas un substitut au cycle Validation : les tests de régression ont eu lieu avant.
- Pas une phase terminale : tout signal Run alimente les cycles amont.

---

## 4. Entrées — Definition of Ready (DoR Run)

Un incrément peut entrer en cycle Run seulement si les conditions suivantes sont vérifiées.

### 4.1 Conditions obligatoires (non négociables)

- [ ] Incrément déployé en production (Release DoD verte).
- [ ] Smoke tests post-déploiement passants (parcours critiques validés).
- [ ] SLO définis et instrumentés pour ce service/fonctionnalité (min. 1 SLI → 1 SLO).
- [ ] Alerting configuré avec au minimum une alerte burn-rate (6× sur 1 h ou 14,4× sur 5 min).
- [ ] Runbook existant pour les alertes P1 de ce composant.
- [ ] Rollback plan testé (documenté dans `.planning/04-releases/REL-xxx/rollback-plan.md`).
- [ ] Logs structurés actifs avec trace_id, user_id pseudonymisé.

### 4.2 Conditions souhaitables (M+)

- [ ] Dashboard SLO visible publiquement ou en interne.
- [ ] Budget FinOps établi (coût baseline mesuré sur 7 premiers jours).
- [ ] Profil de charge initiale documenté (p50/p95/p99 latence, RPS baseline).
- [ ] Feature flags configurés pour désactivation rapide si besoin.

### 4.3 Conditions par classe de risque

| Classe | DoR Run minimale |
|--------|-----------------|
| T/F | Logs actifs + 1 alerte de base |
| M | + SLO défini + dashboard |
| É | + multi-burn-rate + runbook testé + budget FinOps |
| C | + SLO interne + SLA externe documentés + on-call plan + chaos test staging |

---

## 5. Sorties — Definition of Done (DoD Run)

Un incrément "sort" du Run actif quand il passe en Run stable (maintenance) ou est remplacé par une nouvelle version. Les sorties du Run vers Apprentissage sont :

### 5.1 Artefacts de sortie obligatoires

- [ ] Métriques DORA mesurées sur la période : FDRT, Change Failure Rate, Deployment Frequency, Change Lead Time.
- [ ] Error budget consommé documenté (% utilisé sur la fenêtre 28 jours ou par période).
- [ ] Postmortem(s) complété(s) pour tout incident P1/P2 (dans les 72 h).
- [ ] Runbooks mis à jour si de nouveaux modes de défaillance ont été découverts.
- [ ] Coût réel vs baseline documenté (FinOps).
- [ ] Synthèse des signaux pour le cycle Apprentissage (`docs/11-operations/run-signals-[date].md`).

### 5.2 Critères de stabilisation (Run actif → Run maintenance)

- Error budget consommé < 30 % sur 3 fenêtres consécutives.
- Aucun incident P1 sur 30 jours.
- Coût unitaire stable ± 5 % sur 30 jours.
- Runbooks à jour et testés.

---

## 6. Concepts clés

### 6.1 OODA Loop — Pilotage opérationnel

Le cycle opérationnel continu suit la **boucle OODA** (John Boyd, adaptée SRE) :

```
Observer  →  Orienter  →  Décider  →  Agir
    ↑                                    |
    └────────────────────────────────────┘
```

- **Observer** : collecter les signaux (métriques, logs, traces, alertes synthétiques, feedback utilisateur).
- **Orienter** : contextualiser — est-ce normal ? dérive ? incident ? régression post-déploiement ?
- **Décider** : rollback ? escalade ? patch ? no-action ?
- **Agir** : exécuter l'action avec traçabilité (runbook suivi, décision horodatée).

En solo, la boucle OODA doit être **largement automatisée** jusqu'à la décision : les alertes orientent, les runbooks décident pour les cas connus, l'humain intervient pour les cas non-couverts.

### 6.2 SLI / SLO / SLA / Error Budget

**Hiérarchie des engagements** (Google SRE Book, ch. 4) :

```
SLA (externe) < SLO interne < SLO de confort
```

- **SLI** (Service Level Indicator) : ratio de bons événements / total événements. Exemples : disponibilité HTTP 2xx/total, latence p99 < 200 ms / total requêtes, fraîcheur des données < 5 min / total écritures.
- **SLO** (Service Level Objective) : cible sur un SLI sur une fenêtre glissante (ex : 99,9 % sur 28 jours). Le SLO *interne* doit être plus strict que le SLA pour créer un buffer.
- **SLA** (Service Level Agreement) : engagement contractuel avec l'utilisateur. Jamais le seul objectif (trop tard pour détecter).
- **Error budget** : 100 % - SLO. Un SLO de 99,9 % sur 28 jours = 40,3 minutes d'indisponibilité autorisée. C'est le carburant pour prendre des risques : si le budget est intact, on peut déployer ; s'il est épuisé, on gèle les features.

**Politique d'error budget** (à déclarer avant tout incident) :
- Budget > 50 % restant → déploiements normaux autorisés.
- Budget entre 20 % et 50 % → déploiements à risque M+ requièrent validation explicite.
- Budget < 20 % → gel des features non-urgentes, focus fiabilité.
- Budget épuisé → arrêt complet des déploiements non-correctifs.

### 6.3 Four Golden Signals (Google SRE)

Pour tout service en production, surveiller :

1. **Latency** : temps de réponse des requêtes réussies ET des erreurs (une erreur rapide est meilleure qu'un timeout lent).
2. **Traffic** : volume de demandes (RPS, messages/s, transactions/s).
3. **Errors** : taux d'erreurs (HTTP 5xx, exceptions non gérées, timeouts).
4. **Saturation** : utilisation des ressources les plus contraintes (CPU, mémoire, connexions DB, file d'attente).

Alternative : modèle **RED** (Rate, Errors, Duration) pour les services orientés requêtes ; **USE** (Utilization, Saturation, Errors) pour les ressources système.

### 6.4 Multi-Burn-Rate Alerting

Stratégie Google SRE Workbook, ch. 5 — évite les faux positifs et les alertes trop tardives :

| Burn rate | Fenêtre | Fenêtre longue | Action | Budget consommé |
|-----------|---------|----------------|--------|-----------------|
| 14,4× | 1 h | 5 min | Page immédiate | 2 % en 1 h |
| 6× | 6 h | 30 min | Ticket priorité haute | 5 % en 6 h |
| 3× | 24 h | 2 h | Notification | 10 % en 24 h |
| 1× | 3 jours | — | Dashboard info | Rythme nominal |

L'alerte se déclenche quand **les deux fenêtres** (courte + longue) dépassent le seuil → évite les pics transitoires.

### 6.5 Gestion des incidents — Adaptation solo

Le modèle Google SRE d'incident management (IC, Comms Lead, Operations Lead) est adapté au contexte solo :

**Rôles solo** :
- Une seule personne cumule IC + Ops Lead.
- Le "Comms Lead" est remplacé par une **status page automatisée** (Betteruptime, Freshstatus, Statuspage.io) avec mise à jour semi-automatique via webhook d'alerte.
- Le journal d'incident est tenu en temps réel dans `.planning/09-logs/incident-[date]-[id].md`.

**Séquence d'incident solo** :
```
1. Alerte reçue → ouvrir le runbook associé
2. Confirmer l'impact (SLO, utilisateurs, données)
3. Mettre à jour la status page (statut : "Investigation")
4. Triage : rollback immédiat OU mitigation OU investigation
5. Action + trace dans le journal d'incident
6. Résolution → status page "Resolved"
7. Postmortem dans les 72 h
```

**Seuils de déclenchement postmortem** (à définir avant tout incident) :
- Indisponibilité user-visible > 5 min (P1) ou > 30 min (P2)
- Perte ou corruption de données (toujours P0)
- Brèche ou near-miss sécurité/privacy
- Dépassement error budget > 50 % en une journée
- Régression DORA (change failure rate > 15 % sur une semaine)
- Dépassement budget FinOps > 20 % vs baseline sur 24 h

### 6.6 Runbooks

Un runbook = un alert. Structure minimale (source : Google SRE Workbook + pratique 2025) :

```markdown
# Runbook : [Nom de l'alerte]

## Métadonnées
- Alert ID : [id]
- SLO impacté : [slo-id]
- Sévérité : P1 / P2 / P3
- Dernière mise à jour : [date]
- Dernière exécution testée : [date]

## Description
Ce que l'alerte signifie et son impact sur les utilisateurs.

## Diagnostic (≤ 5 minutes)
1. Vérifier le dashboard [lien]
2. Requête de log : `[requête exacte]`
3. Métrique à consulter : [métrique]

## Actions (dans l'ordre)
### Action 1 — Mitigation rapide (< 2 min)
[commande exacte ou lien]

### Action 2 — Rollback si Action 1 insuffisante
[procédure rollback]

### Action 3 — Escalade / investigation approfondie
[étapes]

## Résolution
Critères pour clore l'incident.

## Post-action
- Créer le postmortem si P1/P2
- Mettre à jour ce runbook si nouveau mode de défaillance découvert
```

Règle : un runbook non testé depuis 30 jours doit être marqué `STALE`. Les runbooks `STALE` sont des risques opérationnels.

### 6.7 Observabilité — Trois piliers + profiling (OpenTelemetry)

Instrumentation standard : **OpenTelemetry** (CNCF, vendor-neutral). Les trois signaux + profiling continu :

**Logs structurés** (JSON, niveau, champs requis) :
```json
{
  "timestamp": "ISO-8601",
  "level": "INFO|WARN|ERROR",
  "service": "nom-service",
  "trace_id": "W3C TraceContext",
  "span_id": "...",
  "user_id": "pseudonymisé",
  "event": "description_structurée",
  "duration_ms": 0
}
```
Règle : aucune PII en clair dans les logs (RGPD + pseudonymisation obligatoire).

**Métriques** : RED ou Four Golden Signals par service. Conventions de nommage OpenTelemetry (snake_case, unité dans le nom : `http_request_duration_ms`).

**Traces distribuées** : W3C Trace Context par défaut. Corréler trace_id entre logs et traces (OpenTelemetry SDK l'injecte automatiquement). Sampling : 100 % pour les erreurs, 10–20 % pour le trafic nominal (tail-based sampling préféré pour économiser les coûts d'observabilité).

**Profiling continu** : pour les services critiques uniquement (hotspot CPU, allocations mémoire). Outils : Pyroscope, Grafana Pyroscope, Parca.

**Observabilité LLM/IA** (si applicable) :
- Tracer chaque appel : modèle, tokens in/out, coût estimé, latence, cache hit.
- Métriques : taux de cache, coût par feature, taux d'erreur du modèle.
- Outils 2025 : Langfuse, OpenLLMetry, Helicone, Datadog LLM Observability.

### 6.8 FinOps en production

Le cycle Run est le moment où les coûts théoriques (estimés en Conception/Build) deviennent des coûts réels mesurables.

**Cycle FinOps** (FinOps Foundation 2024/2025) : Inform → Optimize → Operate.

**Métriques FinOps Run** :
- Coût unitaire : €/utilisateur actif, €/transaction, €/requête API, €/token LLM.
- Anomalie : coût > X % au-dessus de la baseline sur 24 h (alerte automatique).
- Efficience : cache hit ratio (LLM, CDN), rightsizing CPU/mémoire, unused resources.
- Couverture de tagging : % de ressources cloud taguées (sans tag = sans attribution).

**Leviers d'optimisation en Run** :
1. Caching sémantique LLM (réduction 15–40 % des tokens).
2. Rightsizing mensuel (instances sur-provisionnées).
3. Réservations / savings plans pour la baseline stable.
4. Sampling intelligent des traces (réduit les coûts observabilité à 3–5 % du cloud).
5. Rétention différenciée des logs (hot: 7 j, warm: 30 j, cold: 1 an).
6. Suppression des ressources orphelines (review hebdomadaire).

**FinOps 2025 : scope étendu** — 40 % des équipes gèrent déjà les coûts SaaS en plus du cloud. 98 % gèrent les coûts AI/LLM (vs 31 % en 2024). En solo, le budget LLM est souvent le poste de coût dominant — surveiller en priorité.

### 6.9 Capacity Planning

Objectif : anticiper les besoins en ressources avant d'atteindre la saturation (signal S des Four Golden Signals).

**Méthode simplifiée pour solo** :
1. Mesurer la charge actuelle (p50, p95, p99 latence + RPS + CPU/mémoire).
2. Estimer la croissance (N utilisateurs × facteur de croissance mensuel).
3. Identifier le goulot d'étranglement (composant qui sature en premier).
4. Planifier le scaling avant d'atteindre 70 % de la capacité maximale (marge de sécurité).
5. Documenter dans `docs/11-operations/capacity-plan-[service]-[date].md`.

**Revue de capacité** : mensuelle pour les services à croissance rapide, trimestrielle pour les services stables.

### 6.10 Chaos Engineering — Critères d'adoption

Le chaos engineering en solo n'est pas du chaos aléatoire — c'est une **expérimentation scientifique contrôlée** sur la résilience.

**Principe** : formuler une hypothèse sur le comportement du système sous stress, introduire une défaillance contrôlée, observer si l'hypothèse tient.

**Critères d'adoption par classe de risque** :

| Classe service | Chaos en staging | Chaos en prod | Fréquence |
|---------------|-----------------|---------------|-----------|
| T/F | Non obligatoire | Non | — |
| M | Recommandé | Non | Trimestriel |
| É | Obligatoire | GameDay planifié | Mensuel |
| C | Obligatoire | GameDay obligatoire | Bimensuel |

**Expériences de base pour démarrer** (minimum viable chaos) :
1. Injection de latence sur une dépendance critique (vérifier les timeouts et les fallbacks).
2. Arrêt de service → vérifier que l'alerte se déclenche et que le runbook fonctionne.
3. Panne base de données → vérifier le comportement en lecture seule ou le message d'erreur utilisateur.
4. Dépassement de quota API tiers → vérifier le circuit breaker.
5. Erreur de déploiement → vérifier le rollback automatique.

**Règle invariante** : ne jamais lancer un chaos experiment sans rollback plan testé et alerte active.

### 6.11 Culture Westrum — Adaptation solo

La culture organisationnelle Westrum (générée/bureaucratique/pathologique) est un prédicteur statistique de la performance DORA (DORA Report 2024 : +30 % de performance organisationnelle pour les équipes génératives).

En solo, "l'organisation" est la relation développeur ↔ agent IA ↔ processus.

**Indicateurs de culture générative solo** :
- Les incidents sont analysés comme des défaillances systémiques, jamais comme des fautes personnelles.
- Les runbooks sont mis à jour après chaque incident (pas de sur-place).
- Les signaux négatifs (dégradation SLO, dépassement coûts) sont traités sans délai, pas ignorés.
- Les postmortems sont écrits même quand personne d'autre ne les lira — ils alimentent les cycles Apprentissage.
- Les décisions de Run sont tracées (journal de décision), pas prises en mode "j'ai fait ça et j'ai oublié".

**Anti-indicateurs** (pathologique solo) :
- Ignorer les alertes > 24 h.
- Ne pas écrire de postmortem parce qu'on est seul.
- Fermer un incident "résolu" sans identifier la cause racine.
- Avoir des runbooks non testés depuis > 60 jours.

---

## 7. Critères qualité — ISO/IEC 25010:2023

Les caractéristiques ISO 25010:2023 prioritaires pour le cycle Run :

### 7.1 Reliabilité (Reliability) — Priorité 1

| Sous-caractéristique | Critère Run | Seuil par défaut |
|---------------------|-------------|-----------------|
| Faultlessness | Taux d'erreurs mesurées en production | < 0,1 % des requêtes en erreur |
| Availability | Disponibilité sur 28 jours (SLO) | ≥ 99,9 % (chemin M) |
| Fault tolerance | Comportement en cas de défaillance partielle | Service dégradé ≠ service indisponible |
| Recoverability | FDRT (Failed Deployment Recovery Time) | P1 : < 1 h ; P2 : < 4 h |

### 7.2 Performance efficiency — Priorité 2

| Sous-caractéristique | Critère Run | Seuil par défaut |
|---------------------|-------------|-----------------|
| Time behaviour | Latence p99 en production | < 500 ms (API), < 200 ms (critique) |
| Resource utilization | CPU/mémoire à charge nominale | < 70 % |
| Capacity | Taux de saturation des queues | < 80 % avant scaling |

### 7.3 Security — Priorité 3

| Sous-caractéristique | Critère Run |
|---------------------|-------------|
| Accountability | Tout accès à des données sensibles journalisé avec user_id |
| Integrity | Aucune corruption de données silencieuse (checksums, idempotency) |
| Authenticity | TLS actif partout, certificats valides (alerte 30 j avant expiration) |
| Confidentiality | Aucune PII en clair dans les logs/traces |

### 7.4 Maintainability — Priorité 4

| Sous-caractéristique | Critère Run |
|---------------------|-------------|
| Analysability | Runbooks à jour, traces disponibles pour chaque incident |
| Modifiability | Hotfix déployable en < 2 h via le pipeline normal |
| Testability | Chaque alerte P1 a un chaos test ou un test de regression associé |

### 7.5 Safety (nouveau ISO 25010:2023)

Applicable pour les services avec impact sur des données critiques ou des décisions automatisées :
- Operational constraint : limites de rate-limit et de circuit-breaker documentées.
- Fail safe : comportement en cas de défaillance explicitement défini (fail open vs fail closed).
- Hazard warning : alertes préventives avant saturation des ressources.

---

## 8. Modulation par classe de risque

### 8.1 Tableau de modulation Run

| Activité Run | T | F | M | É | C |
|---|:---:|:---:|:---:|:---:|:---:|
| SLO défini + mesuré | ◔ | ✅ | ✅ | ✅ | ✅ |
| Multi-burn-rate alerting | — | ◔ | ✅ | ✅ | ✅ |
| Dashboard SLO public/interne | — | ◔ | ✅ | ✅ | ✅ |
| Runbook par alerte P1 | — | ✅ | ✅ | ✅ | ✅ |
| Runbook testé < 30 jours | — | ◔ | ✅ | ✅ | ✅ |
| Postmortem sur incident | léger | ✅ | ✅ | ✅ + revue | ✅ + audit |
| Error budget policy actif | — | ◔ | ✅ | ✅ | ✅ |
| Status page mise à jour | — | ◔ | ✅ | ✅ | ✅ |
| FinOps budget alerting | — | — | ◔ | ✅ | ✅ |
| Capacity planning documenté | — | — | ◔ | ✅ | ✅ |
| Chaos experiment staging | — | — | ◔ | ✅ | ✅ |
| Chaos experiment production (GameDay) | — | — | — | ◔ | ✅ |
| On-call plan documenté | — | — | ✅ | ✅ | ✅ |
| FDRT < 1 h (P1) | — | — | ✅ | ✅ | ✅ |
| Revue sécurité post-incident | — | — | ◔ | ✅ | ✅ |

Légende : ✅ obligatoire · ◔ recommandé · — facultatif/skip

### 8.2 Chemins par classe

**T (Trivial)** : monitoring passif (logs actifs, alerte générique), pas de SLO dédié, pas de runbook spécifique. Si un incident survient : correction rapide + note dans le journal.

**F (Faible)** : SLO de base défini, runbook minimal, postmortem léger si incident (journal + cause + correction). Pas de chaos test obligatoire.

**M (Moyen)** : chemin complet Run sans chaos prod. SLO + multi-burn-rate + runbooks testés + postmortem structuré + FinOps baseline. Dashboard de monitoring actif.

**É (Élevé)** : chemin complet + FinOps alerting + capacity planning trimestriel + chaos staging mensuel. Postmortem avec revue de l'architecture de résilience. Error budget policy appliquée strictement.

**C (Critique)** : chemin É + GameDay bimensuel + SLA externe documenté + revue sécurité post-incident + audit indépendant si disponible. L'error budget épuisé déclenche un gel immédiat de tous les déploiements non-correctifs.

---

## 9. Sous-cycle fractal — 7 étapes

Le cycle Run suit le même sous-cycle universel à 7 étapes que tous les autres cycles, appliqué à la boucle opérationnelle.

### Étape 1 — Observer

**Ce qu'on fait** : collecter les signaux en continu — métriques Four Golden Signals, logs structurés, traces distribuées, alertes synthétiques (monitoring actif des parcours critiques depuis l'extérieur), feedback utilisateur.

**Artefacts** : dashboards OpenTelemetry, alertes configurées, synthetic monitoring actif.

**Questions clés** :
- Les SLI sont-ils dans les bornes du SLO ?
- Y a-t-il des anomalies de coût (FinOps) ?
- Y a-t-il des patterns d'erreur inédits dans les logs ?
- Les alertes synthétiques sont-elles vertes ?

**Fréquence** : continue (temps réel pour les métriques critiques), quotidienne pour la revue des tendances.

### Étape 2 — Définir

**Ce qu'on fait** : qualifier l'anomalie ou l'incident — est-ce un bruit de fond normal, une dégradation progressive, un incident actif ? Classifier la sévérité (P0/P1/P2/P3).

**Grille de classification** :

| Niveau | Description | SLO | FDRT cible |
|--------|-------------|-----|-----------|
| P0 | Perte de données, brèche sécurité | Non applicable | Immédiat |
| P1 | Service indisponible pour les utilisateurs | SLO non tenu | < 1 h |
| P2 | Dégradation significative, workaround possible | SLO dégradé | < 4 h |
| P3 | Impact mineur, utilisateurs peu affectés | SLO tenu | < 24 h |
| P4 | Amélioration ou anomalie sans impact immédiat | SLO tenu | Prochain sprint |

**Artefacts** : journal d'incident ouvert, status page mise à jour, estimation d'impact documentée.

### Étape 3 — Concevoir

**Ce qu'on fait** : choisir la stratégie de réponse — rollback, mitigation (feature flag off, rate limit), hotfix, investigation approfondie, no-action (faux positif).

**Arbre de décision rapide** :
```
Incident confirmé
    │
    ├─ Causé par le dernier déploiement ? → Rollback immédiat
    │
    ├─ Feature flag disponible ? → Désactiver la feature
    │
    ├─ Mitigation connue dans le runbook ? → Exécuter le runbook
    │
    ├─ Cause inconnue, données en danger ? → Fail safe (mode dégradé)
    │
    └─ Cause inconnue, pas de données en danger → Investigation + surveillance renforcée
```

**Règle invariante** : toute décision de conception en Run est horodatée dans le journal d'incident.

### Étape 4 — Exécuter

**Ce qu'on fait** : exécuter l'action choisie en suivant le runbook, en traçant chaque commande et son résultat.

**Format de trace d'exécution** :
```
[HH:MM UTC] Action : [description]
[HH:MM UTC] Résultat : [résultat observé]
[HH:MM UTC] Prochain step : [action suivante]
```

**Règle** : aucune commande en production sans trace écrite — même en incident P0. Le stress ne justifie pas l'absence de trace (elle sera nécessaire pour le postmortem).

**Automated rollback** : si l'error budget brûle à > 14,4× sur 5 min, le rollback peut être déclenché automatiquement (CI/CD pipeline + feature flag). L'humain est notifié, pas nécessairement l'exécuteur.

### Étape 5 — Vérifier

**Ce qu'on fait** : confirmer que l'action a résolu l'incident. Vérifier que le SLO est revenu dans les bornes, que les erreurs ont cessé, que les utilisateurs ne sont plus impactés.

**Critères de vérification** :
- Smoke tests synthétiques verts pendant ≥ 5 min consécutives.
- Error rate retombé à < seuil SLO.
- Aucun nouveau signal d'alerte dans les 10 min suivant la résolution.
- Status page mise à jour "Resolved".

**Si la vérification échoue** : retour à l'étape 3 (Concevoir) avec les nouvelles informations collectées.

### Étape 6 — Capitaliser

**Ce qu'on fait** : transformer l'incident en apprentissage durable.

**Pour tout incident P1/P2** : postmortem complet dans les 72 h.

**Structure du postmortem blameless** (source : Google SRE Book + pratique 2025) :
1. TL;DR (≤ 5 lignes : qu'est-ce qui s'est passé, durée, impact).
2. Impact (utilisateurs, durée, données, revenus si pertinent).
3. Timeline (UTC, sources horodatées : alerte → première réponse → mitigation → résolution).
4. Cause racine (5 Whys ou arbre de causalité — systémique, pas individuelle).
5. Ce qui a bien fonctionné.
6. Ce qui n'a pas fonctionné.
7. Où on a eu de la chance (zones de fragilité non manifestées ce coup-ci).
8. Action items (propriétaire unique, date, définition of done).

**Règle blameless** : remplacer "X a fait erreur" par "le processus ne protège pas contre cette erreur". Le correctif est systémique, pas disciplinaire.

**Pour tout incident P3/P4** : note courte (3-5 lignes) dans le journal d'incident + mise à jour du runbook si nécessaire.

**Test de non-régression** : tout incident P1/P2 génère un test qui aurait détecté la cause avant déploiement → ce test est ajouté au pipeline CI.

### Étape 7 — Transmettre

**Ce qu'on fait** : synthétiser les signaux Run pour les cycles amont (Apprentissage, Conception, Build).

**Artefacts de transmission** :
- `docs/11-operations/run-signals-[YYYY-MM].md` : synthèse mensuelle des métriques, incidents, coûts.
- PBI(s) créés dans le backlog Build pour les correctifs identifiés.
- Mise à jour des SLO si la calibration s'avère incorrecte (SLO trop strict = burnout opérationnel ; SLO trop laxe = incidents cachés).
- Feedback sur l'opérabilité vers le cycle Conception (runbooks impossibles à suivre → simplification de l'architecture).

**Fréquence de transmission** : mensuelle (Run stable) ou ad hoc (incident majeur).

---

## 10. Activités transversales

Ces activités sont continues dans le cycle Run — elles ne s'arrêtent pas entre les incidents.

### 10.1 Surveillance continue

- Métriques Four Golden Signals en temps réel (dashboard toujours visible).
- Alertes synthétiques sur les parcours critiques (fréquence : toutes les 5 min minimum).
- SLO burn rate calculé sur fenêtre glissante (28 jours recommandé).
- Revue quotidienne des logs d'erreur (5-10 min : filtrer `level=ERROR` + nouveaux patterns).

### 10.2 Gestion des on-call en solo

En solo, "on-call" signifie que le développeur est le seul point d'escalade. Règles pour éviter le burnout :

- **Heures silencieuses** : définir les plages horaires où les alertes P3/P4 sont supprimées (nuit, week-end).
- **Seuils d'alerte calibrés** : une alerte qui sonne et qui est ignorée est pire que pas d'alerte. Calibrer pour que chaque alerte soit actionnable.
- **Rotation virtuelle** : si un second développeur ou co-fondateur existe, alterner les semaines on-call.
- **Escalade documentée** : définir qui contacter si le développeur solo est inaccessible (même si c'est "personne — le service est en mode dégradé automatique").
- **Budget de charge cognitive** : ≤ 2 incidents actifs en simultané. Au-delà, prioriser et ignorer les P3.

Google SRE Workbook (ch. 11) recommande qu'une rotation on-call ne dépasse pas 25 % du temps de travail hebdomadaire consacré aux incidents, pour éviter la dégradation de la qualité du reste du travail.

### 10.3 Gestion des dépendances tierces

- Surveiller les status pages des dépendances critiques (webhooks ou flux RSS).
- Circuit breaker configuré pour chaque appel externe critique (timeout + retry policy + fallback).
- SLO des dépendances documentés dans le capacity plan (si SLA externe < SLO interne : risque de chaîne).
- Alerte sur l'expiration des certificats TLS (30 jours d'avance minimum).

### 10.4 Sécurité opérationnelle continue

- Rotation des secrets (API keys, tokens) selon leur criticité : critique = trimestrielle, haute = semestrielle.
- Revue des accès IAM/RBAC mensuelle (principe du moindre privilège).
- CVE scan des dépendances en production (Dependabot, Renovate, OSV-Scanner) — alertes automatiques sur Critical/High.
- Logs d'accès aux données sensibles revus hebdomadairement (détection d'anomalies d'accès).

### 10.5 Documentation opérationnelle continue

- Runbooks mis à jour après chaque incident (nouveau mode de défaillance = nouveau runbook ou section).
- ADR opérationnel si une décision d'architecture de résilience est prise (ex : "on adopte le circuit breaker X").
- `CHANGELOG.md` mis à jour si un comportement utilisateur change suite à une correction opérationnelle.

---

## 11. Artefacts produits

| Artefact | Emplacement | Fréquence de mise à jour |
|----------|-------------|--------------------------|
| Dashboard SLO | Outil monitoring (Grafana, Datadog, etc.) | Temps réel |
| Journal d'incident | `.planning/09-logs/incident-[date]-[id].md` | À chaque incident |
| Runbook (par alerte) | `docs/11-operations/runbooks/[alert-id].md` | Après chaque incident ou test |
| Postmortem | `docs/11-operations/postmortems/[date]-[id].md` | Dans 72 h après P1/P2 |
| Synthèse Run mensuelle | `docs/11-operations/run-signals-[YYYY-MM].md` | Mensuelle |
| Capacity plan | `docs/11-operations/capacity-plan-[service]-[date].md` | Trimestrielle |
| Error budget log | `.planning/07-metrics/error-budget-[service].md` | Hebdomadaire |
| FinOps rapport | `.planning/07-metrics/finops-[YYYY-MM].md` | Mensuelle |
| Chaos experiment log | `docs/11-operations/chaos/[experiment-id].md` | Après chaque GameDay |
| Status page | Externe (Betteruptime, Freshstatus) | À chaque incident |

---

## 12. Métriques et indicateurs

### 12.1 Métriques DORA applicables au cycle Run

| Métrique DORA | Mesure dans Run | Seuil "High" 2024/2025 |
|--------------|-----------------|------------------------|
| **Failed Deployment Recovery Time (FDRT)** | Durée incident P1 : alerte → résolution | < 1 jour (High) ; < 1 h (Top 15 %) |
| **Change Failure Rate (CFR)** | % de déploiements ayant causé un incident | < 10 % (High) ; < 5 % (Top 15 %) |
| **Rework Rate** (nouveau 2024) | % du temps passé à corriger des bugs de prod | À mesurer ; suivre la tendance |
| **Reliability** (quasi-métrique) | SLO tenu : % de fenêtres avec error budget > 0 | ≥ 95 % des fenêtres |

Note : DORA 2025 a abandonné le label "Elite" pour une distribution en percentiles. Les seuils ci-dessus correspondent au top 15 % (anciennement "Elite").

### 12.2 Métriques SRE

| Métrique | Formule | Cible par défaut |
|----------|---------|------------------|
| Disponibilité (SLI) | Requêtes 2xx / total requêtes | SLO défini par service |
| Latence p99 | 99e percentile des durées de réponse | < 500 ms (API standard) |
| Error rate | Erreurs 5xx / total requêtes | < 0,1 % |
| Error budget remaining | (1 - SLO%) - erreurs mesurées / période | > 20 % en fin de période |
| MTTR (suivi interne) | Durée moyenne incident P1 résolu | < 1 h |

### 12.3 Métriques FinOps

| Métrique | Calcul | Revue |
|----------|--------|-------|
| Coût par utilisateur actif | Coût total / MAU | Mensuelle |
| Coût par transaction | Coût total / transactions | Hebdomadaire |
| Coût par token LLM | Facture LLM / tokens utilisés | Quotidienne |
| Dérive vs baseline | (Coût actuel - baseline) / baseline | Continue (alerte) |
| Cache hit ratio (LLM) | Hits / (Hits + Misses) | Hebdomadaire |

### 12.4 Métriques d'observabilité

| Métrique | Outil | Alerte |
|----------|-------|--------|
| Burn rate SLO | Prometheus / Grafana | Multi-burn-rate (voir §6.4) |
| Anomalie de coût | FinOps platform / alertes cloud | Dérive > 20 % sur 24 h |
| Saturation CPU/mémoire | OpenTelemetry / APM | > 80 % sustained > 5 min |
| Freshness des données | Métrique custom OpenTelemetry | Selon SLO défini |
| Expiration certificat | Prometheus blackbox / alerte | 30 jours avant expiration |

### 12.5 Métriques culture Westrum (adaptation solo)

Indicateurs proxy pour une culture générative solo :

| Indicateur | Mesure | Cible |
|-----------|--------|-------|
| % d'incidents avec postmortem | Postmortems P1/P2 / incidents P1/P2 | 100 % |
| Délai postmortem | Date postmortem - date résolution | < 72 h |
| % runbooks testés | Runbooks testés < 30 j / total runbooks P1 | > 90 % |
| Action items postmortem complétés | Actions fermées / actions ouvertes | > 80 % dans les 30 j |
| FDRT tendance | Comparaison FDRT mois N vs mois N-1 | Décroissant ou stable |

---

## 13. Standards de référence

| Domaine | Standard | Source | Pertinence Run |
|---------|----------|--------|----------------|
| SRE — fondations | Google SRE Book (Beyer et al.) | sre.google | SLI/SLO/error budget — référence principale |
| SRE — pratiques | Google SRE Workbook | sre.google/workbook | Multi-burn-rate, on-call, incident management |
| Performance livraison | DORA 2024/2025 | dora.dev | FDRT, CFR, Rework Rate |
| Culture | Westrum (1988, adapté DORA) | dora.dev/capabilities/generative-organizational-culture | Culture générative = prédicteur DORA |
| Observabilité | OpenTelemetry (CNCF) | opentelemetry.io | Standard vendor-neutral |
| Qualité produit | ISO/IEC 25010:2023 | iso.org | Reliability, Safety, Performance efficiency |
| Coûts cloud | FinOps Foundation Framework 2024/2025 | finops.org | Inform→Optimize→Operate |
| Résilience | Chaos Engineering Principles | principlesofchaos.org | Base pour les experiments |
| Postmortem | Google SRE Book ch. 15 + SRE Workbook ch. 10 | sre.google | Blameless, action items SMART |
| Runbooks | SRE Workbook ch. 6 | sre.google | Structure runbook par alerte |
| On-call | SRE Workbook ch. 11 | sre.google | Charge cognitive, rotation, seuils |
| Sécurité opérationnelle | NIST SSDF SP 800-218 — groupe RV | csrc.nist.gov | Respond to Vulnerabilities en prod |
| Tests | ISO/IEC/IEEE 29119 | iso.org | Risk-based testing généré par les incidents |

---

## 14. Questions ouvertes — RED CARDS

Les questions suivantes sont non résolues. Elles doivent être tranchées avant ou pendant le premier cycle Run réel.

### RED-01 : Seuil de déclenchement du postmortem solo

**Question** : en solo, le postmortem est coûteux en temps. Quel est le seuil exact en dessous duquel on écrit une "note d'incident" plutôt qu'un postmortem complet ?

**Options** :
- A : Postmortem complet pour P1 uniquement ; note pour P2/P3.
- B : Postmortem complet pour P1/P2 ; note pour P3.
- C : Postmortem tiré uniquement si l'incident révèle un mode de défaillance inédit.

**Impact si non tranché** : soit surcharge (option B systématique), soit sous-apprentissage (option A trop restrictive).

**Recommandation provisoire** : option A avec une exception : si un P2 révèle un pattern récurrent (3e occurrence), passer en postmortem complet.

### RED-02 : Calibration des SLO avant données de production

**Question** : comment définir les SLO avant d'avoir des données de production réelles ? Un SLO de 99,9 % est-il raisonnable pour un service solo sans infrastructure redondante ?

**Options** :
- A : SLO provisoire de 99 % pendant les 30 premiers jours, puis ajustement basé sur les données.
- B : SLO minimal de 95 % en phase early, escalade progressive.
- C : SLO défini à partir des attentes utilisateurs (si SaaS B2B : SLA négocié avec les clients).

**Impact si non tranché** : risk d'error budget épuisé dès la première semaine si SLO trop ambitieux pour l'infrastructure solo.

**Single source — verify** : aucun consensus clair dans la littérature sur la calibration initiale des SLO en solo.

### RED-03 : Gestion des alertes hors heures ouvrables

**Question** : en solo, recevoir une alerte P2 à 3h du matin est-il acceptable ? Quelle est la politique de suppression nocturne ?

**Options** :
- A : P0 et P1 uniquement en heures creuses (pas de suppression).
- B : Suppression totale des alertes P2/P3/P4 entre 23h et 7h.
- C : Délai d'alerte (P2 : 1 h de délai la nuit, P1 : immédiat).

**Impact** : burnout opérationnel si alertes P2 nocturnes fréquentes ; risque de dégradation silencieuse si suppression trop large.

### RED-04 : Intégration chaos engineering avec le harness

**Question** : comment intégrer les chaos experiments dans le cycle Run fractal ? Doivent-ils déclencher un mini-cycle Run ou être traités comme des activités Validation ?

**Piste** : les chaos experiments en staging → cycle Validation. Les GameDay en production → cycle Run (étape Observer + Vérifier formalisée).

### RED-05 : Seuil d'activation de l'automated rollback

**Question** : à quel burn rate déclencher un rollback automatique sans intervention humaine ?

**Risque rollback automatique** : faux positif → rollback d'un déploiement valide. Faux négatif → incident prolongé.

**Piste** : automated rollback sur burn rate 14,4× sur 5 min uniquement si le déploiement a moins de 30 min (haute probabilité de causalité) + feature flag disponible.

---

## 15. Relations inter-cycles

### 15.1 Run ← Release (entrée)

Le cycle Release transmet :
- L'incrément déployé en production avec smoke tests verts.
- Le plan de rollback testé.
- Les SLO instrumentés (définis en Conception, activés en Release).
- Le périmètre des chaos tests effectués en staging (Release DoD).

**Tension** : si Release a déployé avec un SLO non encore instrumenté (dette opérationnelle), Run commence en mode dégradé. Ce cas doit être tracé comme une dette à résorber dans le prochain sprint Build.

### 15.2 Run → Apprentissage (sortie principale)

Run alimente Apprentissage avec :
- Métriques DORA mesurées (FDRT, CFR, Rework Rate).
- Error budget consommé et tendance.
- Postmortems complétés (causes racines, patterns récurrents).
- Coûts réels vs estimations Conception (FinOps delta).
- Feedback sur l'opérabilité (runbooks difficiles à suivre = signal architectural).

Le cycle Apprentissage ne peut produire d'améliorations pertinentes sans les signaux Run. Apprentissage sans Run = rétrospective sans données = cérémonie stérile.

### 15.3 Run → Build (rétroaction)

Tout incident P1/P2 génère au moins un PBI dans le backlog Build :
- Correctif technique (bug fix).
- Test de non-régression (manquant dans le pipeline CI).
- Amélioration de runbook (transformée en feature d'observabilité).

La classification de risque de ces PBI est au minimum **M** (car provenant d'un incident en production).

### 15.4 Run → Conception (rétroaction architecturale)

Si un même type d'incident se produit > 2 fois malgré les correctifs Build, c'est le signe d'un problème architectural — un PBI Build ne suffit plus. Le signal doit remonter au cycle Conception pour une révision de l'ADR concerné.

Exemples :
- FDRT > 4 h systématique → architecture de résilience insuffisante → ADR "circuit breaker obligatoire".
- Error budget épuisé chaque mois → SLO mal calibré OU architecture de déploiement inadaptée.
- Coût LLM dérivant → architecture de caching ou de routing des requêtes à revoir.

### 15.5 Run ↔ Activités transversales continues

Le cycle Run interagit en permanence avec les activités transversales de la pipeline fractale :
- **Sécurité** : CVE découvertes en prod → SCA automatique → PBI correctif (High : 7 j, Critical : 24 h).
- **FinOps** : anomalie de coût en Run → audit FinOps → optimisation en Build ou Conception.
- **Observabilité** : Run est le bénéficiaire principal — toute dette d'observabilité détectée en Run remonte en Build.
- **Documentation** : runbooks et postmortems sont des artefacts docs (vivants, versionnés en Git).

---

## Sources

- [Google SRE Book — Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) — Beyer et al., Google, 2016 (evergreen)
- [Google SRE Workbook — Implementing SLOs](https://sre.google/workbook/implementing-slos/) — Google, 2018 (evergreen)
- [Google SRE Workbook — Error Budget Policy](https://sre.google/workbook/error-budget-policy/) — Google
- [Google SRE Workbook — On-Call](https://sre.google/workbook/on-call/) — Google
- [Google SRE Workbook — Incident Response](https://sre.google/workbook/incident-response/) — Google
- [DORA — Software Delivery Performance Metrics](https://dora.dev/guides/dora-metrics/) — DORA, 2024/2025
- [DORA — History of DORA Metrics](https://dora.dev/insights/dora-metrics-history/) — DORA, 2024
- [DORA — Accelerate State of DevOps Report 2024](https://dora.dev/research/2024/dora-report/) — DORA, 2024
- [DORA — Generative Organizational Culture](https://dora.dev/capabilities/generative-organizational-culture/) — DORA
- [OpenTelemetry — Observability Primer](https://opentelemetry.io/docs/concepts/observability-primer/) — CNCF, 2025
- [OpenTelemetry — AI Agent Observability](https://opentelemetry.io/blog/2025/ai-agent-observability/) — CNCF, 2025
- [FinOps Foundation — Framework Overview](https://www.finops.org/framework/) — FinOps Foundation, 2024/2025
- [FinOps Foundation — 2025 Framework Updates](https://www.finops.org/insights/2025-finops-framework/) — FinOps Foundation, 2025
- [FinOps Foundation — State of FinOps 2025](https://data.finops.org/2025-report/) — FinOps Foundation, 2025
- [Westrum's Organizational Model in Technology Organizations](https://itrevolution.com/articles/westrums-organizational-model-in-tech-orgs/) — IT Revolution
- [DORA Report 2024 — RedMonk Analysis](https://redmonk.com/rstephens/2024/11/26/dora2024/) — RedMonk, 2024
- [Rootly — SRE Incident Management Best Practices 2025](https://rootly.com/sre/2025-sre-incident-management-best-practices-checklist) — Rootly, 2025
- [incident.io — Complete SRE Tools & Reliability Practices 2026](https://incident.io/blog/sre-tools-reliability-practices-2026) — incident.io, 2026
- [Chaos Engineering — Comprehensive Guide 2024](https://www.chaosfundamentals.com/what-is-chaos-engineering-in-2024-a-comprehensive-guide/) — Chaos Fundamentals, 2024
- [FinOps for SaaS](https://www.finops.org/wg/finops-for-software-as-a-service-saas/) — FinOps Foundation
- rapport-discovery-cadrage.md — SOURCE OF TRUTH interne, 2026-05-02
- compass_artifact_wf-049348c3 — Cycle de développement logiciel piloté par la qualité v3, interne
