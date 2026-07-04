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
      name: `policy-clarity-agent-${runId}`,
      owner: "policy-clarity-check",
      description: "Created by ATG policy clarity check",
    }),
  });
  assert(data.agent?.id, "Agent response did not include an id");
  assert(/^atg_/.test(data.api_key || ""), "Agent API key was not returned");
  return data;
}

async function createTool() {
  const name = `policy_clarity_lookup_${runId}`;
  const { data } = await request("/api/v1/tools", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name,
      description: "Policy clarity check Tool with approve and redact policies",
      endpoint: `${mockBaseUrl}/mock/search_customer`,
      method: "POST",
      risk_level: "high",
      timeout_ms: 5000,
      input_schema: {
        type: "object",
        required: ["customer_id"],
        properties: {
          customer_id: { type: "string" },
        },
      },
      headers: {},
    }),
  });
  assert(data.tool?.name === name, "Tool response did not include created tool");
  return data.tool;
}

async function createPolicy(body) {
  const { data } = await request("/api/v1/policies", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(body),
  });
  assert(data.policy?.id, `Policy ${body.name} was not created`);
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
    body: JSON.stringify({
      approver: "policy-clarity-check",
      comment: "Approved by policy clarity check",
    }),
  });
  assert(data.status === "success", "Approval execution did not succeed");
  return data;
}

console.log(`ATG policy clarity check target: ${baseUrl}`);
console.log(`Mock API target: ${mockBaseUrl}`);

const health = await request("/healthz");
assert(health.data.status === "ok", "Health check did not return ok");
console.log("[ok] healthz");

const agent = await createAgent();
console.log(`[ok] created agent ${agent.agent.name}`);

const tool = await createTool();
console.log(`[ok] created tool ${tool.name}`);

const approvePolicy = await createPolicy({
  name: `Policy clarity approve sensitive lookup ${runId}`,
  priority: 1,
  action: "approve",
  condition_json: { tool: tool.name },
});
const redactPolicy = await createPolicy({
  name: `Policy clarity redact sensitive lookup ${runId}`,
  priority: 2,
  action: "redact",
  condition_json: { tool: tool.name },
  scope: {
    redaction: {
      fields: ["account_number", "$.profile.external_id"],
      patterns: [{ pattern: "TCK-\\d+", replacement: "TCK-***" }],
    },
  },
});
console.log("[ok] created approve and redact policies");

const preview = await request("/api/v1/policies/evaluate", {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    agent_id: agent.agent.id,
    tool_id: tool.id,
    input: { customer_id: "cus_policy_clarity" },
  }),
});
assert(preview.data.decision?.action === "approve", "Preview did not compose to approve");
assert(preview.data.decision?.matched_policy_id === approvePolicy.id, "Preview did not choose approve as primary policy");
assert(preview.data.decision?.matched_policies?.length === 2, "Preview did not include both matched policies");
assert(preview.data.decision?.redaction_policy_ids?.includes(redactPolicy.id), "Preview did not include redaction policy id");
assert(preview.data.decision?.evaluation?.mode === "composed", "Preview did not include composed evaluation metadata");
assert(Array.isArray(preview.data.decision?.evaluation?.evaluated_policies), "Preview did not include evaluated policies");
console.log("[ok] policy preview explains approve plus redact composition");

const pending = await invoke(
  agent.api_key,
  tool.name,
  { customer_id: "cus_policy_clarity" },
  [202],
);
assert(pending.response.status === 202, "Composed policy invocation did not create pending approval");
assert(pending.data.status === "pending_approval", "Invocation did not return pending_approval");
assert(/redaction also applies/u.test(pending.data.reason || ""), "Pending approval reason did not mention redaction");
console.log("[ok] invocation requires approval and carries redaction context");

const approved = await approve(pending.data.approval_id);
assert(approved.data?.account_number === "***", "Approved response did not redact account_number");
assert(approved.data?.profile?.external_id === "***", "Approved response did not redact profile.external_id");
assert(approved.data?.support_ticket === "TCK-***", "Approved response did not apply regex redaction");
console.log("[ok] approved invocation still applies redaction rules");

console.log("ATG policy clarity check passed");
