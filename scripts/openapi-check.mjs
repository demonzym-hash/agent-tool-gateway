import { readFileSync } from "node:fs";

const specPath = "openapi/atg-openapi.yaml";
const spec = readFileSync(specPath, "utf8");

const requiredFragments = [
  "openapi: 3.1.0",
  "version: 0.1.0",
  "/healthz:",
  "/api/v1/agents:",
  "/api/v1/tools:",
  "/api/v1/policies:",
  "/api/v1/policies/{id}:",
  "/api/v1/policies/{id}/disable:",
  "/api/v1/policies/evaluate:",
  "/api/v1/invoke/{tool_name}:",
  "/api/v1/invocations:",
  "/api/v1/invocations/{id}:",
  "/api/v1/approvals:",
  "/api/v1/approvals/{id}:",
  "/api/v1/audit-logs:",
  "/api/v1/audit-logs/{id}:",
  "/mcp:",
  "AdminToken:",
  "AgentApiKey:",
  "scope:",
  "redaction:",
  "Filter policies by action.",
  "Filter policies by enabled state.",
  "Simple path placeholders",
  "PolicyEvaluateRequest:",
  "PolicyEvaluateResult:",
  "PolicyDecision:",
  "matched_policies:",
  "redaction_policy_ids:",
];

for (const fragment of requiredFragments) {
  if (!spec.includes(fragment)) {
    throw new Error(`${specPath} is missing required fragment: ${fragment}`);
  }
}

const invalidIndentFragments = ["          scope:", "          condition_json:"];
for (const fragment of invalidIndentFragments) {
  if (spec.includes(fragment)) {
    throw new Error(`${specPath} has invalid PolicyCreate indentation near: ${fragment.trim()}`);
  }
}

console.log("ATG OpenAPI check passed");
