import { AtgClient } from "../src/index.js";

const baseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const apiKey = process.env.ATG_API_KEY;
const toolName = process.env.ATG_TOOL_NAME || "refund_order";
const args = process.env.ATG_TOOL_ARGS
  ? JSON.parse(process.env.ATG_TOOL_ARGS)
  : { order_id: "ord_typescript_sdk", amount: 25, reason: "typescript_sdk_demo" };

if (!apiKey) {
  throw new Error("Set ATG_API_KEY to an active Agent API key before running this example.");
}

const client = new AtgClient({ baseUrl, apiKey });

if (process.env.ATG_USE_MCP === "1") {
  await client.mcpInitialize();
  const tools = await client.mcpListTools();
  if (!tools.some((tool) => tool.name === toolName)) {
    throw new Error(`Tool ${toolName} was not returned by MCP tools/list`);
  }
  const result = await client.mcpCallTool(toolName, args);
  console.log(JSON.stringify(result.structuredContent, null, 2));
} else {
  const result = await client.invoke(toolName, args);
  console.log(JSON.stringify(result, null, 2));
}
