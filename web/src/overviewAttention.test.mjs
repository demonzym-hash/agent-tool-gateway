import assert from "node:assert/strict";
import test from "node:test";

import { canDecideApproval, getOverviewAttentionData } from "./overviewAttention.js";

test("builds overview attention data from existing console collections", () => {
  const data = getOverviewAttentionData({
    approvals: [
      { id: "old-pending", status: "pending", created_at: "2026-07-03T00:00:00Z" },
      { id: "approved", status: "approved", created_at: "2026-07-05T00:00:00Z" },
      { id: "new-pending", status: "pending", created_at: "2026-07-06T00:00:00Z" },
    ],
    invocations: [
      { id: "success", status: "success", created_at: "2026-07-06T00:00:00Z" },
      { id: "failed", status: "failed", created_at: "2026-07-04T00:00:00Z" },
      { id: "denied", status: "denied", created_at: "2026-07-05T00:00:00Z" },
    ],
    tools: [
      { id: "low", status: "active", risk_level: "low" },
      { id: "disabled-high", status: "disabled", risk_level: "high" },
      { id: "active-high", status: "active", risk_level: "high" },
    ],
    policies: [
      { id: "enabled-approve", enabled: true, action: "approve" },
      { id: "disabled-redact", enabled: false, action: "redact" },
      { id: "enabled-redact", enabled: true, action: "redact" },
    ],
  });

  assert.deepEqual(
    data.pendingApprovals.map((approval) => approval.id),
    ["new-pending", "old-pending"],
  );
  assert.deepEqual(
    data.failedInvocations.map((invocation) => invocation.id),
    ["denied", "failed"],
  );
  assert.deepEqual(
    data.highRiskTools.map((tool) => tool.id),
    ["active-high"],
  );
  assert.deepEqual(data.policySummary, {
    enabled: 2,
    disabled: 1,
    approve: 1,
    redact: 2,
  });
});

test("only pending approvals can be decided from the console", () => {
  assert.equal(canDecideApproval({ status: "pending" }), true);
  assert.equal(canDecideApproval({ status: "approved" }), false);
  assert.equal(canDecideApproval({ status: "rejected" }), false);
  assert.equal(canDecideApproval(null), false);
});
