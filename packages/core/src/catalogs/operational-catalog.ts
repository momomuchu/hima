import type {
  EvidenceKey,
  GateType,
  MacroCycle,
  OperatingMode,
  RiskClass,
} from "../types/canonical.js";
import { GATE_TYPES, MACRO_CYCLES, OPERATING_MODES, RISK_CLASSES } from "../types/canonical.js";

export type CatalogApplicability = "mandatory" | "optional" | "skipped";

export interface CatalogActivation {
  readonly macroCycles: readonly MacroCycle[];
  readonly gateTypes?: readonly GateType[];
  readonly riskClasses: readonly RiskClass[];
  readonly operatingModes?: readonly OperatingMode[];
  readonly keywords: readonly string[];
  readonly auto: boolean;
}

export interface SkillCatalogEntry {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
  readonly activation: CatalogActivation;
  readonly owns: readonly string[];
  readonly outOfScope: readonly string[];
  readonly evidenceProduced: readonly EvidenceKey[];
  readonly bookRefs: readonly string[];
  readonly subagentRefs: readonly string[];
}

export interface BookCatalogEntry {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
  readonly macroCycles: readonly MacroCycle[];
  readonly gateTypes: readonly GateType[];
  readonly riskClasses: readonly RiskClass[];
  readonly operatingModes: readonly OperatingMode[];
  readonly evidenceKeys: readonly EvidenceKey[];
  readonly skillRefs: readonly string[];
  readonly subagentRefs: readonly string[];
}

export interface SubagentCatalogEntry {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
  readonly spawn: {
    readonly macroCycles: readonly MacroCycle[];
    readonly gateTypes: readonly GateType[];
    readonly minimumRiskClass: RiskClass;
    readonly applicabilityByRisk: Readonly<Record<RiskClass, CatalogApplicability>>;
    readonly operatingModes?: readonly OperatingMode[];
  };
  readonly evidenceProduced: readonly EvidenceKey[];
  readonly bookRefs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly maxParallelSafe: number;
}

export interface OperationalCatalog {
  readonly skills: readonly SkillCatalogEntry[];
  readonly books: readonly BookCatalogEntry[];
  readonly subagents: readonly SubagentCatalogEntry[];
}

const ALL_CYCLES = MACRO_CYCLES;
const ALL_GATES = GATE_TYPES;
const ALL_RISKS = RISK_CLASSES;
const ALL_MODES = OPERATING_MODES;
const GOVERNED_RISKS = ["M", "H", "C"] as const satisfies readonly RiskClass[];
const GOVERNED_MODES = ["auto", "pairing"] as const satisfies readonly OperatingMode[];

