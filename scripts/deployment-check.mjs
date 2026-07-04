import crypto from "node:crypto";

const args = new Set(process.argv.slice(2));
const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const adminToken = process.env.ADMIN_TOKEN || "";
const toolEndpoint = args.has("--local-mock")
  ? "http://localhost:9090/mock/refund_order"
  : process.env.MOCK_TOOL_ENDPOINT || "http://mock-api:9090/mock/refund_order";
const runId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const checks = [];

function record(level, name, detail = "") {
  checks.push({ level, name, detail });
  console.log(`[${level}] ${name}${detail ? `: ${detail}` : ""}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function adminHeaders() {
  return adminToken ? { "x-admin-token": adminToken } : {};
}

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

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalJson(value[key]);
        return result;
      }, {});
  }
  return value;
}

function sha256Json(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalJson(value))).digest("hex");
}

async function verifyAdminGate() {
  if (!adminToken) {
    record("warn", "admin token gate", "ADMIN_TOKEN is not set locally; management auth cannot be verified");
    return;
  }

  const withoutToken = await request("/api/v1/agents", {}, { allowStatuses: [401] });
  if (withoutToken.response.status === 401) {
    record("ok", "admin token gate", "management API rejects requests without the token");
    return;
  }
  record("warn", "admin token gate", "management API accepted a request without the token");
}

async function createAgent() {
  const { data } = await request("/api/v1/agents", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name: `deployment-agent-${runId}`,
      owner: "deployment-check",
      description: "Created by ATG deployment check",
    }),
  });
  assert(data.agent?.id, "Agent response did not include an id");
  assert(/^atg_/.test(data.api_key || ""), "Agent API key was not returned");
  record("ok", "agent registry", data.agent.name);
  return data;
}

async function createTool() {
  const name = `deployment_refund_${runId}`;
  const { data } = await request("/api/v1/tools", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name,
      description: "Deployment check refund Tool",
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
  record("ok", "tool registry", name);
  return data.tool;
}

async function createApprovalPolicy(toolName) {
  const { data } = await request("/api/v1/policies", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name: `Deployment approve refunds ${runId}`,
      priority: 1,
      action: "approve",
      condition_json: { tool: toolName, "args.amount": { gt: 100 } },
    }),
  });
  assert(data.policy?.id, "Policy response did not include an id");
  record("ok", "policy registry", data.policy.id);
  return data.policy;
}

async function invokeForApproval(apiKey, toolName) {
  const { response, data } = await request(
    `/api/v1/invoke/${toolName}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        order_id: `ord_deployment_${runId}`,
        amount: 150,
        reason: "deployment check approval path",
      }),
    },
    { allowStatuses: [202] },
  );
  assert(response.status === 202, "Invocation did not require approval");
  assert(data.status === "pending_approval", "Invocation did not return pending_approval");
  assert(data.approval_id, "Pending invocation did not include approval_id");
  record("ok", "approval policy path", data.approval_id);
  return data;
}

async function approveInvocation(approvalId, invocationId) {
  const { data } = await request(`/api/v1/approvals/${approvalId}/approve`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      approver: "deployment-check",
      comment: "Approved by deployment check",
    }),
  });
  assert(data.status === "success", "Approval execution did not succeed");
  assert(data.invocation_id === invocationId, "Approval response referenced the wrong invocation");
  record("ok", "approval execution", data.audit_id);
  return data;
}

async function verifyStoredRecords({ invocationId, approvalId, auditId }) {
  const invocation = await request(`/api/v1/invocations/${invocationId}`, { headers: adminHeaders() });
  assert(invocation.data.invocation?.status === "success", "Invocation did not persist as success");

  const approval = await request(`/api/v1/approvals/${approvalId}`, { headers: adminHeaders() });
  assert(approval.data.approval?.status === "approved", "Approval did not persist as approved");

  const audit = await request(`/api/v1/audit-logs/${auditId}`, { headers: adminHeaders() });
  assert(audit.data.audit_log?.event_type === "approval.approved.executed", "Audit log did not record approval execution");
  record("ok", "persisted records", "invocation, approval, and audit details are readable");
}

async function verifyEvidenceExport({ toolId, policyId, invocationId, approvalId }) {
  const { data } = await request(
    `/api/v1/evidence/export?invocation_tool_id=${toolId}&approval_status=approved&policy_action=approve&limit=50`,
    { headers: adminHeaders() },
  );
  const evidence = data.evidence;
  assert(evidence?.manifest?.format === "atg.evidence.export.v1", "Evidence export format is wrong");
  assert(evidence.datasets.invocations.some((item) => item.id === invocationId), "Evidence export missed the checked invocation");
  assert(evidence.datasets.approvals.some((item) => item.id === approvalId), "Evidence export missed the checked approval");
  assert(evidence.datasets.policies.some((item) => item.id === policyId), "Evidence export missed the checked policy");

  for (const name of ["invocations", "approvals", "audit_logs", "policies"]) {
    const expected = evidence.manifest.dataset_hashes?.[`${name}_sha256`];
    assert(expected === sha256Json(evidence.datasets[name]), `Evidence ${name} hash did not match`);
    assert(evidence.manifest.counts?.[name] === evidence.datasets[name].length, `Evidence ${name} count did not match`);
  }

  const manifestForHash = { ...evidence.manifest };
  delete manifestForHash.manifest_sha256;
  assert(evidence.manifest.manifest_sha256 === sha256Json(manifestForHash), "Evidence manifest hash did not match");
  record("ok", "evidence export", "datasets, counts, and hashes verified");
}

console.log(`ATG deployment check target: ${baseUrl}`);
console.log(`Tool endpoint: ${toolEndpoint}`);

try {
  const health = await request("/healthz");
  assert(health.data.status === "ok", "Health check did not return ok");
  record("ok", "healthz", baseUrl);

  await verifyAdminGate();

  const agent = await createAgent();
  const tool = await createTool();
  const policy = await createApprovalPolicy(tool.name);
  const pending = await invokeForApproval(agent.api_key, tool.name);
  const approved = await approveInvocation(pending.approval_id, pending.invocation_id);

  await verifyStoredRecords({
    invocationId: pending.invocation_id,
    approvalId: pending.approval_id,
    auditId: approved.audit_id,
  });
  await verifyEvidenceExport({
    toolId: tool.id,
    policyId: policy.id,
    invocationId: pending.invocation_id,
    approvalId: pending.approval_id,
  });
} catch (error) {
  record("fail", "deployment check", error.message);
  console.error("\nATG deployment check failed.");
  process.exit(1);
}

const warningCount = checks.filter((check) => check.level === "warn").length;
console.log(`\nATG deployment check passed${warningCount ? ` with ${warningCount} warning(s)` : ""}.`);
