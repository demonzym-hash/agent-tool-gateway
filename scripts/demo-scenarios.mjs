const args = new Set(process.argv.slice(2));
const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const adminToken = process.env.ADMIN_TOKEN || "";
const mockBaseUrl = args.has("--local-mock") ? "http://localhost:9090" : process.env.MOCK_BASE_URL || "http://mock-api:9090";
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
  return { response, data };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function adminHeaders() {
  return adminToken ? { "x-admin-token": adminToken } : {};
}

async function createAgent(name) {
  const { data } = await request("/api/v1/agents", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ name, owner: "demo", description: "Created by ATG demo runner" }),
  });
  assert(/^atg_/.test(data.api_key || ""), `Agent ${name} API key was not returned`);
  return data;
}

async function createTool({ name, endpoint, riskLevel = "medium", inputSchema = {} }) {
  const { data } = await request("/api/v1/tools", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name,
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

async function createPolicy({ name, action, condition, priority = 1, scope = {} }) {
  const { data } = await request("/api/v1/policies", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name,
      priority,
      action,
      condition_json: condition,
      scope,
    }),
  });
  assert(data.policy?.action === action, `Policy ${name} was not created`);
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
  const { data } = await request(`/api/v1/approvals/${approvalId}/approve`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ approver: "demo-approver", comment: "approved by demo runner" }),
  });
  assert(data.status === "success", "Approval execution did not succeed");
  return data;
}

async function expectInvocation(id, expectedStatus) {
  const { data } = await request("/api/v1/invocations", { headers: adminHeaders() });
  const invocation = data.invocations.find((item) => item.id === id);
  assert(invocation, `Invocation ${id} was not found`);
  assert(invocation.status === expectedStatus, `Invocation ${id} status was ${invocation.status}, expected ${expectedStatus}`);
  return invocation;
}

async function expectAudit(id, eventType) {
  const { data } = await request("/api/v1/audit-logs", { headers: adminHeaders() });
  const audit = data.audit_logs.find((item) => item.id === id);
  assert(audit, `Audit ${id} was not found`);
  assert(audit.event_type === eventType, `Audit ${id} was ${audit.event_type}, expected ${eventType}`);
  return audit;
}

console.log(`ATG demo target: ${baseUrl}`);
console.log(`Mock API target: ${mockBaseUrl}`);

const health = await request("/healthz");
assert(health.data.status === "ok", "Health check did not return ok");
console.log("[ok] healthz");

const agent = await createAgent(`demo-agent-${runId}`);
console.log(`[ok] created agent ${agent.agent.name}`);

const refundTool = await createTool({
  name: `refund_order_demo_${runId}`,
  endpoint: `${mockBaseUrl}/mock/refund_order`,
  riskLevel: "medium",
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
  name: `Approve large refunds ${runId}`,
  action: "approve",
  condition: { tool: refundTool.name, "args.amount": { gt: 100 } },
});
const pendingRefund = await invoke(agent.api_key, refundTool.name, {
  order_id: "ord_demo_approval",
  amount: 150,
  reason: "demo_refund_approval",
});
assert(pendingRefund.response.status === 202, "Large refund did not require approval");
assert(pendingRefund.data.status === "pending_approval", "Large refund did not return pending_approval");
await expectInvocation(pendingRefund.data.invocation_id, "pending_approval");
await expectAudit(pendingRefund.data.audit_id, "tool.invoke.pending_approval");
const approvedRefund = await approve(pendingRefund.data.approval_id);
await expectInvocation(approvedRefund.invocation_id, "success");
await expectAudit(approvedRefund.audit_id, "approval.approved.executed");
console.log("[ok] refund approval demo");

const crmTool = await createTool({
  name: `search_customer_demo_${runId}`,
  endpoint: `${mockBaseUrl}/mock/search_customer`,
  riskLevel: "low",
  inputSchema: {
    type: "object",
    required: ["customer_id"],
    properties: { customer_id: { type: "string" } },
  },
});
await createPolicy({
  name: `Redact CRM data ${runId}`,
  action: "redact",
  condition: { tool: crmTool.name },
});
const crm = await invoke(agent.api_key, crmTool.name, { customer_id: "cus_demo" });
assert(crm.response.status === 200, "CRM invocation failed");
assert(crm.data.data.email === "d************@example.com", "CRM email was not redacted");
assert(crm.data.data.phone === "138****5678", "CRM phone was not redacted");
assert(crm.data.data.id_card === "110101********1234", "CRM ID card was not redacted");
await expectInvocation(crm.data.invocation_id, "success");
await expectAudit(crm.data.audit_id, "tool.invoke.succeeded");
console.log("[ok] CRM redaction demo");

const customRedactionTool = await createTool({
  name: `custom_redaction_demo_${runId}`,
  endpoint: `${mockBaseUrl}/mock/search_customer`,
  riskLevel: "low",
  inputSchema: {
    type: "object",
    required: ["customer_id"],
    properties: { customer_id: { type: "string" } },
  },
});
await createPolicy({
  name: `Redact account and ticket data ${runId}`,
  action: "redact",
  condition: { tool: customRedactionTool.name },
  scope: {
    redaction: {
      fields: ["account_number", "$.profile.external_id"],
      patterns: [{ pattern: "TCK-\\d+", replacement: "TCK-***" }],
    },
  },
});
const customRedaction = await invoke(agent.api_key, customRedactionTool.name, { customer_id: "cus_demo" });
assert(customRedaction.response.status === 200, "Custom redaction invocation failed");
assert(customRedaction.data.data.account_number === "***", "Custom redaction field rule did not mask account_number");
assert(customRedaction.data.data.profile.external_id === "***", "Custom redaction JSONPath rule did not mask profile.external_id");
assert(customRedaction.data.data.support_ticket === "TCK-***", "Custom redaction regex did not mask support_ticket");
assert(customRedaction.data.data.profile.note === "manual review TCK-***", "Custom redaction regex did not mask nested note");
await expectInvocation(customRedaction.data.invocation_id, "success");
await expectAudit(customRedaction.data.audit_id, "tool.invoke.succeeded");
console.log("[ok] custom redaction scope demo");

const deleteTool = await createTool({
  name: `delete_user_demo_${runId}`,
  endpoint: `${mockBaseUrl}/mock/delete_user`,
  riskLevel: "high",
  inputSchema: {
    type: "object",
    required: ["user_id"],
    properties: { user_id: { type: "string" } },
  },
});
await createPolicy({
  name: `Deny dangerous delete ${runId}`,
  action: "deny",
  condition: { tool: deleteTool.name },
});
const denied = await invoke(agent.api_key, deleteTool.name, { user_id: "user_demo" }, [403]);
assert(denied.response.status === 403, "Dangerous delete was not denied");
assert(denied.data.status === "denied", "Dangerous delete did not return denied");
await expectInvocation(denied.data.invocation_id, "denied");
await expectAudit(denied.data.audit_id, "tool.invoke.denied");
console.log("[ok] dangerous operation denial demo");

console.log("ATG demo scenarios passed");
