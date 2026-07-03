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

    assert.deepEqual(decision, {
      action: "allow",
      reason: "No matching policy",
      matched_policy_id: null,
    });
  });

  it("returns the first matching enabled policy from the supplied order", () => {
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

    assert.deepEqual(decision, {
      action: "allow",
      reason: "Matched policy: Late allow",
      matched_policy_id: "policy_late",
      matched_policy_name: "Late allow",
    });
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

    assert.deepEqual(decision, {
      action: "approve",
      reason: "Matched policy: Approve large refunds",
      matched_policy_id: "policy_approve",
      matched_policy_name: "Approve large refunds",
    });
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

    assert.deepEqual(decision, {
      action: "approve",
      reason: "Matched policy: Approve VIP escalations",
      matched_policy_id: "policy_vip",
      matched_policy_name: "Approve VIP escalations",
    });
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

    assert.deepEqual(decision, {
      action: "allow",
      reason: "No matching policy",
      matched_policy_id: null,
    });
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

    assert.deepEqual(decision, {
      action: "redact",
      reason: "Matched policy: Redact account details",
      matched_policy_id: "policy_redact",
      matched_policy_name: "Redact account details",
      redaction: {
        fields: ["account_number"],
        patterns: [{ pattern: "TCK-\\d+", replacement: "TCK-***" }],
      },
    });
  });
});
