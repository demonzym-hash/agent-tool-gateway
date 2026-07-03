const args = new Set(process.argv.slice(2));
const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const adminToken = process.env.ADMIN_TOKEN || "";
const mockBaseUrl = args.has("--local-mock") ? "http://localhost:9090" : process.env.MOCK_BASE_URL || "http://mock-api:9090";
const runId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const agentName = `policy-preview-agent-${runId}`;
const toolName = `policy_preview_refund_${runId}`;

async function request(path, options = {}) {
  const { headers, ...rest } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed with ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function adminHeaders() {
  return adminToken ? { "x-admin-token": adminToken } : {};
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function listInvocations(agentId, toolId) {
  const query = new URLSearchParams({ agent_id: agentId, tool_id: toolId, limit: "10" });
  const data = await request(`/api/v1/invocations?${query}`, { headers: adminHeaders() });
  return data.invocations || [];
}

console.log(`ATG policy preview check target: ${baseUrl}`);
console.log(`Tool endpoint registered for preview: ${mockBaseUrl}/mock/refund_order`);

const health = await request("/healthz");
assert(health.status === "ok", "Health check did not return ok");
console.log("[ok] healthz");

const agentResponse = await request("/api/v1/agents", {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    name: agentName,
    owner: "policy-preview-check",
    description: "Created by ATG policy preview check",
  }),
});
assert(agentResponse.agent?.id, "Agent response did not include an id");
assert(/^atg_/.test(agentResponse.api_key || ""), "Agent API key was not returned");
console.log(`[ok] created agent ${agentName}`);

const toolResponse = await request("/api/v1/tools", {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    name: toolName,
    description: "Refund order policy preview check tool",
    endpoint: `${mockBaseUrl}/mock/refund_order`,
    method: "POST",
    risk_level: "medium",
    timeout_ms: 5000,
    input_schema: {
      type: "object",
      required: ["order_id", "amount"],
      properties: {
        order_id: { type: "string" },
        amount: { type: "number", minimum: 1 },
        reason: { type: "string" },
      },
    },
    headers: {},
  }),
});
assert(toolResponse.tool?.id, "Tool response did not include an id");
assert(toolResponse.tool?.name === toolName, "Tool response did not include created tool");
console.log(`[ok] created tool ${toolName}`);

const policyResponse = await request("/api/v1/policies", {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    name: `Policy preview approve refunds ${runId}`,
    priority: 1,
    action: "approve",
    condition_json: { tool: toolName, "args.amount": { gt: 100 } },
  }),
});
assert(policyResponse.policy?.action === "approve", "Approve policy was not created");
console.log("[ok] created approve policy");

const beforeInvocations = await listInvocations(agentResponse.agent.id, toolResponse.tool.id);
assert(beforeInvocations.length === 0, "Fresh preview fixture already has invocation records");

const evaluated = await request("/api/v1/policies/evaluate", {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    agent_id: agentResponse.agent.id,
    tool_name: toolName,
    input: {
      order_id: "ord_policy_preview",
      amount: 150,
      reason: "preview_only",
    },
  }),
});
assert(evaluated.decision?.action === "approve", `Preview decision was ${evaluated.decision?.action}, expected approve`);
assert(evaluated.decision?.matched_policy_id === policyResponse.policy.id, "Preview did not return the matching policy");
assert(evaluated.agent?.id === agentResponse.agent.id, "Preview response returned the wrong agent");
assert(evaluated.tool?.id === toolResponse.tool.id, "Preview response returned the wrong tool");
console.log("[ok] policy preview returned approve decision");

const afterInvocations = await listInvocations(agentResponse.agent.id, toolResponse.tool.id);
assert(afterInvocations.length === 0, "Policy preview created invocation records or executed the target path");
console.log("[ok] policy preview did not create invocation records");

console.log("ATG policy preview check passed");
