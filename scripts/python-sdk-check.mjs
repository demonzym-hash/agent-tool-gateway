import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const langchainOnly = args.has("--langchain-only");
const includeLangchain = langchainOnly || args.has("--include-langchain");
const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const adminToken = process.env.ADMIN_TOKEN || "";
const toolEndpoint = args.has("--local-mock")
  ? "http://localhost:9090/mock/refund_order"
  : process.env.MOCK_TOOL_ENDPOINT || "http://mock-api:9090/mock/refund_order";
const runId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const checkSlug = langchainOnly ? "langchain" : "python-sdk";
const agentName = `${checkSlug}-agent-${runId}`;
const toolName = `refund_order_${checkSlug.replace(/-/g, "_")}_${runId}`;
const sdkPythonDir = fileURLToPath(new URL("../sdk/python/", import.meta.url));
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

function runPythonExample(extraEnv = {}) {
  const checkName = extraEnv.ATG_USE_LANGCHAIN === "1" ? "langchain" : extraEnv.ATG_USE_MCP === "1" ? "mcp" : "rest";
  const env = {
    ...process.env,
    ATG_BASE_URL: baseUrl,
    ATG_API_KEY: agent.api_key,
    ATG_TOOL_NAME: toolName,
    ATG_TOOL_ARGS: JSON.stringify({
      order_id: "ord_python_sdk",
      amount: 25,
      reason: `python_sdk_${checkName}_check`,
    }),
    PYTHONPATH: [sdkPythonDir, process.env.PYTHONPATH].filter(Boolean).join(process.platform === "win32" ? ";" : ":"),
    ...extraEnv,
  };
  const result = spawnSync("python", ["examples/langchain_tool_demo.py"], {
    cwd: sdkPythonDir,
    encoding: "utf8",
    env,
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
  const data = JSON.parse(result.stdout);
  assert(data.status === "success", "Python SDK example did not return success");
  assert(data.data?.status === "approved", "Python SDK example did not reach refund mock");
  return data;
}

console.log(`ATG ${langchainOnly ? "LangChain adapter" : "Python SDK"} check target: ${baseUrl}`);
console.log(`Tool endpoint: ${toolEndpoint}`);

const health = await request("/healthz");
assert(health.status === "ok", "Health check did not return ok");
console.log("[ok] healthz");

const agent = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.create_agent(
    name="${agentName}",
    owner="sdk-check",
    description="Created by ATG ${langchainOnly ? "LangChain adapter" : "Python SDK"} check",
)))
`);
assert(/^atg_/.test(agent.api_key || ""), "Agent API key was not returned");
if (!langchainOnly) {
  const listedAgents = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.list_agents()))
`);
  assert(listedAgents.agents?.some((item) => item.id === agent.agent.id), "Python SDK agent list did not include created agent");
  const fetchedAgent = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.get_agent("${agent.agent.id}")))
`);
  assert(fetchedAgent.agent?.id === agent.agent.id, "Python SDK get agent did not return created agent");
}
console.log(`[ok] created agent ${agentName}`);

const tool = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.create_tool(
    name="${toolName}",
    description="Refund order ${langchainOnly ? "LangChain adapter" : "Python SDK"} check tool",
    endpoint="${toolEndpoint}",
    method="POST",
    risk_level="medium",
    timeout_ms=5000,
    input_schema={
        "type": "object",
        "required": ["order_id", "amount"],
        "properties": {
            "order_id": {"type": "string"},
            "amount": {"type": "number", "minimum": 1},
            "reason": {"type": "string"},
        },
    },
    headers={},
)))
`);
assert(tool.tool?.name === toolName, "Tool response did not include created tool");
if (!langchainOnly) {
  const listedTools = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.list_tools()))
`);
  assert(listedTools.tools?.some((item) => item.id === tool.tool.id), "Python SDK tool list did not include created tool");
  const fetchedTool = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.get_tool("${tool.tool.id}")))
`);
  assert(fetchedTool.tool?.id === tool.tool.id, "Python SDK get tool did not return created tool");
  const testedTool = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.test_tool(
    "${tool.tool.id}",
    {"order_id": "ord_python_tool_test", "amount": 25, "reason": "python_sdk_tool_test"},
)))
`);
  assert(testedTool.status === "success", "Python SDK tool test did not return success");
}
console.log(`[ok] created tool ${toolName}`);

if (!langchainOnly) {
  const rotatedAgent = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.rotate_agent_key("${agent.agent.id}")))
`);
  assert(/^atg_/.test(rotatedAgent.api_key || ""), "Python SDK agent key rotation did not return a new key");
  const oldKeyResult = await request(`/api/v1/invoke/${toolName}`, {
    method: "POST",
    headers: { authorization: `Bearer ${agent.api_key}` },
    body: JSON.stringify({ order_id: "ord_python_old_key", amount: 25, reason: "python_sdk_old_key" }),
    allowStatuses: [401],
  });
  assert(oldKeyResult.error?.code === "invalid_api_key", "Python SDK rotated key did not revoke the old key");
  agent.api_key = rotatedAgent.api_key;
  console.log("[ok] Python SDK agent key rotation");

  const disabledTool = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.create_tool(
    name="${toolName}_disabled",
    endpoint="${toolEndpoint}",
    method="POST",
    risk_level="medium",
    timeout_ms=5000,
    headers={},
)))
`);
  const disabledToolResult = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.disable_tool("${disabledTool.tool.id}")))
`);
  assert(disabledToolResult.tool?.status === "disabled", "Python SDK disable tool did not mark tool disabled");
  const disabledAgent = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.create_agent(name="${agentName}-disabled", owner="sdk-check")))
