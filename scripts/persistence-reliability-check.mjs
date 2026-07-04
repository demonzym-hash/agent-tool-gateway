const args = new Set(process.argv.slice(2));
const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const adminToken = process.env.ADMIN_TOKEN || "";
const toolEndpoint = args.has("--local-mock")
  ? "http://localhost:9090/mock/refund_order"
  : process.env.MOCK_TOOL_ENDPOINT || "http://mock-api:9090/mock/refund_order";
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

function adminHeaders() {
  return adminToken ? { "x-admin-token": adminToken } : {};
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createAgent() {
  const { data } = await request("/api/v1/agents", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name: `persistence-agent-${runId}`,
      owner: "persistence-reliability-check",
      description: "Created by ATG persistence reliability check",
    }),
  });
  assert(data.agent?.id, "Agent response did not include an id");
  assert(/^atg_/.test(data.api_key || ""), "Agent API key was not returned");
  return data;
}

async function createTool() {
  const name = `persistence_refund_${runId}`;
  const { data } = await request("/api/v1/tools", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name,
      description: "Persistence reliability check approval Tool",
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
  assert(data.tool?.name === name, "Tool response did not include created tool");
  return data.tool;
}

async function createPolicy(toolName) {
  const { data } = await request("/api/v1/policies", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name: `Persistence approve once ${runId}`,
      priority: 1,
      action: "approve",
      condition_json: { tool: toolName, "args.amount": { gt: 100 } },
    }),
  });
  assert(data.policy?.id, "Policy response did not include an id");
  return data.policy;
}

async function invoke(apiKey, toolName) {
  return request(
    `/api/v1/invoke/${toolName}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        order_id: `ord_${runId}`,
        amount: 150,
        reason: "persistence reliability check",
      }),
    },
    { allowStatuses: [202] },
  );
}

async function decide(approvalId, action, comment, allowStatuses = []) {
  return request(
    `/api/v1/approvals/${approvalId}/${action}`,
    {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        approver: "persistence-reliability-check",
        comment,
      }),
    },
    { allowStatuses },
  );
}

console.log(`ATG persistence reliability check target: ${baseUrl}`);
console.log(`Tool endpoint: ${toolEndpoint}`);

const health = await request("/healthz");
assert(health.data.status === "ok", "Health check did not return ok");
console.log("[ok] healthz");

const agent = await createAgent();
console.log(`[ok] created agent ${agent.agent.name}`);

const tool = await createTool();
console.log(`[ok] created tool ${tool.name}`);

const policy = await createPolicy(tool.name);
console.log(`[ok] created approval policy ${policy.id}`);

const pending = await invoke(agent.api_key, tool.name);
assert(pending.response.status === 202, "Invocation did not create a pending approval");
assert(pending.data.status === "pending_approval", "Invocation did not return pending_approval");
assert(pending.data.approval_id, "Pending invocation did not include approval_id");
console.log(`[ok] created pending approval ${pending.data.approval_id}`);

const approved = await decide(pending.data.approval_id, "approve", "first approve");
assert(approved.response.status === 200, "First approve did not return 200");
assert(approved.data.approval?.status === "approved", "First approve did not mark approval as approved");
assert(approved.data.invocation_id === pending.data.invocation_id, "Approved response did not reference the pending invocation");
console.log("[ok] first approve succeeded");

const secondApprove = await decide(pending.data.approval_id, "approve", "second approve", [409]);
assert(secondApprove.response.status === 409, "Second approve did not return 409");
assert(secondApprove.data.error?.code === "approval_already_decided", "Second approve did not return approval_already_decided");
console.log("[ok] second approve rejected with approval_already_decided");

const rejectAfterApprove = await decide(pending.data.approval_id, "reject", "reject after approve", [409]);
assert(rejectAfterApprove.response.status === 409, "Reject after approve did not return 409");
assert(rejectAfterApprove.data.error?.code === "approval_already_decided", "Reject after approve did not return approval_already_decided");
console.log("[ok] reject after approve rejected with approval_already_decided");

const approvalDetail = await request(`/api/v1/approvals/${pending.data.approval_id}`, {
  headers: adminHeaders(),
});
assert(approvalDetail.data.approval?.status === "approved", "Approval status did not remain approved");

const invocationDetail = await request(`/api/v1/invocations/${pending.data.invocation_id}`, {
  headers: adminHeaders(),
});
assert(invocationDetail.data.invocation?.status === "success", "Invocation status did not remain success");
console.log("[ok] final approval remains approved and invocation remains success");

console.log("ATG persistence reliability check passed");
