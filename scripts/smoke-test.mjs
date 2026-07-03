const args = new Set(process.argv.slice(2));
const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const adminToken = process.env.ADMIN_TOKEN || "";
const toolEndpoint = args.has("--local-mock")
  ? "http://localhost:9090/mock/refund_order"
  : process.env.MOCK_TOOL_ENDPOINT || "http://mock-api:9090/mock/refund_order";
const runId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const agentName = `customer-service-agent-${runId}`;
const toolName = `refund_order_${runId}`;

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

console.log(`ATG smoke test target: ${baseUrl}`);
console.log(`Tool endpoint: ${toolEndpoint}`);

const health = await request("/healthz");
assert(health.status === "ok", "Health check did not return ok");
console.log("[ok] healthz");

const agentResponse = await request("/api/v1/agents", {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    name: agentName,
    owner: "smoke-test",
    description: "Created by ATG smoke test",
  }),
});
assert(agentResponse.agent?.name === agentName, "Agent response did not include created agent");
assert(/^atg_/.test(agentResponse.api_key || ""), "Agent API key was not returned");
console.log(`[ok] created agent ${agentName}`);

const toolResponse = await request("/api/v1/tools", {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    name: toolName,
    description: "Refund order smoke-test tool",
    endpoint: toolEndpoint,
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
assert(toolResponse.tool?.name === toolName, "Tool response did not include created tool");
console.log(`[ok] created tool ${toolName}`);

const invocationResponse = await request(`/api/v1/invoke/${toolName}`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${agentResponse.api_key}`,
  },
  body: JSON.stringify({
    order_id: "ord_smoke",
    amount: 25,
    reason: "week_1_smoke_test",
  }),
});
assert(invocationResponse.status === "success", "Invocation did not succeed");
assert(invocationResponse.data?.status === "approved", "Invocation response did not come from refund mock");
assert(invocationResponse.invocation_id, "Invocation ID missing");
assert(invocationResponse.audit_id, "Audit ID missing");
console.log(`[ok] invoked tool, invocation ${invocationResponse.invocation_id}`);

const invocationsResponse = await request("/api/v1/invocations", { headers: adminHeaders() });
const invocation = invocationsResponse.invocations?.find((item) => item.id === invocationResponse.invocation_id);
assert(invocation, "Invocation record was not found");
assert(invocation.agent_name === agentName, "Invocation record has wrong agent name");
assert(invocation.tool_name === toolName, "Invocation record has wrong tool name");
console.log("[ok] invocation record found");

const auditResponse = await request("/api/v1/audit-logs", { headers: adminHeaders() });
const audit = auditResponse.audit_logs?.find((item) => item.id === invocationResponse.audit_id);
assert(audit, "Audit log record was not found");
assert(audit.event_type === "tool.invoke.succeeded", "Audit log event type is not tool.invoke.succeeded");
console.log("[ok] audit log record found");

console.log("ATG smoke test passed");