`);
  const disabledAgentResult = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.disable_agent("${disabledAgent.agent.id}")))
`);
  assert(disabledAgentResult.agent?.status === "disabled", "Python SDK disable agent did not mark agent disabled");
  console.log("[ok] Python SDK disable helpers");

  const policy = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.create_policy(
    name="Python SDK preview approve refunds ${runId}",
    priority=1,
    action="approve",
    condition_json={"tool": "${toolName}", "args.amount": {"gt": 100}},
)))
`);
  assert(policy.policy?.action === "approve", "Python SDK preview policy was not created");
  const listedPolicies = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.list_policies(action="approve", enabled=True)))
`);
  assert(
    listedPolicies.policies?.some((item) => item.name === `Python SDK preview approve refunds ${runId}`),
    "Python SDK policy list did not include the created approve policy",
  );
  const policyDetail = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.get_policy("${policy.policy.id}")))
`);
  assert(policyDetail.policy?.id === policy.policy.id, "Python SDK policy detail did not match created policy");
  assert(policyDetail.policy?.enabled === true, "Python SDK policy detail was not enabled");
  console.log("[ok] Python SDK policy list and detail");

  const preview = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
result = client.evaluate_policy(
    agent_id="${agent.agent.id}",
    tool_id="${tool.tool.id}",
    input={"order_id": "ord_python_policy_preview", "amount": 150, "reason": "python_sdk_policy_preview"},
)
print(json.dumps(result))
`);
  assert(preview.decision?.action === "approve", "Python SDK policy preview did not return approve");
  console.log("[ok] Python SDK policy preview");

  const disabledPolicy = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.disable_policy("${preview.decision.matched_policy_id}")))
`);
  assert(disabledPolicy.policy?.enabled === false, "Python SDK policy disable did not return disabled policy");
  const disabledPolicyDetail = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.get_policy("${preview.decision.matched_policy_id}")))
`);
  assert(disabledPolicyDetail.policy?.enabled === false, "Python SDK policy detail did not reflect disabled policy");
  const previewAfterDisable = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
result = client.evaluate_policy(
    agent_id="${agent.agent.id}",
    tool_id="${tool.tool.id}",
    input={"order_id": "ord_python_policy_disabled", "amount": 150, "reason": "python_sdk_policy_disabled"},
)
print(json.dumps(result))
`);
  assert(previewAfterDisable.decision?.action === "allow", "Python SDK disabled policy still affected preview");
  assert(previewAfterDisable.decision?.matched_policy_id === null, "Python SDK disabled policy still matched");
  console.log("[ok] Python SDK policy disable");

  const approvalPolicy = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.create_policy(
    name="Python SDK approval decisions ${runId}",
    priority=1,
    action="approve",
    condition_json={"tool": "${toolName}", "args.reason": {"contains": "python_sdk_approval_decision"}},
)))
`);
  assert(approvalPolicy.policy?.action === "approve", "Python SDK approval policy was not created");

  const pendingApproval = await request(`/api/v1/invoke/${toolName}`, {
    method: "POST",
    headers: { authorization: `Bearer ${agent.api_key}` },
    body: JSON.stringify({
      order_id: "ord_python_sdk_approval",
      amount: 25,
      reason: "python_sdk_approval_decision_approve",
    }),
  });
  assert(pendingApproval.status === "pending_approval", "Python SDK approval check did not create pending approval");
  const listedPendingApprovals = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.list_approvals(status="pending", limit=20)))