const OPERATIONAL_CATALOG = {
  skills: [
    {
      id: "classify-risk",
      title: "Classify Risk",
      purpose: "Assign a canonical T/L/M/H/C risk class and operating mode to each intent.",
      activation: {
        macroCycles: ALL_CYCLES,
        gateTypes: ["session_start", "user_prompt"],
        riskClasses: ALL_RISKS,
        operatingModes: ALL_MODES,
        keywords: ["classify", "risk", "intent"],
        auto: true,
      },
      owns: ["risk classification", "forcing signal scan", "operating mode selection"],
      outOfScope: ["cycle transition", "implementation", "evidence sufficiency evaluation"],
      evidenceProduced: ["confidence_level", "risk_remaining"],
      bookRefs: ["risk-classification"],
      subagentRefs: [],
    },
    {
      id: "propose-change",
      title: "Propose Change",
      purpose: "Convert a classified request into scoped objective, exclusions, and done criteria.",
      activation: {
        macroCycles: ALL_CYCLES,
        gateTypes: ["user_prompt"],
        riskClasses: ALL_RISKS,
        operatingModes: ALL_MODES,
        keywords: ["propose", "change", "feature", "fix"],
        auto: true,
      },
      owns: ["intent set", "scope in/out", "definition of done", "cycle routing"],
      outOfScope: ["code changes", "deployment", "subagent execution"],
      evidenceProduced: ["files_modified", "known_gap"],
      bookRefs: ["state-machine", "gate-policy"],
      subagentRefs: [],
    },
    {
      id: "transition-phase",
      title: "Transition Phase",
      purpose: "Guard cycle movement with state-machine and evidence checks.",
      activation: {
        macroCycles: ALL_CYCLES,
        gateTypes: ["post_tool", "stop"],
        riskClasses: GOVERNED_RISKS,
        operatingModes: GOVERNED_MODES,
        keywords: ["advance", "next cycle", "promote", "transition"],
        auto: true,
      },
      owns: ["state transition", "exit condition check", "missing evidence report"],
      outOfScope: ["artifact creation", "risk demotion", "runtime installation"],
      evidenceProduced: ["hook_decision", "known_gap"],
      bookRefs: ["state-machine", "convergence", "close-finalization"],
      subagentRefs: ["evidence-collector"],
    },
    {
      id: "status",
      title: "Status",
      purpose: "Read the current route, risk, state, and next action without mutation.",
      activation: {
        macroCycles: ALL_CYCLES,
        gateTypes: ["session_start", "user_prompt"],
        riskClasses: ALL_RISKS,
        operatingModes: ALL_MODES,
        keywords: ["status", "where are we", "etat"],
        auto: true,
      },
      owns: ["state snapshot", "route summary", "next action hint"],
      outOfScope: ["state mutation", "evidence mutation", "cycle transition"],
      evidenceProduced: [],
      bookRefs: ["state-machine"],
      subagentRefs: [],
    },
    {
      id: "gate-policy",
      title: "Gate Policy",
      purpose: "Evaluate lifecycle gates against risk policy, runtime bindings, and allowed scope.",
      activation: {
        macroCycles: ALL_CYCLES,
        gateTypes: ALL_GATES,
        riskClasses: ALL_RISKS,
        operatingModes: ALL_MODES,
        keywords: ["gate", "policy", "guard", "hook"],
        auto: true,
      },
      owns: ["gate decisions", "policy violations", "context injection"],
      outOfScope: ["risk scoring", "subagent implementation", "adapter-specific hook install"],
      evidenceProduced: ["hook_decision", "known_gap"],
      bookRefs: ["gate-policy", "runtime-bindings", "platform-adapters"],
      subagentRefs: ["evidence-collector"],
    },
    {
      id: "bind-runtime",
      title: "Bind Runtime",
      purpose: "Map runtime hook capabilities to canonical gate bindings.",
      activation: {
        macroCycles: ALL_CYCLES,
        gateTypes: ["session_start"],
        riskClasses: ALL_RISKS,
        operatingModes: ALL_MODES,
        keywords: ["runtime", "binding", "adapter", "hook"],
        auto: true,
      },
      owns: ["runtime capability inspection", "gate binding status", "blocking capability report"],
      outOfScope: ["adapter file generation", "platform process management", "policy override"],
      evidenceProduced: ["hook_decision", "known_gap"],
      bookRefs: ["runtime-bindings", "platform-adapters"],
      subagentRefs: [],
    },
    {
      id: "build-inner-loop",
      title: "Build Inner Loop",
      purpose: "Run a risk-calibrated RED/GREEN/REFACTOR implementation loop.",
      activation: {
        macroCycles: ["build"],
        gateTypes: ["pre_tool", "post_tool"],
        riskClasses: ["L", "M", "H", "C"],
        operatingModes: ALL_MODES,
        keywords: ["build", "tdd", "implement", "code"],
        auto: false,
      },
      owns: ["test-first workflow", "minimum implementation", "focused verification"],
      outOfScope: ["release decision", "production monitoring", "human approval"],
      evidenceProduced: ["integration_tests", "command_output", "files_modified"],
      bookRefs: ["convergence", "evidence-management"],
      subagentRefs: ["test-writer", "reviewer"],
    },
    {
      id: "validate-evidence",
      title: "Validate Evidence",
      purpose: "Check whether the accepted Evidence Set is sufficient for the current risk class.",
      activation: {
        macroCycles: ["validation", "release", "run", "learning"],
        gateTypes: ["stop", "subagent_stop"],
        riskClasses: ALL_RISKS,
        operatingModes: ALL_MODES,
        keywords: ["evidence", "verify", "validation", "done"],
        auto: true,
      },
      owns: ["evidence sufficiency", "gap list", "final-state recommendation"],
      outOfScope: ["running tests", "writing artifacts", "approving human checkpoints"],
      evidenceProduced: ["confidence_level", "known_gap", "risk_remaining"],
      bookRefs: ["evidence-management", "close-finalization"],
      subagentRefs: ["evidence-collector", "reviewer", "security-auditor"],
    },
    {
      id: "run-monitor",
      title: "Run Monitor",
      purpose: "Track runtime health signals and trigger convergence or finalization follow-up.",
      activation: {
        macroCycles: ["run"],
        gateTypes: ["session_start", "post_tool", "stop"],
        riskClasses: ALL_RISKS,
        operatingModes: ALL_MODES,
        keywords: ["run", "monitor", "slo", "alert"],
        auto: false,
      },
      owns: ["operational health summary", "SLO gap detection", "run-cycle recommendation"],
      outOfScope: ["infrastructure provisioning", "incident implementation", "deployment"],
      evidenceProduced: ["command_output", "risk_remaining", "known_gap"],
      bookRefs: ["convergence", "evidence-management"],
      subagentRefs: ["perf-profiler", "evidence-collector"],
    },
    {
      id: "close-run",
      title: "Close Run",
      purpose: "Finalize a run only after evidence, policy, and runtime gates agree.",
      activation: {
        macroCycles: ALL_CYCLES,
        gateTypes: ["stop"],
        riskClasses: ALL_RISKS,
        operatingModes: ALL_MODES,
        keywords: ["close", "final", "done", "finish"],
        auto: true,
      },
      owns: ["final state selection", "residual risk summary", "known gap disclosure"],
      outOfScope: ["additional implementation", "silent evidence fabrication", "risk downgrade"],
      evidenceProduced: ["confidence_level", "known_gap", "risk_remaining"],
      bookRefs: ["close-finalization", "evidence-management", "gate-policy"],
      subagentRefs: ["evidence-collector"],
    },
  ],
  books: [
    {
      id: "risk-classification",
      title: "Risk Classification",
      purpose:
        "Canonical risk taxonomy, rank ordering, forcing signals, and operating mode mapping.",
      macroCycles: ALL_CYCLES,
      gateTypes: ["session_start", "user_prompt", "pre_tool"],
      riskClasses: ALL_RISKS,
      operatingModes: ALL_MODES,
      evidenceKeys: ["confidence_level", "risk_remaining"],
      skillRefs: ["classify-risk"],
      subagentRefs: [],
    },
    {
      id: "state-machine",
      title: "State Machine",
      purpose: "Canonical macro-cycle route, state status, and guarded phase progression.",
      macroCycles: ALL_CYCLES,
      gateTypes: ["session_start", "post_tool", "stop"],
      riskClasses: ALL_RISKS,
      operatingModes: ALL_MODES,
      evidenceKeys: ["hook_decision", "known_gap"],
      skillRefs: ["propose-change", "transition-phase", "status"],
      subagentRefs: ["evidence-collector"],
    },
    {
      id: "gate-policy",
      title: "Gate Policy",
      purpose: "Lifecycle gate enforcement, violation classes, and stop conditions.",
      macroCycles: ALL_CYCLES,
      gateTypes: ALL_GATES,
      riskClasses: ALL_RISKS,
      operatingModes: ALL_MODES,
      evidenceKeys: ["hook_decision", "human_validation", "explicit_human_signature"],
      skillRefs: ["propose-change", "gate-policy", "close-run"],
      subagentRefs: ["evidence-collector", "reviewer"],
    },
    {
      id: "runtime-bindings",
      title: "Runtime Bindings",
      purpose:
        "Portable mapping from platform hook capabilities to canonical GateType enforcement.",
      macroCycles: ALL_CYCLES,
      gateTypes: ["session_start", "user_prompt", "pre_tool", "stop"],
      riskClasses: ALL_RISKS,
      operatingModes: ALL_MODES,
      evidenceKeys: ["hook_decision", "known_gap"],
      skillRefs: ["gate-policy", "bind-runtime"],
      subagentRefs: [],
    },
    {
      id: "platform-adapters",
      title: "Platform Adapters",
      purpose: "Runtime portability expectations for Claude, Codex, and Hermes surfaces.",
      macroCycles: ALL_CYCLES,
      gateTypes: ALL_GATES,
      riskClasses: ALL_RISKS,
      operatingModes: ALL_MODES,
      evidenceKeys: ["hook_decision", "subagent_output"],
      skillRefs: ["gate-policy", "bind-runtime"],
      subagentRefs: ["reviewer", "test-writer", "evidence-collector"],
    },
    {
      id: "convergence",
      title: "Convergence",
      purpose: "Iteration control, review loops, test loops, and transition readiness.",
      macroCycles: ["build", "validation", "release", "run", "learning"],
      gateTypes: ["post_tool", "stop"],
      riskClasses: ["L", "M", "H", "C"],
      operatingModes: ALL_MODES,
      evidenceKeys: ["integration_tests", "review_1", "review_2_or_antagonist", "load_tests"],
      skillRefs: ["transition-phase", "build-inner-loop", "run-monitor"],
      subagentRefs: ["reviewer", "test-writer", "perf-profiler", "retro-facilitator"],
    },
    {
      id: "close-finalization",
      title: "Close And Finalization",
      purpose:
        "Final-state selection, known gaps, residual risk, and non-fabricated completion evidence.",
      macroCycles: ALL_CYCLES,
      gateTypes: ["stop"],
      riskClasses: ALL_RISKS,
      operatingModes: ALL_MODES,
      evidenceKeys: ["confidence_level", "known_gap", "risk_remaining"],
      skillRefs: ["transition-phase", "validate-evidence", "close-run"],
      subagentRefs: ["evidence-collector", "retro-facilitator"],
    },
    {
      id: "evidence-management",
      title: "Evidence Management",
      purpose:
        "Accepted evidence keys, subagent output capture, gap reporting, and sufficiency checks.",
      macroCycles: ALL_CYCLES,
      gateTypes: ["post_tool", "stop", "subagent_stop"],
      riskClasses: ALL_RISKS,
      operatingModes: ALL_MODES,
      evidenceKeys: [
        "ci_green",
        "sast_clean",
        "secrets_clean",
        "integration_tests",
        "subagent_output",
        "command_output",
        "files_modified",
        "known_gap",
      ],
      skillRefs: ["build-inner-loop", "validate-evidence", "run-monitor", "close-run"],
      subagentRefs: [
        "reviewer",
        "threat-modeler",
        "test-writer",
        "evidence-collector",
        "security-auditor",
        "accessibility-checker",
        "perf-profiler",
        "doc-generator",
        "retro-facilitator",
      ],
    },
  ],
  subagents: [
    {
      id: "reviewer",
      title: "Reviewer",
      purpose:
        "Perform antagonistic code review and return an approved or changes-required verdict.",
      spawn: {
        macroCycles: ["build", "validation"],
        gateTypes: ["subagent_start", "subagent_stop"],
        minimumRiskClass: "M",
        applicabilityByRisk: {
          T: "skipped",
          L: "optional",
          M: "mandatory",
          H: "mandatory",
          C: "mandatory",
        },
        operatingModes: GOVERNED_MODES,
      },
      evidenceProduced: ["review_1", "review_2_or_antagonist", "subagent_output"],
      bookRefs: ["gate-policy", "convergence", "evidence-management"],
      skillRefs: ["build-inner-loop", "validate-evidence"],
      maxParallelSafe: 3,
    },
    {
      id: "threat-modeler",
      title: "Threat Modeler",
      purpose: "Analyze new data flows with STRIDE and return residual risks and controls.",
      spawn: {
        macroCycles: ["conception"],
        gateTypes: ["subagent_start", "subagent_stop"],
        minimumRiskClass: "H",
        applicabilityByRisk: {
          T: "skipped",
          L: "skipped",
          M: "skipped",
          H: "mandatory",
          C: "mandatory",
        },
        operatingModes: GOVERNED_MODES,
      },
      evidenceProduced: ["threat_model_stride", "subagent_output", "risk_remaining"],
      bookRefs: ["evidence-management"],
      skillRefs: ["validate-evidence"],
      maxParallelSafe: 3,
    },
    {
      id: "test-writer",
      title: "Test Writer",
      purpose: "Write RED-phase tests from acceptance criteria before production implementation.",
      spawn: {
        macroCycles: ["build"],
        gateTypes: ["subagent_start", "subagent_stop"],
        minimumRiskClass: "L",
        applicabilityByRisk: {
          T: "skipped",
          L: "optional",
          M: "mandatory",
          H: "mandatory",
          C: "mandatory",
        },
        operatingModes: ALL_MODES,
      },
      evidenceProduced: ["integration_tests", "subagent_output", "command_output"],
      bookRefs: ["platform-adapters", "convergence", "evidence-management"],
      skillRefs: ["build-inner-loop"],
      maxParallelSafe: 1,
    },
    {
      id: "evidence-collector",
      title: "Evidence Collector",
      purpose: "Collect accepted evidence and recommend final state or blocking gaps.",
      spawn: {
        macroCycles: ALL_CYCLES,
        gateTypes: ["stop", "subagent_stop"],
        minimumRiskClass: "T",
        applicabilityByRisk: {
          T: "mandatory",
          L: "mandatory",
          M: "mandatory",
          H: "mandatory",
          C: "mandatory",
        },
        operatingModes: ALL_MODES,
      },
      evidenceProduced: ["subagent_output", "known_gap", "confidence_level", "risk_remaining"],
      bookRefs: [
        "state-machine",
        "gate-policy",
        "platform-adapters",
        "evidence-management",
        "close-finalization",
      ],
      skillRefs: ["transition-phase", "gate-policy", "validate-evidence", "close-run"],
      maxParallelSafe: 1,
    },
    {
      id: "security-auditor",
      title: "Security Auditor",
      purpose: "Run extended security review for high-risk increments.",
      spawn: {
        macroCycles: ["validation"],
        gateTypes: ["subagent_start", "subagent_stop"],
        minimumRiskClass: "H",
        applicabilityByRisk: {
          T: "skipped",
          L: "skipped",
          M: "optional",
          H: "mandatory",
          C: "mandatory",
        },
        operatingModes: GOVERNED_MODES,
      },
      evidenceProduced: ["dast_report", "independent_security_audit", "subagent_output"],
      bookRefs: ["evidence-management"],
      skillRefs: ["validate-evidence"],
      maxParallelSafe: 3,
    },
    {
      id: "accessibility-checker",
      title: "Accessibility Checker",
      purpose: "Check critical UI paths against accessibility requirements.",
      spawn: {
        macroCycles: ["validation"],
        gateTypes: ["subagent_start", "subagent_stop"],
        minimumRiskClass: "M",
        applicabilityByRisk: {
          T: "skipped",
          L: "skipped",
          M: "mandatory",
          H: "mandatory",
          C: "mandatory",
        },
        operatingModes: GOVERNED_MODES,
      },
      evidenceProduced: ["product_validation", "subagent_output", "known_gap"],
      bookRefs: ["evidence-management"],
      skillRefs: ["validate-evidence"],
      maxParallelSafe: 3,
    },
    {
      id: "perf-profiler",
      title: "Performance Profiler",
      purpose: "Measure latency, throughput, and error rates against SLOs.",
      spawn: {
        macroCycles: ["validation", "run"],
        gateTypes: ["subagent_start", "subagent_stop"],
        minimumRiskClass: "M",
        applicabilityByRisk: {
          T: "skipped",
          L: "skipped",
          M: "optional",
          H: "mandatory",
          C: "mandatory",
        },
        operatingModes: GOVERNED_MODES,
      },
      evidenceProduced: ["load_tests", "command_output", "subagent_output"],
      bookRefs: ["convergence", "evidence-management"],
      skillRefs: ["run-monitor"],
      maxParallelSafe: 3,
    },
    {
      id: "doc-generator",
      title: "Doc Generator",
      purpose: "Prepare user-facing documentation deltas from behavior changes.",
      spawn: {
        macroCycles: ["build", "release", "learning"],
        gateTypes: ["subagent_start", "subagent_stop"],
        minimumRiskClass: "L",
        applicabilityByRisk: {
          T: "skipped",
          L: "optional",
          M: "optional",
          H: "mandatory",
          C: "mandatory",
        },
        operatingModes: ALL_MODES,
      },
      evidenceProduced: ["files_modified", "subagent_output"],
      bookRefs: ["evidence-management"],
      skillRefs: ["validate-evidence"],
      maxParallelSafe: 3,
    },
    {
      id: "retro-facilitator",
      title: "Retro Facilitator",
      purpose: "Summarize learning-cycle outcomes and produce action items.",
      spawn: {
        macroCycles: ["learning"],
        gateTypes: ["subagent_start", "subagent_stop"],
        minimumRiskClass: "M",
        applicabilityByRisk: {
          T: "skipped",
          L: "skipped",
          M: "mandatory",
          H: "mandatory",
          C: "mandatory",
        },
        operatingModes: GOVERNED_MODES,
      },
      evidenceProduced: ["product_validation", "subagent_output", "known_gap"],
      bookRefs: ["convergence", "close-finalization", "evidence-management"],
      skillRefs: ["validate-evidence"],
      maxParallelSafe: 1,
    },
  ],
} as const satisfies OperationalCatalog;

export function getSkillsCatalog(): SkillCatalogEntry[] {
  return [...OPERATIONAL_CATALOG.skills];
}

export function getBooksCatalog(): BookCatalogEntry[] {
  return [...OPERATIONAL_CATALOG.books];
}

export function getSubagentsCatalog(): SubagentCatalogEntry[] {
  return [...OPERATIONAL_CATALOG.subagents];
}

export function getOperationalCatalog(): OperationalCatalog {
  return {
    skills: getSkillsCatalog(),
    books: getBooksCatalog(),
    subagents: getSubagentsCatalog(),
  };
}
