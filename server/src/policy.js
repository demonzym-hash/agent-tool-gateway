function getPathValue(source, path) {
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function policyRef(policy, { matched = true, reason = "" } = {}) {
  return {
    id: policy.id,
    name: policy.name,
    action: policy.action,
    priority: policy.priority,
    matched,
    reason,
  };
}

function matchesRegex(actual, pattern, flags = "") {
  try {
    return new RegExp(String(pattern), String(flags)).test(String(actual ?? ""));
  } catch {
    return false;
  }
}

function matchesValue(actual, expected) {
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    if (Object.prototype.hasOwnProperty.call(expected, "eq") && actual !== expected.eq) return false;
    if (Object.prototype.hasOwnProperty.call(expected, "gt") && !(Number(actual) > Number(expected.gt))) return false;
    if (Object.prototype.hasOwnProperty.call(expected, "gte") && !(Number(actual) >= Number(expected.gte))) return false;
    if (Object.prototype.hasOwnProperty.call(expected, "lt") && !(Number(actual) < Number(expected.lt))) return false;
    if (Object.prototype.hasOwnProperty.call(expected, "lte") && !(Number(actual) <= Number(expected.lte))) return false;
    if (Object.prototype.hasOwnProperty.call(expected, "contains")) {
      if (!String(actual ?? "").includes(String(expected.contains))) return false;
    }
    if (Object.prototype.hasOwnProperty.call(expected, "starts_with")) {
      if (!String(actual ?? "").startsWith(String(expected.starts_with))) return false;
    }
    if (Object.prototype.hasOwnProperty.call(expected, "ends_with")) {
      if (!String(actual ?? "").endsWith(String(expected.ends_with))) return false;
    }
    if (Object.prototype.hasOwnProperty.call(expected, "regex")) {
      if (!matchesRegex(actual, expected.regex, expected.flags || "")) return false;
    }
    return true;
  }
  return actual === expected;
}

function conditionSubject({ key, agent, tool, input }) {
  if (key === "agent_id") return { actual: agent.id, label: "agent id" };
  if (key === "agent") return { actual: agent.name, label: "agent name" };
  if (key === "tool_id") return { actual: tool.id, label: "tool id" };
  if (key === "tool") return { actual: tool.name, label: "tool name" };
  if (key === "risk_level") return { actual: tool.risk_level, label: "tool risk level" };
  if (key.startsWith("args.")) {
    const argumentPath = key.slice("args.".length);
    return { actual: getPathValue(input, argumentPath), label: `argument ${argumentPath}` };
  }
  return { actual: undefined, label: key };
}

function evaluateCondition({ condition, agent, tool, input }) {
  const checks = [];
  for (const [key, expected] of Object.entries(condition || {})) {
    const { actual, label } = conditionSubject({ key, agent, tool, input });
    const matched = matchesValue(actual, expected);
    checks.push({
      key,
      label,
      matched,
      operator:
        expected && typeof expected === "object" && !Array.isArray(expected)
          ? Object.keys(expected).join(",") || "object"
          : "eq",
    });

    if (!matched) {
      return { matched: false, checks, reason: `Condition did not match: ${key}` };
    }
  }
  return { matched: true, checks, reason: "All conditions matched" };
}

function mergeRedactionRules(policies) {
  const fields = [];
  const patterns = [];

  for (const policy of policies) {
    const redaction = policy.scope?.redaction;
    if (!redaction) continue;
    if (Array.isArray(redaction.fields)) fields.push(...redaction.fields);
    if (Array.isArray(redaction.patterns)) patterns.push(...redaction.patterns);
  }

  return {
    ...(fields.length ? { fields: [...new Set(fields)] } : {}),
    ...(patterns.length ? { patterns } : {}),
  };
}

function pickPrimaryPolicy({ denyPolicies, approvePolicies, allowPolicies, redactPolicies }) {
  if (denyPolicies.length) return denyPolicies[0];
  if (approvePolicies.length) return approvePolicies[0];
  if (allowPolicies.length) return allowPolicies[0];
  if (redactPolicies.length) return redactPolicies[0];
  return null;
}

function composeReason({ action, primaryPolicy, redactPolicies }) {
  if (!primaryPolicy) return "No matching policy";
  const base =
    action === "deny"
      ? `Denied by policy: ${primaryPolicy.name}`
      : action === "approve"
        ? `Approval required by policy: ${primaryPolicy.name}`
        : action === "redact"
          ? `Redaction policy matched: ${primaryPolicy.name}`
          : `Allowed by policy: ${primaryPolicy.name}`;
  const additionalRedactions = redactPolicies.filter((policy) => policy.id !== primaryPolicy.id);
  if (action === "deny" || !additionalRedactions.length) return base;
  return `${base}; redaction also applies: ${additionalRedactions.map((policy) => policy.name).join(", ")}`;
}

export function evaluatePolicy({ agent, tool, input, policies = [] }) {
  const evaluated_policies = [];
  const matchedPolicies = [];

  for (const policy of policies) {
    if (!policy.enabled) {
      evaluated_policies.push(policyRef(policy, { matched: false, reason: "Policy is disabled" }));
      continue;
    }

    const conditionResult = evaluateCondition({ condition: policy.condition_json, agent, tool, input });
    evaluated_policies.push({
      ...policyRef(policy, { matched: conditionResult.matched, reason: conditionResult.reason }),
      checks: conditionResult.checks,
    });
    if (conditionResult.matched) matchedPolicies.push(policy);
  }

  if (!matchedPolicies.length) {
    return {
      action: "allow",
      reason: "No matching policy",
      matched_policy_id: null,
      matched_policies: [],
      redaction_policy_ids: [],
      explanation: ["No enabled policy matched the agent, tool, and input. The default decision is allow."],
      evaluation: {
        mode: "composed",
        precedence: ["deny", "approve", "allow", "redact"],
        evaluated_policies,
      },
    };
  }

  const denyPolicies = matchedPolicies.filter((policy) => policy.action === "deny");
  const approvePolicies = matchedPolicies.filter((policy) => policy.action === "approve");
  const allowPolicies = matchedPolicies.filter((policy) => policy.action === "allow");
  const redactPolicies = matchedPolicies.filter((policy) => policy.action === "redact");
  const primaryPolicy = pickPrimaryPolicy({ denyPolicies, approvePolicies, allowPolicies, redactPolicies });
  const redaction = mergeRedactionRules(redactPolicies);
  const action = denyPolicies.length ? "deny" : approvePolicies.length ? "approve" : allowPolicies.length ? "allow" : "redact";
  const explanation = [
    `Matched ${matchedPolicies.length} enabled ${matchedPolicies.length === 1 ? "policy" : "policies"}.`,
    denyPolicies.length
      ? "Deny policies take precedence over approve, allow, and redact."
      : approvePolicies.length
        ? "Approval policies take precedence over allow. Redaction policies are applied after approval."
        : allowPolicies.length
          ? "Allow policies permit execution. Redaction policies still apply to the response."
          : "Only redaction policies matched, so execution is allowed with response redaction.",
  ];

  return {
    action,
    reason: composeReason({ action, primaryPolicy, redactPolicies }),
    matched_policy_id: primaryPolicy?.id || null,
    matched_policy_name: primaryPolicy?.name || null,
    matched_policies: matchedPolicies.map((policy) => policyRef(policy)),
    redaction_policy_ids: redactPolicies.map((policy) => policy.id),
    ...(Object.keys(redaction).length ? { redaction } : {}),
    explanation,
    evaluation: {
      mode: "composed",
      precedence: ["deny", "approve", "allow", "redact"],
      evaluated_policies,
    },
  };
}
