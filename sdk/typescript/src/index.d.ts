export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type PolicyAction = "allow" | "deny" | "approve" | "redact";
export type ToolMethod = "GET" | "POST";
export type ToolRiskLevel = "low" | "medium" | "high";

export interface AtgClientOptions {
  baseUrl?: string;
  apiKey?: string;
  adminToken?: string;
  timeoutMs?: number;
}

export interface AtgEntity {
  id: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: JsonValue | undefined;
}

export interface Agent extends AtgEntity {
  name: string;
  description: string;
  source_type: string;
  owner: string;
  status: string;
}

export interface Tool extends AtgEntity {
  name: string;
  description: string;
  type: string;
  risk_level: ToolRiskLevel | string;
  endpoint: string;
  method: ToolMethod | string;
  headers: Record<string, string>;
  timeout_ms: number;
  input_schema: JsonObject;
  output_schema: JsonObject;
  owner: string;
}

export interface Policy extends AtgEntity {
  name: string;
  description: string;
  priority: number;
  scope: JsonObject;
  condition_json: JsonObject;
  action: PolicyAction;
  enabled: boolean;
}

export interface Approval extends AtgEntity {
  invocation_id: string;
  approver: string;
  status: string;
  reason: string;
  comment: string;
}

export interface Invocation extends AtgEntity {
  agent_id: string;
  agent_name?: string;
  tool_id: string;
  tool_name?: string;
  status: string;
  request_args: JsonObject;
  response_data_redacted: JsonValue;
  policy_decision: JsonObject;
  matched_policy_id: string | null;
  approval_id: string | null;
  latency_ms: number;
  error_message: string | null;
}

export interface AuditLog extends AtgEntity {
  event_type: string;
  actor_type: string;
  actor_id: string;
  resource_type: string;
  resource_id: string;
  detail_json: JsonObject;
}

export interface PolicyDecisionRef {
  id: string;
  name: string;
  action: PolicyAction;
  priority?: number;
  matched?: boolean;
  reason?: string;
}

export interface PolicyConditionCheck {
  key: string;
  label: string;
  matched: boolean;
  operator: string;
}

export interface PolicyEvaluationEntry extends PolicyDecisionRef {
  checks?: PolicyConditionCheck[];
}

export interface PolicyEvaluationSummary {
  mode: string;
  precedence: PolicyAction[];
  evaluated_policies: PolicyEvaluationEntry[];
}

export interface PolicyDecision {
  action: PolicyAction;
  reason?: string;
  matched_policy_id: string | null;
  matched_policy_name?: string | null;
  matched_policies?: PolicyDecisionRef[];
  redaction_policy_ids?: string[];
  redaction?: JsonObject;
  explanation?: string[];
  evaluation?: PolicyEvaluationSummary;
  [key: string]: unknown;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: JsonObject;
  [key: string]: JsonValue | undefined;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  sourceType?: string;
  owner?: string;
}

export interface CreateToolInput {
  name: string;
  endpoint: string;
  description?: string;
  type?: string;
  riskLevel?: ToolRiskLevel | string;
  method?: ToolMethod | string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  inputSchema?: JsonObject;
  outputSchema?: JsonObject;
  owner?: string;
}

export interface EvaluatePolicyInput {
  agentId: string;
  toolId?: string;
  toolName?: string;
  input?: JsonObject;
}

export interface CreatePolicyInput {
  name: string;
  description?: string;
  priority?: number;
  scope?: JsonObject;
  conditionJson?: JsonObject;
  action?: PolicyAction;
  enabled?: boolean;
}

export interface ListPoliciesInput {
  action?: PolicyAction | string;
  enabled?: boolean | null;
}

export interface ApprovalDecisionInput {
  approver?: string;
  comment?: string;
}

export interface ListApprovalsInput {
  status?: string;
  from?: string;
  to?: string;
  limit?: number | null;
}

export interface ListInvocationsInput {
  agentId?: string;
  toolId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number | null;
}

export interface ListAuditLogsInput {
  eventType?: string;
  actorType?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  limit?: number | null;
}

export class AtgError extends Error {
  statusCode: number | null;
  payload: unknown;
  constructor(message: string, options?: { statusCode?: number | null; payload?: unknown });
}

export class AtgClient {
  baseUrl: string;
  apiKey: string;
  adminToken: string;
  timeoutMs: number;

  constructor(options?: AtgClientOptions);

  invoke(toolName: string, args?: JsonObject): Promise<Record<string, unknown>>;
  mcpInitialize(): Promise<Record<string, unknown>>;
  mcpListTools(): Promise<McpTool[]>;
  mcpCallTool(toolName: string, args?: JsonObject): Promise<Record<string, unknown>>;

  createAgent(input: CreateAgentInput): Promise<{ agent: Agent; api_key: string }>;
  listAgents(): Promise<{ agents: Agent[] }>;
  getAgent(agentId: string): Promise<{ agent: Agent }>;
  rotateAgentKey(agentId: string): Promise<{ agent: Agent; api_key: string }>;
  disableAgent(agentId: string): Promise<{ agent: Agent }>;

  createTool(input: CreateToolInput): Promise<{ tool: Tool }>;
  listTools(): Promise<{ tools: Tool[] }>;
  getTool(toolId: string): Promise<{ tool: Tool }>;
  testTool(toolId: string, args?: JsonObject): Promise<{ status: string; http_status: number; data: JsonValue }>;
  disableTool(toolId: string): Promise<{ tool: Tool }>;

  evaluatePolicy(input: EvaluatePolicyInput): Promise<{ decision: PolicyDecision; agent: Agent; tool: Tool }>;
  createPolicy(input: CreatePolicyInput): Promise<{ policy: Policy }>;
  listPolicies(input?: ListPoliciesInput): Promise<{ policies: Policy[] }>;
  getPolicy(policyId: string): Promise<{ policy: Policy }>;
  disablePolicy(policyId: string): Promise<{ policy: Policy }>;

  approveApproval(
    approvalId: string,
    input?: ApprovalDecisionInput,
  ): Promise<{ status: string; approval: Approval; invocation_id: string; audit_id: string; data?: JsonValue }>;
  rejectApproval(
    approvalId: string,
    input?: ApprovalDecisionInput,
  ): Promise<{ status: "rejected"; approval: Approval; invocation_id: string; audit_id: string }>;
  getApproval(approvalId: string): Promise<{ approval: Approval }>;
  listApprovals(input?: ListApprovalsInput): Promise<{ approvals: Approval[] }>;

  getInvocation(invocationId: string): Promise<{ invocation: Invocation }>;
  listInvocations(input?: ListInvocationsInput): Promise<{ invocations: Invocation[] }>;
  getAuditLog(auditLogId: string): Promise<{ audit_log: AuditLog }>;
  listAuditLogs(input?: ListAuditLogsInput): Promise<{ audit_logs: AuditLog[] }>;
}
