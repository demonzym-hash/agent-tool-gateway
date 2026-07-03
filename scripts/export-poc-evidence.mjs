import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const options = parseArgs(process.argv.slice(2));
const baseUrl = options.baseUrl || process.env.ATG_BASE_URL || "http://localhost:8080";
const adminToken = options.adminToken || process.env.ADMIN_TOKEN || "";
const outputDir = options.outputDir || process.env.POC_EVIDENCE_DIR || ".runtime/poc-evidence";
const limit = Number(options.limit || process.env.POC_EVIDENCE_LIMIT || 100);
const from = options.from || process.env.POC_EVIDENCE_FROM || "";
const to = options.to || process.env.POC_EVIDENCE_TO || "";
const invocationStatus = options.invocationStatus || process.env.POC_EVIDENCE_INVOCATION_STATUS || "";
const approvalStatus = options.approvalStatus || process.env.POC_EVIDENCE_APPROVAL_STATUS || "";
const auditEventType = options.auditEventType || process.env.POC_EVIDENCE_AUDIT_EVENT_TYPE || "";
const auditActorType = options.auditActorType || process.env.POC_EVIDENCE_AUDIT_ACTOR_TYPE || "";
const auditResourceType = options.auditResourceType || process.env.POC_EVIDENCE_AUDIT_RESOURCE_TYPE || "";
const policyAction = options.policyAction || process.env.POC_EVIDENCE_POLICY_ACTION || "";
const policyEnabled = parseOptionalBoolean(options.policyEnabled ?? process.env.POC_EVIDENCE_POLICY_ENABLED ?? "");

if (options.help) {
  console.log(usage());
  process.exit(0);
}
if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
  throw new Error("--limit must be an integer between 1 and 500");
}
for (const [label, value] of [
  ["--from", from],
  ["--to", to],
]) {
  if (value && Number.isNaN(new Date(value).getTime())) {
    throw new Error(`${label} must be a valid date-time value`);
  }
}
if (policyEnabled === "invalid") {
  throw new Error("--policy-enabled must be true or false");
}

function adminHeaders() {
  return adminToken ? { "x-admin-token": adminToken } : {};
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[i];
    };

    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--base-url") parsed.baseUrl = next();
    else if (arg === "--admin-token") parsed.adminToken = next();
    else if (arg === "--out" || arg === "--output-dir") parsed.outputDir = next();
    else if (arg === "--limit") parsed.limit = next();
    else if (arg === "--from") parsed.from = next();
    else if (arg === "--to") parsed.to = next();
    else if (arg === "--invocation-status") parsed.invocationStatus = next();
    else if (arg === "--approval-status") parsed.approvalStatus = next();
    else if (arg === "--audit-event-type") parsed.auditEventType = next();
    else if (arg === "--audit-actor-type") parsed.auditActorType = next();
    else if (arg === "--audit-resource-type") parsed.auditResourceType = next();
    else if (arg === "--policy-action") parsed.policyAction = next();
    else if (arg === "--policy-enabled") parsed.policyEnabled = next();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function usage() {
  return `Usage:
  npm run evidence:local -- [options]

Options:
  --base-url <url>       ATG server URL. Defaults to ATG_BASE_URL or http://localhost:8080.
  --admin-token <token>  Admin token. Defaults to ADMIN_TOKEN.
  --out <dir>            Output directory. Defaults to POC_EVIDENCE_DIR or .runtime/poc-evidence.
  --limit <n>            Max invocations, audit logs, and approvals to export, 1-500. Defaults to 100.
  --from <date-time>     Filter invocations, audit logs, and approvals created at or after this time.
  --to <date-time>       Filter invocations, audit logs, and approvals created at or before this time.
  --invocation-status <status>
                         Filter invocations by status, such as success, denied, or pending_approval.
  --approval-status <status>
                         Filter approvals by status, such as pending, approved, or rejected.
  --audit-event-type <type>
                         Filter audit logs by event_type.
  --audit-actor-type <type>
                         Filter audit logs by actor_type, such as admin, agent, or approver.
  --audit-resource-type <type>
                         Filter audit logs by resource_type, such as tool, policy, or approval.
  --policy-action <action>
                         Filter policy snapshots by action, such as deny, approve, or redact.
  --policy-enabled <true|false>
                         Filter policy snapshots by enabled state.

Policy exports are configuration snapshots and are not filtered by time.`;
}

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...adminHeaders(),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function writeJson(name, data) {
  const file = join(outputDir, name);
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`[ok] wrote ${file}`);
}

await mkdir(outputDir, { recursive: true });

const invocationQuery = createReviewQuery({ status: invocationStatus });
const auditQuery = createReviewQuery({
  event_type: auditEventType,
  actor_type: auditActorType,
  resource_type: auditResourceType,
});
const approvalQuery = createReviewQuery({ status: approvalStatus });
const policyQuery = createPolicyQuery();

const [health, invocations, auditLogs, approvals, policies] = await Promise.all([
  request("/healthz"),
  request(`/api/v1/invocations?${invocationQuery.toString()}`),
  request(`/api/v1/audit-logs?${auditQuery.toString()}`),
  request(`/api/v1/approvals?${approvalQuery.toString()}`),
  request(`/api/v1/policies${policyQuery.toString() ? `?${policyQuery.toString()}` : ""}`),
]);

