const args = new Set(process.argv.slice(2));
const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const adminToken = process.env.ADMIN_TOKEN || "";
const toolEndpoint = args.has("--local-mock")
  ? "http://localhost:9090/mock/secret_header"
  : process.env.MOCK_SECRET_HEADER_ENDPOINT || "http://mock-api:9090/mock/secret_header";
const runId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const agentName = `secret-header-agent-${runId}`;
const toolName = `secret_header_${runId}`;
const upstreamSecret = `Bearer upstream-secret-${runId}`;
const publicTraceId = `trace-${runId}`;

async function request(path, options = {}) {
  const { headers, ...rest } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed with ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function adminHeaders() {
  return adminToken ? { "x-admin-token": adminToken } : {};
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoSecret(value, message) {
  const serialized = JSON.stringify(value);
  assert(!serialized.includes(upstreamSecret), message);
}

console.log(`ATG secret header check target: ${baseUrl}`);
console.log(`Tool endpoint: ${toolEndpoint}`);

const health = await request("/healthz");
assert(health.status === "ok", "Health check did not return ok");
console.log("[ok] healthz");

const agentResponse = await request("/api/v1/agents", {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    name: agentName,
    owner: "secret-header-check",
    description: "Created by ATG secret header check",
  }),
});
assert(agentResponse.agent?.name === agentName, "Agent response did not include created agent");
assert(/^atg_/.test(agentResponse.api_key || ""), "Agent API key was not returned");
console.log(`[ok] created agent ${agentName}`);

const toolResponse = await request("/api/v1/tools", {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    name: toolName,
    description: "Secret header local gate tool",
    endpoint: toolEndpoint,
    method: "POST",
    risk_level: "medium",
    timeout_ms: 5000,
    input_schema: {
      type: "object",
      required: ["order_id"],
      properties: {
        order_id: { type: "string" },
      },
    },
    headers: {
      authorization: upstreamSecret,
      "x-trace-id": publicTraceId,
    },
  }),
});
assert(toolResponse.tool?.headers?.authorization === "***", "Sensitive Authorization header was not masked");
assert(toolResponse.tool?.headers?.["x-trace-id"] === publicTraceId, "Public header was not preserved");
assertNoSecret(toolResponse, "Tool create response leaked the upstream secret");
console.log("[ok] created tool with masked secret header");

const listedTools = await request("/api/v1/tools", { headers: adminHeaders() });
const listedTool = listedTools.tools?.find((tool) => tool.id === toolResponse.tool.id);
assert(listedTool, "Created tool was not found in list response");
assert(listedTool.headers?.authorization === "***", "Tool list did not mask the Authorization header");
assertNoSecret(listedTool, "Tool list response leaked the upstream secret");
console.log("[ok] tool list keeps secret header masked");

const invoked = await request(`/api/v1/invoke/${toolName}`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${agentResponse.api_key}`,
  },
  body: JSON.stringify({ order_id: "ord_secret_header" }),
});
assert(invoked.status === "success", "Invocation did not succeed");
assert(invoked.data?.authorization_received === upstreamSecret, "Target API did not receive decrypted Authorization header");
assert(invoked.data?.trace_id_received === publicTraceId, "Target API did not receive public trace header");
console.log("[ok] target API received decrypted secret header");

console.log("ATG secret header check passed");