`);
  assert(
    listedPendingApprovals.approvals?.some((item) => item.id === pendingApproval.approval_id),
    "Python SDK approval list did not include the pending approval",
  );
  const pendingApprovalDetail = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.get_approval("${pendingApproval.approval_id}")))
`);
  assert(pendingApprovalDetail.approval?.id === pendingApproval.approval_id, "Python SDK approval detail did not match the pending approval");
  assert(pendingApprovalDetail.approval?.status === "pending", "Python SDK approval detail status was not pending");
  const listedPendingApprovalsByTime = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.list_approvals(
    status="pending",
    from_time="${evidenceFrom}",
    to_time="${evidenceTo}",
    limit=20,
)))
`);
  assert(
    listedPendingApprovalsByTime.approvals?.some((item) => item.id === pendingApproval.approval_id),
    "Python SDK time-filtered approval list did not include the pending approval",
  );
  const approved = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.approve_approval(
    "${pendingApproval.approval_id}",
    approver="python-sdk-check",
    comment="approved from Python SDK",
)))
`);
  assert(approved.approval?.status === "approved", "Python SDK approval helper did not approve");
  assert(approved.status === "success", "Python SDK approval helper did not execute original call");

  const pendingRejection = await request(`/api/v1/invoke/${toolName}`, {
    method: "POST",
    headers: { authorization: `Bearer ${agent.api_key}` },
    body: JSON.stringify({
      order_id: "ord_python_sdk_rejection",
      amount: 25,
      reason: "python_sdk_approval_decision_reject",
    }),
  });
  assert(pendingRejection.status === "pending_approval", "Python SDK rejection check did not create pending approval");
  const listedPendingRejections = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.list_approvals(status="pending", limit=20)))
`);
  assert(
    listedPendingRejections.approvals?.some((item) => item.id === pendingRejection.approval_id),
    "Python SDK approval list did not include the pending rejection",
  );
  const rejected = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.reject_approval(
    "${pendingRejection.approval_id}",
    approver="python-sdk-check",
    comment="rejected from Python SDK",
)))
`);
  assert(rejected.approval?.status === "rejected", "Python SDK approval helper did not reject");
  assert(rejected.status === "rejected", "Python SDK approval helper returned wrong rejection status");
  console.log("[ok] Python SDK approval list and decisions");

  const restResult = runPythonExample();
  assert(restResult.invocation_id, "REST Python SDK result did not include invocation_id");
  const restInvocations = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.list_invocations(
    agent_id="${agent.agent.id}",
    tool_id="${tool.tool.id}",
    status="success",
    from_time="${evidenceFrom}",
    to_time="${evidenceTo}",
    limit=20,
)))
`);
  assert(
    restInvocations.invocations?.some((item) => item.id === restResult.invocation_id),
    "Python SDK invocation list did not include REST invocation",
  );
  const restInvocationDetail = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.get_invocation("${restResult.invocation_id}")))
`);
  assert(restInvocationDetail.invocation?.id === restResult.invocation_id, "Python SDK invocation detail did not match the REST invocation");
  assert(restInvocationDetail.invocation?.tool_name === toolName, "Python SDK invocation detail tool name did not match");
  const restAuditLogs = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.list_audit_logs(
    event_type="tool.invoke.succeeded",
    actor_type="agent",
    resource_type="tool",
    from_time="${evidenceFrom}",
    to_time="${evidenceTo}",
    limit=20,
)))
`);
  assert(
    restAuditLogs.audit_logs?.some((item) => item.id === restResult.audit_id),
    "Python SDK audit log list did not include REST audit record",
  );
  const restAuditLogDetail = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.get_audit_log("${restResult.audit_id}")))
`);
  assert(restAuditLogDetail.audit_log?.id === restResult.audit_id, "Python SDK audit log detail did not match the REST audit record");
  assert(restAuditLogDetail.audit_log?.event_type === "tool.invoke.succeeded", "Python SDK audit log detail event type was not tool.invoke.succeeded");
  console.log(`[ok] Python SDK REST example, invocation ${restResult.invocation_id}`);

  const mcpResult = runPythonExample({ ATG_USE_MCP: "1" });
  assert(mcpResult.invocation_id, "MCP Python SDK result did not include invocation_id");
  const mcpInvocations = runPythonSnippet(`
import json
from atg_sdk import AtgClient

client = AtgClient(base_url="${baseUrl}", admin_token="${adminToken}")
print(json.dumps(client.list_invocations(
    agent_id="${agent.agent.id}",
    tool_id="${tool.tool.id}",
    status="success",
    limit=20,
)))
`);
  assert(
    mcpInvocations.invocations?.some((item) => item.id === mcpResult.invocation_id),
    "Python SDK invocation list did not include MCP invocation",
  );
  console.log(`[ok] Python SDK MCP example, invocation ${mcpResult.invocation_id}`);
}

if (includeLangchain) {
  const langchainResult = runPythonExample({ ATG_USE_LANGCHAIN: "1" });
  assert(langchainResult.invocation_id, "LangChain Python SDK result did not include invocation_id");
  console.log(`[ok] Python SDK LangChain adapter example, invocation ${langchainResult.invocation_id}`);
}

console.log(`ATG ${langchainOnly ? "LangChain adapter" : "Python SDK"} check passed`);

function runPythonSnippet(code) {
  const result = spawnSync("python", ["-c", code], {
    cwd: sdkPythonDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONPATH: [sdkPythonDir, process.env.PYTHONPATH].filter(Boolean).join(process.platform === "win32" ? ";" : ":"),
    },
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
  return JSON.parse(result.stdout);
}