const generatedAt = new Date().toISOString();
const summary = {
  generated_at: generatedAt,
  base_url: baseUrl,
  output_dir: outputDir,
  limit,
  filters: {
    from: from ? new Date(from).toISOString() : null,
    to: to ? new Date(to).toISOString() : null,
    invocation_status: invocationStatus || null,
    approval_status: approvalStatus || null,
    audit_event_type: auditEventType || null,
    audit_actor_type: auditActorType || null,
    audit_resource_type: auditResourceType || null,
    policy_action: policyAction || null,
    policy_enabled: policyEnabled,
  },
  health,
  counts: {
    invocations: invocations.invocations?.length || 0,
    audit_logs: auditLogs.audit_logs?.length || 0,
    approvals: approvals.approvals?.length || 0,
    policies: policies.policies?.length || 0,
  },
  invocation_statuses: countBy(invocations.invocations || [], "status"),
  audit_event_types: countBy(auditLogs.audit_logs || [], "event_type"),
  approval_statuses: countBy(approvals.approvals || [], "status"),
  policy_actions: countBy(policies.policies || [], "action"),
  policy_enabled: countBy(policies.policies || [], "enabled"),
};

await writeJson("summary.json", summary);
await writeJson("invocations.json", invocations);
await writeJson("audit_logs.json", auditLogs);
await writeJson("approvals.json", approvals);
await writeJson("policies.json", policies);
await writeCsv("invocations.csv", invocations.invocations || [], [
  "id",
  "created_at",
  "status",
  "agent_id",
  "agent_name",
  "tool_id",
  "tool_name",
  "matched_policy_id",
  "approval_id",
  "latency_ms",
  "error_message",
  "request_args",
  "response_data_redacted",
]);
await writeCsv("audit_logs.csv", auditLogs.audit_logs || [], [
  "id",
  "created_at",
  "event_type",
  "actor_type",
  "actor_id",
  "resource_type",
  "resource_id",
  "detail_json",
]);
await writeCsv("approvals.csv", approvals.approvals || [], [
  "id",
  "created_at",
  "updated_at",
  "invocation_id",
  "status",
  "approver",
  "reason",
  "comment",
]);
await writeCsv("policies.csv", policies.policies || [], [
  "id",
  "created_at",
  "updated_at",
  "name",
  "action",
  "priority",
  "enabled",
  "condition_json",
  "scope",
]);
await writeMarkdown("README.md", createEvidenceReadme(summary));

console.log("\nATG PoC evidence export complete.");

async function writeCsv(name, rows, columns) {
  const file = join(outputDir, name);
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row?.[column])).join(","));
  }
  await writeFile(file, `${lines.join("\n")}\n`, "utf8");
  console.log(`[ok] wrote ${file}`);
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const value = item[field] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function createEvidenceReadme(data) {
  const filters = Object.entries(data.filters)
    .map(([key, value]) => `| ${key} | ${value === null || value === "" ? "-" : String(value)} |`)
    .join("\n");
  const counts = Object.entries(data.counts)
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n");
  const sections = [
    "# ATG PoC Evidence",
    "",
    `Generated at: ${data.generated_at}`,
    `ATG base URL: ${data.base_url}`,
    `Export limit: ${data.limit}`,
    "",
    "## Filters",
    "",
    "| Filter | Value |",
    "|---|---|",
    filters,
    "",
    "## Counts",
    "",
    "| Dataset | Rows |",
    "|---|---:|",
    counts,
    "",
    "## Review Files",
    "",
    "- `summary.json`: machine-readable export metadata and aggregate counts.",
    "- `invocations.json` / `invocations.csv`: tool call evidence with Agent, Tool, status, policy, approval, request, and redacted response fields.",
    "- `audit_logs.json` / `audit_logs.csv`: audit events for registry changes, policy decisions, approvals, and tool execution.",
    "- `approvals.json` / `approvals.csv`: approval records and reviewer comments.",
    "- `policies.json` / `policies.csv`: policy configuration snapshots.",
    "",
    "## Notes",
    "",
    "- Tool responses in invocation evidence are redacted by ATG before export.",
    "- Policy exports are configuration snapshots and are not filtered by time.",
    "- Use filtered exports when preparing customer-specific review bundles.",
    "",
  ];
  return `${sections.join("\n")}`;
}

async function writeMarkdown(name, content) {
  const file = join(outputDir, name);
  await writeFile(file, content, "utf8");
  console.log(`[ok] wrote ${file}`);
}

function createReviewQuery(extra = {}) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (from) query.set("from", new Date(from).toISOString());
  if (to) query.set("to", new Date(to).toISOString());
  for (const [key, value] of Object.entries(extra)) {
    if (value) query.set(key, value);
  }
  return query;
}

function createPolicyQuery() {
  const query = new URLSearchParams();
  if (policyAction) query.set("action", policyAction);
  if (policyEnabled !== null) query.set("enabled", String(policyEnabled));
  return query;
}

function parseOptionalBoolean(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return "invalid";
}
