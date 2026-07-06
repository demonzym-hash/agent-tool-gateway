function newestFirst(left, right) {
  return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
}

function latest(items, predicate, limit = 3) {
  return items.filter(predicate).sort(newestFirst).slice(0, limit);
}

export function getOverviewAttentionData({
  approvals = [],
  invocations = [],
  tools = [],
  policies = [],
} = {}) {
  return {
    pendingApprovals: latest(approvals, (approval) => approval.status === "pending"),
    failedInvocations: latest(
      invocations,
      (invocation) => invocation.status === "failed" || invocation.status === "denied",
    ),
    highRiskTools: tools
      .filter((tool) => tool.status === "active" && tool.risk_level === "high")
      .slice(0, 3),
    policySummary: {
      enabled: policies.filter((policy) => policy.enabled).length,
      disabled: policies.filter((policy) => !policy.enabled).length,
      approve: policies.filter((policy) => policy.action === "approve").length,
      redact: policies.filter((policy) => policy.action === "redact").length,
    },
  };
}

export function canDecideApproval(approval) {
  return approval?.status === "pending";
}
