import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { AtgClient } from "../sdk/typescript/src/index.js";

const args = new Set(process.argv.slice(2));
const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const adminToken = process.env.ADMIN_TOKEN || "";
const toolEndpoint = args.has("--local-mock")
  ? "http://localhost:9090/mock/refund_order"
  : process.env.MOCK_TOOL_ENDPOINT || "http://mock-api:9090/mock/refund_order";
const runId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const agentName = `typescript-sdk-agent-${runId}`;
const toolName = `refund_order_typescript_sdk_${runId}`;
const sdkTypescriptDir = fileURLToPath(new URL("../sdk/typescript/", import.meta.url));
const evidenceFrom = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const evidenceTo = new Date(Date.now() + 60 * 60 * 1000).toISOString();

async function request(path, options = {}) {
  const { headers, allowStatuses = [], ...rest } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      connection: "close",
      ...(headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok && !allowStatuses.includes(response.status)) {
    throw new Error(`${options.method || "GET"} ${path} failed with ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runTypescriptExample(apiKey, extraEnv = {}) {
  const env = {
    ...process.env,
    ATG_BASE_URL: baseUrl,
    ATG_API_KEY: apiKey,
    ATG_TOOL_NAME: toolName,
    ATG_TOOL_ARGS: JSON.stringify({
      order_id: "ord_typescript_sdk",
      amount: 25,
      reason: extraEnv.ATG_USE_MCP === "1" ? "typescript_sdk_mcp_check" : "typescript_sdk_rest_check",
    }),
    ...extraEnv,
  };
  const result = spawnSync(process.execPath, ["examples/tool-demo.js"], {
    cwd: sdkTypescriptDir,
    encoding: "utf8",
    env,
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
  const data = JSON.parse(result.stdout);
  assert(data.status === "success", "TypeScript SDK example did not return success");
  assert(data.data?.status === "approved", "TypeScript SDK example did not reach refund mock");
  return data;
}

console.log(`ATG TypeScript SDK check target: ${baseUrl}`);
console.log(`Tool endpoint: ${toolEndpoint}`);

const health = await request("/healthz");
assert(health.status === "ok", "Health check did not return ok");
console.log("[ok] healthz");

const previewClient = new AtgClient({ baseUrl, adminToken });
const agent = await previewClient.createAgent({
  name: agentName,
  owner: "typescript-sdk-check",
  description: "Created by ATG TypeScript SDK check",
});
assert(/^atg_/.test(agent.api_key || ""), "Agent API key was not returned");
const listedAgents = await previewClient.listAgents();
assert(listedAgents.agents?.some((item) => item.id === agent.agent.id), "TypeScript SDK agent list did not include created agent");
const fetchedAgent = await previewClient.getAgent(agent.agent.id);
assert(fetchedAgent.agent?.id === agent.agent.id, "TypeScript SDK get agent did not return created agent");
console.log(`[ok] created agent ${agentName}`);

const tool = await previewClient.createTool({
  name: toolName,
  description: "Refund order TypeScript SDK check tool",
  endpoint: toolEndpoint,
  method: "POST",
  riskLevel: "medium",
  timeoutMs: 5000,
  inputSchema: {
    type: "object",
    required: ["order_id", "amount"],
    properties: {
      order_id: { type: "string" },
      amount: { type: "number", minimum: 1 },
      reason: { type: "string" },
    },
  },
  headers: {},
});
assert(tool.tool?.name === toolName, "Tool response did not include created tool");
const listedTools = await previewClient.listTools();
assert(listedTools.tools?.some((item) => item.id === tool.tool.id), "TypeScript SDK tool list did not include created tool");
const fetchedTool = await previewClient.getTool(tool.tool.id);
assert(fetchedTool.tool?.id === tool.tool.id, "TypeScript SDK get tool did not return created tool");
const testedTool = await previewClient.testTool(tool.tool.id, {
  order_id: "ord_typescript_tool_test",
  amount: 25,
  reason: "typescript_sdk_tool_test",
});
assert(testedTool.status === "success", "TypeScript SDK tool test did not return success");
console.log(`[ok] created tool ${toolName}`);

const rotatedAgent = await previewClient.rotateAgentKey(agent.agent.id);
assert(/^atg_/.test(rotatedAgent.api_key || ""), "TypeScript SDK agent key rotation did not return a new key");
const oldKeyResult = await request(`/api/v1/invoke/${toolName}`, {
  method: "POST",
  headers: { authorization: `Bearer ${agent.api_key}` },
  body: JSON.stringify({ order_id: "ord_typescript_old_key", amount: 25, reason: "typescript_sdk_old_key" }),
  allowStatuses: [401],
});
assert(oldKeyResult.error?.code === "invalid_api_key", "TypeScript SDK rotated key did not revoke the old key");
agent.api_key = rotatedAgent.api_key;
console.log("[ok] TypeScript SDK agent key rotation");

const disabledTool = await previewClient.createTool({
  name: `${toolName}_disabled`,
  endpoint: toolEndpoint,
  method: "POST",
  riskLevel: "medium",
  timeoutMs: 5000,
  headers: {},
});
const disabledToolResult = await previewClient.disableTool(disabledTool.tool.id);
assert(disabledToolResult.tool?.status === "disabled", "TypeScript SDK disable tool did not mark tool disabled");
const disabledAgent = await previewClient.createAgent({
  name: `${agentName}-disabled`,
  owner: "typescript-sdk-check",
});
const disabledAgentResult = await previewClient.disableAgent(disabledAgent.agent.id);
assert(disabledAgentResult.agent?.status === "disabled", "TypeScript SDK disable agent did not mark agent disabled");
console.log("[ok] TypeScript SDK disable helpers");

const policy = await previewClient.createPolicy({
  name: `TypeScript SDK preview approve refunds ${runId}`,
  priority: 1,
  action: "approve",
  conditionJson: { tool: toolName, "args.amount": { gt: 100 } },
});
assert(policy.policy?.action === "approve", "TypeScript SDK preview policy was not created");

const listedPolicies = await previewClient.listPolicies({ action: "approve", enabled: true });
assert(
  listedPolicies.policies?.some((item) => item.id === policy.policy.id),
  "TypeScript SDK policy list did not include the created approve policy",
);
const policyDetail = await previewClient.getPolicy(policy.policy.id);
assert(policyDetail.policy?.id === policy.policy.id, "TypeScript SDK policy detail did not match created policy");
assert(policyDetail.policy?.enabled === true, "TypeScript SDK policy detail was not enabled");
console.log("[ok] TypeScript SDK policy list and detail");

const preview = await previewClient.evaluatePolicy({
  agentId: agent.agent.id,
  toolId: tool.tool.id,
  input: { order_id: "ord_typescript_policy_preview", amount: 150, reason: "typescript_sdk_policy_preview" },
});
assert(preview.decision?.action === "approve", "TypeScript SDK policy preview did not return approve");
assert(preview.decision?.matched_policy_id === policy.policy.id, "TypeScript SDK policy preview did not match the created policy");
console.log("[ok] TypeScript SDK policy preview");

const disabledPolicy = await previewClient.disablePolicy(policy.policy.id);
assert(disabledPolicy.policy?.enabled === false, "TypeScript SDK policy disable did not return disabled policy");
const disabledPolicyDetail = await previewClient.getPolicy(policy.policy.id);
assert(disabledPolicyDetail.policy?.enabled === false, "TypeScript SDK policy detail did not reflect disabled policy");
const previewAfterDisable = await previewClient.evaluatePolicy({
  agentId: agent.agent.id,
  toolId: tool.tool.id,
  input: { order_id: "ord_typescript_policy_disabled", amount: 150, reason: "typescript_sdk_policy_disabled" },
});
assert(previewAfterDisable.decision?.action === "allow", "TypeScript SDK disabled policy still affected preview");
assert(previewAfterDisable.decision?.matched_policy_id === null, "TypeScript SDK disabled policy still matched");
console.log("[ok] TypeScript SDK policy disable");

const approvalPolicy = await previewClient.createPolicy({
  name: `TypeScript SDK approval decisions ${runId}`,
  priority: 1,
  action: "approve",
  conditionJson: { tool: toolName, "args.reason": { contains: "typescript_sdk_approval_decision" } },
});
assert(approvalPolicy.policy?.action === "approve", "TypeScript SDK approval policy was not created");

const pendingApproval = await request(`/api/v1/invoke/${toolName}`, {
  method: "POST",
  headers: { authorization: `Bearer ${agent.api_key}` },
  body: JSON.stringify({
    order_id: "ord_typescript_sdk_approval",
    amount: 25,
    reason: "typescript_sdk_approval_decision_approve",
  }),
});
assert(pendingApproval.status === "pending_approval", "TypeScript SDK approval check did not create pending approval");
const listedPendingApprovals = await previewClient.listApprovals({ status: "pending", limit: 20 });
assert(
  listedPendingApprovals.approvals?.some((item) => item.id === pendingApproval.approval_id),
  "TypeScript SDK approval list did not include the pending approval",
);
const pendingApprovalDetail = await previewClient.getApproval(pendingApproval.approval_id);
assert(pendingApprovalDetail.approval?.id === pendingApproval.approval_id, "TypeScript SDK approval detail did not match the pending approval");
assert(pendingApprovalDetail.approval?.status === "pending", "TypeScript SDK approval detail status was not pending");
const listedPendingApprovalsByTime = await previewClient.listApprovals({
  status: "pending",
  from: evidenceFrom,
  to: evidenceTo,
  limit: 20,
});
assert(
  listedPendingApprovalsByTime.approvals?.some((item) => item.id === pendingApproval.approval_id),
  "TypeScript SDK time-filtered approval list did not include the pending approval",
);
const approved = await previewClient.approveApproval(pendingApproval.approval_id, {
  approver: "typescript-sdk-check",
  comment: "approved from TypeScript SDK",
});
assert(approved.approval?.status === "approved", "TypeScript SDK approval helper did not approve");
assert(approved.status === "success", "TypeScript SDK approval helper did not execute original call");

const pendingRejection = await request(`/api/v1/invoke/${toolName}`, {
  method: "POST",
  headers: { authorization: `Bearer ${agent.api_key}` },
  body: JSON.stringify({
    order_id: "ord_typescript_sdk_rejection",
    amount: 25,
    reason: "typescript_sdk_approval_decision_reject",
  }),
});
assert(pendingRejection.status === "pending_approval", "TypeScript SDK rejection check did not create pending approval");
const listedPendingRejections = await previewClient.listApprovals({ status: "pending", limit: 20 });
assert(
  listedPendingRejections.approvals?.some((item) => item.id === pendingRejection.approval_id),
  "TypeScript SDK approval list did not include the pending rejection",
);
const rejected = await previewClient.rejectApproval(pendingRejection.approval_id, {
  approver: "typescript-sdk-check",
  comment: "rejected from TypeScript SDK",
});
assert(rejected.approval?.status === "rejected", "TypeScript SDK approval helper did not reject");
assert(rejected.status === "rejected", "TypeScript SDK approval helper returned wrong rejection status");
console.log("[ok] TypeScript SDK approval list and decisions");

const restResult = runTypescriptExample(agent.api_key);
assert(restResult.invocation_id, "REST TypeScript SDK result did not include invocation_id");
const restInvocations = await previewClient.listInvocations({
  agentId: agent.agent.id,
  toolId: tool.tool.id,
  status: "success",
  from: evidenceFrom,
  to: evidenceTo,
  limit: 20,
});
assert(
  restInvocations.invocations?.some((item) => item.id === restResult.invocation_id),
  "TypeScript SDK invocation list did not include REST invocation",
);
const restInvocationDetail = await previewClient.getInvocation(restResult.invocation_id);
assert(restInvocationDetail.invocation?.id === restResult.invocation_id, "TypeScript SDK invocation detail did not match the REST invocation");
assert(restInvocationDetail.invocation?.tool_name === toolName, "TypeScript SDK invocation detail tool name did not match");
const restAuditLogs = await previewClient.listAuditLogs({
  eventType: "tool.invoke.succeeded",
  actorType: "agent",
  resourceType: "tool",
  from: evidenceFrom,
  to: evidenceTo,
  limit: 20,
});
assert(
  restAuditLogs.audit_logs?.some((item) => item.id === restResult.audit_id),
  "TypeScript SDK audit log list did not include REST audit record",
);
const restAuditLogDetail = await previewClient.getAuditLog(restResult.audit_id);
assert(restAuditLogDetail.audit_log?.id === restResult.audit_id, "TypeScript SDK audit log detail did not match the REST audit record");
assert(restAuditLogDetail.audit_log?.event_type === "tool.invoke.succeeded", "TypeScript SDK audit log detail event type was not tool.invoke.succeeded");
console.log(`[ok] TypeScript SDK REST example, invocation ${restResult.invocation_id}`);

const evidence = await previewClient.exportEvidence({
  invocationToolId: tool.tool.id,
  invocationStatus: "success",
  auditEventType: "tool.invoke.succeeded",
  policyAction: "approve",
  from: evidenceFrom,
  to: evidenceTo,
  limit: 50,
});
assert(evidence.evidence?.manifest?.format === "atg.evidence.export.v1", "TypeScript SDK evidence export format was wrong");
assert(
  evidence.evidence?.datasets?.invocations?.some((item) => item.id === restResult.invocation_id),
  "TypeScript SDK evidence export did not include REST invocation",
);
assert(
  evidence.evidence?.datasets?.audit_logs?.some((item) => item.id === restResult.audit_id),
  "TypeScript SDK evidence export did not include REST audit log",
);
assert(
  evidence.evidence?.datasets?.policies?.some((item) => item.id === approvalPolicy.policy.id),
  "TypeScript SDK evidence export did not include approval policy snapshot",
);
assert(
  /^[0-9a-f]{64}$/.test(evidence.evidence?.manifest?.dataset_hashes?.invocations_sha256 || ""),
  "TypeScript SDK evidence export did not include invocation hash",
);
assert(
  /^[0-9a-f]{64}$/.test(evidence.evidence?.manifest?.manifest_sha256 || ""),
  "TypeScript SDK evidence export did not include manifest hash",
);
console.log("[ok] TypeScript SDK evidence export");

const mcpResult = runTypescriptExample(agent.api_key, { ATG_USE_MCP: "1" });
assert(mcpResult.invocation_id, "MCP TypeScript SDK result did not include invocation_id");
const mcpInvocations = await previewClient.listInvocations({
  agentId: agent.agent.id,
  toolId: tool.tool.id,
  status: "success",
  limit: 20,
});
assert(
  mcpInvocations.invocations?.some((item) => item.id === mcpResult.invocation_id),
  "TypeScript SDK invocation list did not include MCP invocation",
);
console.log(`[ok] TypeScript SDK MCP example, invocation ${mcpResult.invocation_id}`);

console.log("ATG TypeScript SDK check passed");
