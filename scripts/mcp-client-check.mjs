import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const adminToken = process.env.ADMIN_TOKEN || "";
const toolEndpoint = args.has("--local-mock")
  ? "http://localhost:9090/mock/refund_order"
  : process.env.MOCK_TOOL_ENDPOINT || "http://mock-api:9090/mock/refund_order";
const runId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const agentName = `mcp-client-agent-${runId}`;
const toolName = `refund_order_mcp_client_${runId}`;
const mcpClientDir = fileURLToPath(new URL("../examples/mcp-client/", import.meta.url));

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

function runMcpClientExample(apiKey) {
  const result = spawnSync(process.execPath, ["src/index.js"], {
    cwd: mcpClientDir,
    encoding: "utf8",
    env: {
      ...process.env,
      ATG_BASE_URL: baseUrl,
      ATG_API_KEY: apiKey,
      ATG_TOOL_NAME: toolName,
      ATG_TOOL_ARGS: JSON.stringify({
        order_id: "ord_mcp_client_check",
        amount: 25,
        reason: "mcp_client_runtime_check",
      }),
    },
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
  assert(result.stdout.includes("[ok] tools/list"), "MCP client example did not list tools");
  assert(result.stdout.includes(`[ok] tools/call ${toolName}: success`), "MCP client example did not call the tool");
  return result.stdout;
}

console.log(`ATG MCP client check target: ${baseUrl}`);
console.log(`Tool endpoint: ${toolEndpoint}`);

const health = await request("/healthz");
assert(health.status === "ok", "Health check did not return ok");
console.log("[ok] healthz");

const agent = await request("/api/v1/agents", {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    name: agentName,
    owner: "mcp-client-check",
    description: "Created by ATG MCP client check",
  }),
});
assert(/^atg_/.test(agent.api_key || ""), "Agent API key was not returned");
console.log(`[ok] created agent ${agentName}`);

const tool = await request("/api/v1/tools", {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({
    name: toolName,
    description: "Refund order MCP client check tool",
    endpoint: toolEndpoint,
    method: "POST",
    risk_level: "medium",
    timeout_ms: 5000,
    input_schema: {
      type: "object",
      required: ["order_id", "amount"],
      properties: {
        order_id: { type: "string" },
        amount: { type: "number", minimum: 1 },
        reason: { type: "string" },
      },
    },
    headers: {},
  }),
});
assert(tool.tool?.name === toolName, "Tool response did not include created tool");
console.log(`[ok] created tool ${toolName}`);

runMcpClientExample(agent.api_key);
console.log("ATG MCP client check passed");
