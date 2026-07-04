import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePolicy } from "../src/policy.js";

describe("policy evaluation", () => {
  it("allows week 1 invocations while preserving a PolicyDecision shape", () => {
    const decision = evaluatePolicy({
      agent: { id: "agent_1" },
      tool: { id: "tool_1" },
      input: { order_id: "ord_demo" },
    });

    assert.equal(decision.action, "allow");
    assert.equal(decision.reason, "No matching policy");
    assert.equal(decision.matched_policy_id, null);
    assert.deepEqual(decision.matched_policies, []);
    assert.deepEqual(decision.redaction_policy_ids, []);
    assert.equal(decision.evaluation.mode, "composed");
  });

  it("lets deny policies take precedence over earlier allow policies", () => {
    const decision = evaluatePolicy({
      agent: { id: "agent_1", name: "support" },
      tool: { id: "tool_1", name: "refund_order", risk_level: "medium" },
      input: { amount: 150 },
      policies: [
        {
          id: "policy_late",
          name: "Late allow",
          action: "allow",
          enabled: true,
          condition_json: { tool: "refund_order" },
        },
        {
          id: "policy_deny",
          name: "Deny large refunds",
          action: "deny",
          enabled: true,
          condition_json: { tool: "refund_order", "args.amount": { gt: 100 } },
        },
      ],
    });

    assert.equal(decision.action, "deny");
    assert.equal(decision.reason, "Denied by policy: Deny large refunds");
    assert.equal(decision.matched_policy_id, "policy_deny");
    assert.deepEqual(
      decision.matched_policies.map((policy) => policy.id),
      ["policy_late", "policy_deny"],
    );
    assert.match(decision.explanation.join(" "), /Deny policies take precedence/);
  });

  it("matches nested argument comparison conditions", () => {
    const decision = evaluatePolicy({
      agent: { id: "agent_1", name: "support" },
      tool: { id: "tool_1", name: "refund_approval", risk_level: "medium" },
      input: { amount: 150 },
      policies: [
        {
          id: "policy_approve",
          name: "Approve large refunds",
          action: "approve",
          enabled: true,
          condition_json: { tool: "refund_approval", "args.amount": { gt: 100 } },
        },
      ],
    });

    assert.equal(decision.action, "approve");
    assert.equal(decision.reason, "Approval required by policy: Approve large refunds");
    assert.equal(decision.matched_policy_id, "policy_approve");
    assert.equal(decision.matched_policy_name, "Approve large refunds");
  });

  it("matches nested argument string conditions", () => {
    const decision = evaluatePolicy({
      agent: { id: "agent_1", name: "support" },
      tool: { id: "tool_1", name: "refund_approval", risk_level: "medium" },
      input: { order_id: "ord_vip_20260630", reason: "VIP customer escalation" },
      policies: [
        {
          id: "policy_vip",
          name: "Approve VIP escalations",
          action: "approve",
          enabled: true,
          condition_json: {
            tool: "refund_approval",
            "args.order_id": { starts_with: "ord_", ends_with: "0630", regex: "^ord_vip_\\d+$" },
            "args.reason": { contains: "VIP" },
          },
        },
      ],
    });

    assert.equal(decision.action, "approve");
    assert.equal(decision.matched_policy_id, "policy_vip");
    assert.equal(decision.evaluation.evaluated_policies[0].matched, true);
    assert.equal(decision.evaluation.evaluated_policies[0].checks.length, 3);
  });

  it("does not match invalid regex string conditions", () => {
    const decision = evaluatePolicy({
      agent: { id: "agent_1", name: "support" },
      tool: { id: "tool_1", name: "refund_approval", risk_level: "medium" },
      input: { order_id: "ord_vip_20260630" },
      policies: [
        {
          id: "policy_invalid_regex",
          name: "Invalid regex",
          action: "deny",
          enabled: true,
          condition_json: { "args.order_id": { regex: "[" } },
        },
      ],
    });

    assert.equal(decision.action, "allow");
    assert.equal(decision.matched_policy_id, null);
    assert.equal(decision.evaluation.evaluated_policies[0].matched, false);
    assert.equal(decision.evaluation.evaluated_policies[0].reason, "Condition did not match: args.order_id");
  });

  it("carries custom redaction rules from redact policy scope", () => {
    const decision = evaluatePolicy({
      agent: { id: "agent_1", name: "support" },
      tool: { id: "tool_1", name: "search_account", risk_level: "low" },
      input: { customer_id: "cus_1" },
      policies: [
        {
          id: "policy_redact",
          name: "Redact account details",
          action: "redact",
          enabled: true,
          scope: {
            redaction: {
              fields: ["account_number"],
              patterns: [{ pattern: "TCK-\\d+", replacement: "TCK-***" }],
            },
          },
          condition_json: { tool: "search_account" },
        },
      ],
    });

    assert.equal(decision.action, "redact");
    assert.equal(decision.reason, "Redaction policy matched: Redact account details");
    assert.equal(decision.matched_policy_id, "policy_redact");
    assert.equal(decision.matched_policy_name, "Redact account details");
    assert.deepEqual(decision.redaction, {
      fields: ["account_number"],
      patterns: [{ pattern: "TCK-\\d+", replacement: "TCK-***" }],
    });
    assert.deepEqual(decision.redaction_policy_ids, ["policy_redact"]);
  });

  it("combines approval with redaction rules", () => {
    const decision = evaluatePolicy({
      agent: { id: "agent_1", name: "support" },
      tool: { id: "tool_1", name: "refund_approval", risk_level: "medium" },
      input: { amount: 150 },
      policies: [
        {
          id: "policy_approve",
          name: "Approve large refunds",
          action: "approve",
          enabled: true,
          condition_json: { tool: "refund_approval", "args.amount": { gt: 100 } },
        },
        {
          id: "policy_redact",
          name: "Redact refund response",
          action: "redact",
          enabled: true,
          scope: { redaction: { fields: ["email"] } },
          condition_json: { tool: "refund_approval" },
        },
      ],
    });

    assert.equal(decision.action, "approve");
    assert.equal(decision.matched_policy_id, "policy_approve");
    assert.deepEqual(decision.redaction, { fields: ["email"] });
    assert.deepEqual(decision.redaction_policy_ids, ["policy_redact"]);
    assert.match(decision.reason, /redaction also applies/);
  });

  it("keeps deny as the final decision when deny and redact both match", () => {
    const decision = evaluatePolicy({
      agent: { id: "agent_1", name: "support" },
      tool: { id: "tool_1", name: "delete_user", risk_level: "high" },
      input: { user_id: "user_1" },
      policies: [
        {
          id: "policy_redact",
          name: "Redact dangerous response",
          action: "redact",
          enabled: true,
          scope: { redaction: { fields: ["email"] } },
          condition_json: { tool: "delete_user" },
        },
        {
          id: "policy_deny",
          name: "Deny dangerous operation",
          action: "deny",
          enabled: true,
          condition_json: { tool: "delete_user" },
        },
      ],
    });

    assert.equal(decision.action, "deny");
    assert.equal(decision.reason, "Denied by policy: Deny dangerous operation");
    assert.equal(decision.matched_policy_id, "policy_deny");
    assert.deepEqual(decision.redaction_policy_ids, ["policy_redact"]);
  });
});
