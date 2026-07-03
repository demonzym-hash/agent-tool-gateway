# ATG TypeScript SDK

Minimal JavaScript/TypeScript-friendly client for Agent Tool Gateway. The SDK uses the Node 18+ built-in `fetch` API, ships TypeScript declarations, and supports both REST invoke and MCP `tools/call`.

The SDK is a thin access path into the independent ATG gateway. Governance stays in ATG instead of being reimplemented in each JavaScript or TypeScript Agent project.

TypeScript declarations are included at `src/index.d.ts` and checked by `npm run check`.

## Invoke A Tool

```js
import { AtgClient } from "@atg/sdk";

const client = new AtgClient({ baseUrl: "http://localhost:8080", apiKey: "atg_..." });
const result = await client.invoke("refund_order", {
  order_id: "ord_ts_sdk",
  amount: 25,
  reason: "typescript_sdk_demo",
});
console.log(result);
```

## Admin Registry

```js
const adminClient = new AtgClient({ baseUrl: "http://localhost:8080", adminToken: "local-admin-secret" });
const agent = await adminClient.createAgent({ name: "sdk-agent", owner: "ops" });
const tool = await adminClient.createTool({
  name: "refund_order",
  endpoint: "http://localhost:9090/mock/refund_order",
  riskLevel: "medium",
});
await adminClient.testTool(tool.tool.id, { order_id: "ord_sdk_test", amount: 25 });
const agents = await adminClient.listAgents();
const tools = await adminClient.listTools();
const rotated = await adminClient.rotateAgentKey(agent.agent.id);
await adminClient.disableTool(tool.tool.id);
await adminClient.disableAgent(agent.agent.id);
```

## MCP Tools

```js
await client.mcpInitialize();
const tools = await client.mcpListTools();
const result = await client.mcpCallTool("refund_order", {
  order_id: "ord_ts_mcp",
  amount: 25,
  reason: "typescript_mcp_demo",
});
```

## Policy Preview

```js
const adminClient = new AtgClient({ baseUrl: "http://localhost:8080", adminToken: "local-admin-secret" });
const policy = await adminClient.createPolicy({
  name: "Approve large refunds",
  priority: 1,
  action: "approve",
  conditionJson: { tool: "refund_order", "args.amount": { gt: 100 } },
});

const preview = await adminClient.evaluatePolicy({
  agentId: "agent_id",
  toolName: "refund_order",
  input: { amount: 150 },
});
console.log(preview.decision);

const policies = await adminClient.listPolicies({ action: "approve", enabled: true });
console.log(policies.policies);
const policyDetail = await adminClient.getPolicy(policy.policy.id);
console.log(policyDetail.policy);

const disabled = await adminClient.disablePolicy(policy.policy.id);
console.log(disabled.policy.enabled);
```

## Approval Decisions

```js
const pending = await adminClient.listApprovals({ status: "pending", limit: 20 });
console.log(pending.approvals);
const approval = await adminClient.getApproval(pending.approvals[0].id);
console.log(approval.approval);

const pendingToday = await adminClient.listApprovals({
  status: "pending",
  from: "2026-06-01T00:00:00Z",
  to: "2026-07-01T00:00:00Z",
  limit: 50,
});
console.log(pendingToday.approvals);

const approved = await adminClient.approveApproval("approval_id", {
  approver: "alice",
  comment: "Approved from SDK",
});
console.log(approved.status);

const rejected = await adminClient.rejectApproval("approval_id", {
  approver: "alice",
  comment: "Rejected from SDK",
});
console.log(rejected.approval.status);
```

## Evidence Review

```js
const invocations = await adminClient.listInvocations({
  agentId: "agent_id",
  toolId: "tool_id",
  status: "success",
  from: "2026-06-01T00:00:00Z",
  to: "2026-07-01T00:00:00Z",
  limit: 20,
});
const auditLogs = await adminClient.listAuditLogs({
  eventType: "tool.invoke.succeeded",
  actorType: "agent",
  resourceType: "tool",
  from: "2026-06-01T00:00:00Z",
  to: "2026-07-01T00:00:00Z",
  limit: 20,
});
const invocation = await adminClient.getInvocation(invocations.invocations[0].id);
const auditLog = await adminClient.getAuditLog(auditLogs.audit_logs[0].id);
console.log(invocation.invocation, auditLog.audit_log);
```

## Example

```bash
cd sdk/typescript
ATG_API_KEY=$API_KEY ATG_TOOL_NAME=refund_order npm start
```

PowerShell:

```powershell
cd sdk/typescript
$env:ATG_API_KEY = $API_KEY
$env:ATG_TOOL_NAME = "refund_order"
npm start
```

Set `ATG_USE_MCP=1` to run the same example through `/mcp` and `tools/call`.
