# 0003 — Restructure v2 : « le mélange des trois »

- Status: **accepted** — 2026-06-11 (approbation fondateur explicite en session : « ok then done » + « ultra goal setup it », après lecture A→Z de la proposition)
- Criticality: [CRITICAL][BLOCKS:critical]
- Source: `.planning/restructure/PROPOSITION.md` (sections 1–12) ; interview `.omc/specs/deep-interview-hima-positioning.md` (3 rounds + revue)

## Décision

hima est restructuré sur la branche longue `restructure/v2` comme **le mélange de trois sources** :

1. **Profils OMO-style** (oh-my-openagent) — système de profils d'agents (prompts par profil, variants par modèle), boucle plan/boulder, AGENTS.md par dossier, rules-engine d'injection par chemin, /commandes + magic-words stricts — **réimplémentés, jamais copiés** (voir Contrainte légale).
2. **Behaviors agent-runtime** — les comportements attendus (criticality T/L/M/H/C, protocole par niveau de risque, verify obligatoire en fin de tâche) **enforced en code par hooks**, plus jamais en prompt advisory (adhérence mesurée ~0% sans hook, ADR-0017 agent-runtime).
3. **Hermes Agent comme premier adapter/runtime cible** (devant Claude Code et Codex) — plugin pre_tool_call bloquant + pre_llm_call injection.

Le cycle orchestré est le **SDLC complet** : analyse → spécification → design → implémentation ⇄ test → maintenance/feedback (déploiement hors v0.1). project-disciplines et project-init s'intègrent dans hima comme fonctionnalités.

Stack : **pnpm/vitest** (continuité du code rapatrié). Architecture : coupe OMO **core pur TS / adapters couplés** (PROPOSITION.md §1). Rapatriement sélectif depuis l'ancien hima selon la table de verdicts (§8) : risk-classifier et behavior-registry tel quel ; ledger simplifié (sha256 chain sans ed25519 par entrée) ; dispatch gates réécrit fichier-par-gate ; state-machine macro-cycles **différée** (pas abandonnée). Les docs v1 sont archivés sous `docs/archive-v1/` (déplacement, pas suppression) ; restent vivants : `vision.md`, `goals/`, `decisions/`.

## Rationale (tracée)

- Verbatim fondateur (interview Round 1–4, 2026-06-11) : « hima va être le mélange de tout ça », « le premier adaptateur qui va vraiment bien marcher, c'est Hermès », « on va l'appliquer vraiment dans le code », « le plus rapidement et le plus simplement possible, après on itère ».
- Évidence agent-runtime ADR-0017 : règles advisory en prompt ≈ 0% d'adhérence ; seuls les hooks mécaniques tiennent — d'où behaviors enforced en code.
- Évidence lanes d'extraction (4 rapports, `.planning/restructure/lanes/`) : mécanismes OMO documentés finement (reproductibles sans copie) ; surface Hermes confirmée (17 hooks, pre_tool_call bloquant) ; 67 comportements agent-runtime classés ; triage de l'ancien hima par composant.
- Bug vécu en session (hook Stop bouclant sur des évidences non applicables en risque T) : diagnostiqué comme désynchronisation policy déclarative / code (`baseline-policy.ts` jamais lu par `evaluateStop()`) — la réécriture fichier-par-gate le corrige structurellement.

## Contrainte légale [CRITICAL][BLOCKS:critical]

oh-my-openagent est sous **Sustainable Use License (SUL-1.0)** — fair-code, non-commercial. Incompatible avec la cible hima (MIT + offre payante). **Aucun code OMO n'est copié** ; seuls les patterns/mécanismes sont réimplémentés depuis les rapports d'extraction.

## Alternatives considérées

1. **Restructure en place du repo v1** — rejetée : plus lente, le poids de la sur-ingénierie v1 (DDD sans consommateur, state-machine 8 macro-cycles) freine le « rapide et simple » demandé.
2. **Fork/copie d'OMO + renommage** — rejetée : licence SUL-1.0 l'interdit pour un produit commercial, et la différenciation de hima (behaviors enforced + gouvernance criticality) n'y serait pas.
3. **Rester couche au-dessus de Claude Code d'abord** — rejetée par le fondateur : Hermes est désigné premier adapter ; Claude Code est rapatrié en l'état comme adapter secondaire.

Falsifies-If:
  kill-condition: Après livraison de la Wave 3 (vertical Hermes), le fondateur n'utilise pas hima quotidiennement sur Hermes pendant 2 semaines consécutives.
  checkpoint-date: 2026-07-15
  evidence-anchor: .omc/ultragoal/ledger.jsonl
  on-fail: Retour à l'interview de positionnement avant toute Wave 4 ; re-choisir le vertical.

Falsifies-If:
  kill-condition: La réimplémentation d'un mécanisme OMO dépasse 3× l'estimation de sa wave, ou ≥3 gates portées en code sont inapplicables sur Hermes faute de hooks.
  checkpoint-date: 2026-07-01
  evidence-anchor: .planning/restructure/PROPOSITION.md §4
  on-fail: Re-scoper la wave en ralplan ; réévaluer la prémisse « Hermes premier adapter » contre Claude Code.

## Exécution

Plan durable : `.omc/ultragoal/` (5 stories = waves, ledger append-only). Critères d'acceptation binaires dans `brief.md`. Commits atomiques S ou B (Tidy First). Pas de push sans demande explicite du fondateur.
