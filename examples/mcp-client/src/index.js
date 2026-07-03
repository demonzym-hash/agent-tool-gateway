const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const apiKey = process.env.ATG_API_KEY;
const toolName = process.env.ATG_TOOL_NAME || "refund_order";
const toolArgs = process.env.ATG_TOOL_ARGS
  ? JSON.parse(process.env.ATG_TOOL_ARGS)
  : { order_id: "ord_mcp_client", amount: 25, reason: "mcp_client_example" };

async function rpc(method, params, { auth = false } = {}) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      method,
      params,
    }),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`${method} failed: ${JSON.stringify(data.error || data)}`);
  }
  return data.result;
}

if (!apiKey) {
  throw new Error("Set ATG_API_KEY to an active Agent API key before running this example.");
}

console.log(`ATG MCP target: ${baseUrl}`);

const initialized = await rpc("initialize", { protocolVersion: "2025-11-25", clientInfo: { name: "atg-mcp-client-example" } });
console.log(`[ok] initialized ${initialized.serverInfo.name} (${initialized.protocolVersion})`);

const listed = await rpc("tools/list");
const toolNames = listed.tools.map((tool) => tool.name);
console.log(`[ok] tools/list returned ${toolNames.length} tool(s): ${toolNames.join(", ") || "(none)"}`);

if (!toolNames.includes(toolName)) {
  throw new Error(`Tool ${toolName} was not returned by tools/list.`);
}

const called = await rpc("tools/call", { name: toolName, arguments: toolArgs }, { auth: true });
console.log(`[ok] tools/call ${toolName}: ${called.structuredContent.status}`);
console.log(JSON.stringify(called.structuredContent, null, 2));
