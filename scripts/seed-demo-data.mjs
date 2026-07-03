import { spawnSync } from "node:child_process";

const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const adminToken = process.env.ADMIN_TOKEN || "";
const mockBaseUrl = process.env.MOCK_BASE_URL || "http://localhost:9090";
const runId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

async function request(path, options = {}, { allowStatuses = [] } = {}) {
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
  if (!response.ok && !allowStatuses.includes(response.status)) {
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

function log(message) {
  process.stdout.write(`${message}\n`);
}

function buildName(prefix) {
  return `${prefix}_${runId}`;
}

async function createAgent(name) {
  const data = await request("/api/v1/agents", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name,
      owner: "demo-seed",
      description: "Created by ATG demo seed script",
    }),
  });
  assert(/^atg_/.test(data.api_key || ""), "Agent API key was not returned");
  return data;
}

async function createTool({ name, endpoint, riskLevel, inputSchema, description }) {
  const data = await request("/api/v1/tools", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name,
      description,
      endpoint,
      method: "POST",
      risk_level: riskLevel,
      timeout_ms: 5000,
      input_schema: inputSchema,
      headers: {},
    }),
  });
  assert(data.tool?.name === name, `Tool ${name} was not created`);
  return data.tool;
}

async function createPolicy(body) {
  const data = await request("/api/v1/policies", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(body),
  });
  assert(data.policy?.id, "Policy was not created");
  return data.policy;
}

async function invoke(apiKey, toolName, body, allowStatuses = []) {
  return request(
    `/api/v1/invoke/${toolName}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    },
    { allowStatuses },
  );
}

async function approve(approvalId) {
  const data = await request(`/api/v1/approvals/${approvalId}/approve`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      approver: "demo-seed",
      comment: "Approved by demo seed",
    }),
  });
  assert(data.status === "success", "Approval execution did not succeed");
  return data;
}

console.log(`ATG demo seed target: ${baseUrl}`);
console.log(`Mock API target: ${mockBaseUrl}`);

const health = await request("/healthz");
assert(health.status === "ok", "Health check did not return ok");

const agent = await createAgent(buildName("demo_agent"));
const refundTool = await createTool({
  name: buildName("refund_order"),
  endpoint: `${mockBaseUrl}/mock/refund_order`,
  riskLevel: "medium",
  description: "Demo refund approval tool",
  inputSchema: {
    type: "object",
    required: ["order_id", "amount"],
    properties: {
      order_id: { type: "string" },
      amount: { type: "number", minimum: 1 },
      reason: { type: "string" },
    },
  },
});
await createPolicy({
  name: buildName("approve_large_refunds"),
  description: "Require approval for refunds over 100",
  priority: 1,
  action: "approve",
  condition_json: { tool: refundTool.name, "args.amount": { gt: 100 } },
});

const redactionTool = await createTool({
  name: buildName("search_customer"),
  endpoint: `${mockBaseUrl}/mock/search_customer`,
  riskLevel: "low",
  description: "Demo CRM redaction tool",
  inputSchema: {
    type: "object",
    required: ["customer_id"],
    properties: {
      customer_id: { type: "string" },
    },
  },
});
await createPolicy({
  name: buildName("redact_customer_data"),
  description: "Redact customer CRM data",
  priority: 2,
  action: "redact",
  condition_json: { tool: redactionTool.name },
});

const denyTool = await createTool({
  name: buildName("delete_user"),
  endpoint: `${mockBaseUrl}/mock/delete_user`,
  riskLevel: "high",
  description: "Demo dangerous operation",
  inputSchema: {
    type: "object",
    required: ["user_id"],
    properties: {
      user_id: { type: "string" },
    },
  },
});
await createPolicy({
  name: buildName("deny_delete_user"),
  description: "Deny user deletion",
  priority: 3,
  action: "deny",
  condition_json: { tool: denyTool.name },
});

const approvalResult = await invoke(agent.api_key, refundTool.name, {
  order_id: "ord_demo_seed_approval",
  amount: 150,
  reason: "demo_seed_approval",
});
assert(approvalResult.status === "pending_approval", "Approval demo did not create a pending approval");
await approve(approvalResult.approval_id);

const redactionResult = await invoke(agent.api_key, redactionTool.name, {
  customer_id: "cus_demo_seed",
});
assert(redactionResult.status === "success", "Redaction demo did not succeed");

const deniedResult = await invoke(agent.api_key, denyTool.name, {
  user_id: "user_demo_seed",
}, [403]);
assert(deniedResult.status === "denied", "Deny demo did not return denied");

log(`[ok] seeded agent ${agent.agent.name}`);
log(`[ok] seeded tools: ${refundTool.name}, ${redactionTool.name}, ${denyTool.name}`);
log("[ok] seeded approve / redact / deny demo data");
console.log("ATG demo seed complete");
