import { readFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const adminToken = process.env.ADMIN_TOKEN || "";
const mockBaseUrl = args.has("--local-mock") ? "http://localhost:9090" : process.env.MOCK_BASE_URL || "http://mock-api:9090";
const runId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const agentName = `dify-agent-${runId}`;
const toolName = `refund_order_dify_${runId}`;
const example = JSON.parse(readFileSync(new URL("../examples/dify/http-tool.refund-order.json", import.meta.url), "utf8"));

async function request(url, options = {}) {
  const { headers, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed with ${response.status}: ${JSON.stringify(data)}`);
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

function renderTemplate(value, variables) {
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => String(variables[key.trim()] ?? ""));
}

function renderObjectTemplate(value, variables) {
  if (Array.isArray(value)) {
    return value.map((item) => renderObjectTemplate(item, variables));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderObjectTemplate(item, variables)]));
  }
  return renderTemplate(value, variables);
}

console.log(`ATG Dify check target: ${baseUrl}`);
console.log(`Mock API target: ${mockBaseUrl}`);

const health = await request(`${baseUrl}/healthz`);
assert(health.status === "ok", "Health check did not return ok");
console.log("[ok] healthz");

const agent = await request(`${baseUrl}/api/v1/agents`, {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    name: agentName,
    owner: "dify-check",
    description: "Created by ATG Dify check",
  }),
});
assert(/^atg_/.test(agent.api_key || ""), "Agent API key was not returned");
console.log(`[ok] created agent ${agentName}`);

const tool = await request(`${baseUrl}/api/v1/tools`, {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    name: toolName,
    description: "Refund order Dify check tool",
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
assert(tool.tool?.name === toolName, "Tool response did not include created tool");
console.log(`[ok] created tool ${toolName}`);

const difyVariables = {
  ATG_API_KEY: agent.api_key,
  order_id: "ord_dify_check",
  amount: 25,
  reason: "dify_runtime_check",
};
const difyUrl = example.url.replace("/refund_order", `/${toolName}`);
const difyHeaders = renderObjectTemplate(example.headers, difyVariables);
const difyBody = renderObjectTemplate(example.body, difyVariables);

const invocation = await request(difyUrl, {
  method: example.method,
  headers: Object.fromEntries(Object.entries(difyHeaders).map(([key, value]) => [key.toLowerCase(), value])),
  body: JSON.stringify({
    ...difyBody,
    amount: Number(difyBody.amount),
  }),
});
assert(invocation.status === "success", "Dify HTTP example did not return success");
assert(invocation.data?.status === "approved", "Dify HTTP example did not reach refund mock");
assert(invocation.invocation_id, "Dify HTTP example did not return invocation_id");
assert(invocation.audit_id, "Dify HTTP example did not return audit_id");
console.log(`[ok] Dify HTTP tool call, invocation ${invocation.invocation_id}`);

const invocations = await request(`${baseUrl}/api/v1/invocations?tool_id=${tool.tool.id}&status=success&limit=10`, {
  headers: adminHeaders(),
});
assert(invocations.invocations.some((item) => item.id === invocation.invocation_id), "Dify invocation record was not found");
console.log("[ok] invocation record found");

const auditLogs = await request(`${baseUrl}/api/v1/audit-logs?event_type=tool.invoke.succeeded&limit=10`, {
  headers: adminHeaders(),
});
assert(auditLogs.audit_logs.some((item) => item.id === invocation.audit_id), "Dify audit log record was not found");
console.log("[ok] audit log record found");

console.log("ATG Dify check passed");
