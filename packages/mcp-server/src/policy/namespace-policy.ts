export const RMS_CANONICAL_TOOL_NAMES = [
  "rms.get_state",
  "rms.transition",
  "rms.enter_development",
  "rms.classify_risk",
  "rms.record_evidence",
  "rms.evaluate_gate",
  "rms.inspect_runtime",
  "rms.bind_runtime",
  "rms.probe_runtime",
  "rms.assess_route_runtime_bindings",
  "rms.get_catalog",
  "rms.generate_artifacts",
  "rms.install_artifacts",
  "rms.install_platform",
  "rms.uninstall_platform",
  "rms.repair_platform",
  "rms.apply_lifecycle",
  "rms.uninstall_lifecycle",
  "rms.repair_lifecycle",
  "rms.rollback_artifacts",
  "rms.runtime_digest",
  "rms.evaluate_convergence",
  "rms.close_run",
] as const;

export const HIMA_GOVERNANCE_TOOL_NAMES = [
  "hima_evaluate_completion",
  "hima_classify_risk",
  "hima_record_evidence",
  "hima_query_compliance",
] as const;

export const HARNESS_COMPATIBILITY_TOOL_NAMES = [
  "harness:get_state",
  "harness:get_risk_class",
  "harness:evaluate_gate",
  "harness:record_evidence",
  "harness:log_event",
  "harness:enter_development",
  "harness:get_catalog",
  "harness:generate_artifacts",
  "harness:install_artifacts",
  "harness:install_platform",
  "harness:uninstall_platform",
  "harness:repair_platform",
  "harness:apply_lifecycle",
  "harness:uninstall_lifecycle",
  "harness:repair_lifecycle",
  "harness:rollback_artifacts",
  "harness:runtime_digest",
  "harness:probe_runtime",
  "harness:evaluate_convergence",
  "harness:close_run",
] as const;

export type McpToolNamespace = "rms" | "hima_governance" | "harness_compatibility";
export type McpNamespaceStatus = "owned" | "compatibility";

export interface McpToolNamespacePolicy {
  toolName: string;
  namespace: McpToolNamespace;
  status: McpNamespaceStatus;
  canonicalName?: string;
}

const RMS_CANONICAL_TOOL_SET = new Set<string>(RMS_CANONICAL_TOOL_NAMES);
const HIMA_GOVERNANCE_TOOL_SET = new Set<string>(HIMA_GOVERNANCE_TOOL_NAMES);
const HARNESS_COMPATIBILITY_TOOL_SET = new Set<string>(HARNESS_COMPATIBILITY_TOOL_NAMES);

const CANONICAL_ALIAS_MAP = new Map<string, string>([
  ["hima_evaluate_completion", "rms.evaluate_convergence"],
  ["hima_classify_risk", "rms.classify_risk"],
  ["hima_record_evidence", "rms.record_evidence"],
  ["hima_query_compliance", "rms.evaluate_convergence"],
  ["harness:get_state", "rms.get_state"],
  ["harness:evaluate_gate", "rms.evaluate_gate"],
  ["harness:record_evidence", "rms.record_evidence"],
  ["harness:enter_development", "rms.enter_development"],
  ["harness:get_catalog", "rms.get_catalog"],
  ["harness:generate_artifacts", "rms.generate_artifacts"],
  ["harness:install_artifacts", "rms.install_artifacts"],
  ["harness:install_platform", "rms.install_platform"],
  ["harness:uninstall_platform", "rms.uninstall_platform"],
  ["harness:repair_platform", "rms.repair_platform"],
  ["harness:apply_lifecycle", "rms.apply_lifecycle"],
  ["harness:uninstall_lifecycle", "rms.uninstall_lifecycle"],
  ["harness:repair_lifecycle", "rms.repair_lifecycle"],
  ["harness:rollback_artifacts", "rms.rollback_artifacts"],
  ["harness:runtime_digest", "rms.runtime_digest"],
  ["harness:probe_runtime", "rms.probe_runtime"],
  ["harness:evaluate_convergence", "rms.evaluate_convergence"],
  ["harness:close_run", "rms.close_run"],
]);

export function classifyMcpToolName(toolName: string): McpToolNamespacePolicy | null {
  if (RMS_CANONICAL_TOOL_SET.has(toolName)) {
    return {
      toolName,
      namespace: "rms",
      status: "owned",
    };
  }

  if (HIMA_GOVERNANCE_TOOL_SET.has(toolName)) {
    return {
      toolName,
      namespace: "hima_governance",
      status: "compatibility",
      canonicalName: CANONICAL_ALIAS_MAP.get(toolName),
    };
  }

  if (HARNESS_COMPATIBILITY_TOOL_SET.has(toolName)) {
    return {
      toolName,
      namespace: "harness_compatibility",
      status: "compatibility",
      canonicalName: CANONICAL_ALIAS_MAP.get(toolName),
    };
  }

  return null;
}

export function assertMcpToolAllowed(toolName: string): McpToolNamespacePolicy {
  const policy = classifyMcpToolName(toolName);

  if (policy === null) {
    throw new Error(`MCP tool is outside the namespace policy: ${toolName}`);
  }

  return policy;
}

export function getMcpNamespacePolicySurface(): McpToolNamespacePolicy[] {
  return [
    ...RMS_CANONICAL_TOOL_NAMES,
    ...HIMA_GOVERNANCE_TOOL_NAMES,
    ...HARNESS_COMPATIBILITY_TOOL_NAMES,
  ].map((toolName) => assertMcpToolAllowed(toolName));
}

export function assertMcpToolSurfaceMatchesNamespacePolicy(toolNames: readonly string[]): void {
  const seen = new Set<string>();

  for (const toolName of toolNames) {
    if (seen.has(toolName)) {
      throw new Error(`Duplicate MCP tool definition: ${toolName}`);
    }

    seen.add(toolName);
    assertMcpToolAllowed(toolName);
  }

  for (const policy of getMcpNamespacePolicySurface()) {
    if (!seen.has(policy.toolName)) {
      throw new Error(`MCP namespace policy tool missing from definitions: ${policy.toolName}`);
    }
  }
}
