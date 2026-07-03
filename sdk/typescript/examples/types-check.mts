import { AtgClient, AtgError, type PolicyAction } from "../src/index.js";

const adminClient = new AtgClient({ baseUrl: "http://localhost:8080", adminToken: "local-admin-secret", timeoutMs: 5000 });
const invokeClient = new AtgClient({ apiKey: "atg_example" });

const action: PolicyAction = "approve";
const agent = await adminClient.createAgent({ name: "typed-agent", owner: "sdk" });
const tool = await adminClient.createTool({
  name: "typed_tool",
  endpoint: "http://localhost:9090/mock/refund_order",
  riskLevel: "medium",
  inputSchema: { type: "object" },
});
const policy = await adminClient.createPolicy({
  name: "Typed approve policy",
  action,
  conditionJson: { tool: "typed_tool", "args.amount": { gt: 100 } },
});

const preview = await adminClient.evaluatePolicy({
  agentId: agent.agent.id,
  toolId: tool.tool.id,
  input: { amount: 150 },
});
const decisionAction: PolicyAction = preview.decision.action;

await adminClient.listPolicies({ action: decisionAction, enabled: true });
await adminClient.getPolicy(policy.policy.id);
await adminClient.listApprovals({ status: "pending", from: "2026-06-01T00:00:00Z", limit: 20 });
await adminClient.listInvocations({ agentId: agent.agent.id, toolId: tool.tool.id, status: "success", limit: 20 });
await adminClient.listAuditLogs({ eventType: "tool.invoke.succeeded", actorType: "agent", resourceType: "tool", limit: 20 });
await adminClient.getApproval("approval_id");
await adminClient.getInvocation("invocation_id");
await adminClient.getAuditLog("audit_id");
await adminClient.disablePolicy(policy.policy.id);
await invokeClient.invoke("typed_tool", { amount: 25 });

try {
  await invokeClient.mcpCallTool("typed_tool", { amount: 25 });
} catch (error) {
  if (error instanceof AtgError) {
    console.log(error.statusCode);
  }
}
