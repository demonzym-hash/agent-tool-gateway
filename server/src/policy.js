function getPathValue(source, path) {
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), source);
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

function matchesCondition({ condition, agent, tool, input }) {
  for (const [key, expected] of Object.entries(condition || {})) {
    let actual;
    if (key === "agent_id") actual = agent.id;
    else if (key === "agent") actual = agent.name;
    else if (key === "tool_id") actual = tool.id;
    else if (key === "tool") actual = tool.name;
    else if (key === "risk_level") actual = tool.risk_level;
    else if (key.startsWith("args.")) actual = getPathValue(input, key.slice("args.".length));
    else actual = undefined;

    if (!matchesValue(actual, expected)) {
      return false;
    }
  }
  return true;
}

export function evaluatePolicy({ agent, tool, input, policies = [] }) {
  for (const policy of policies) {
    if (!policy.enabled) continue;
    if (!matchesCondition({ condition: policy.condition_json, agent, tool, input })) continue;
    const decision = {
      action: policy.action,
      reason: `Matched policy: ${policy.name}`,
      matched_policy_id: policy.id,
      matched_policy_name: policy.name,
    };
    if (policy.action === "redact" && policy.scope?.redaction) {
      decision.redaction = policy.scope.redaction;
    }
    return decision;
  }

  return {
    action: "allow",
    reason: "No matching policy",
    matched_policy_id: null,
  };
}
