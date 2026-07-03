export const MCP_PROTOCOL_VERSION = "2025-11-25";

export function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

export function jsonRpcError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

export function toolToMcpTool(tool) {
  return {
    name: tool.name,
    title: tool.name,
    description: tool.description || `ATG HTTP tool: ${tool.name}`,
    inputSchema: normalizeJsonSchema(tool.input_schema),
    outputSchema: normalizeJsonSchema(tool.output_schema),
    annotations: {
      title: tool.name,
      readOnlyHint: tool.method === "GET",
      destructiveHint: tool.risk_level === "high",
      idempotentHint: tool.method === "GET",
      openWorldHint: true,
    },
    _meta: {
      "atg/toolId": tool.id,
      "atg/riskLevel": tool.risk_level,
    },
  };
}

export function atgResultToMcpToolResult(result) {
  const text = JSON.stringify(result.data ?? {}, null, 2);
  return {
    content: [{ type: "text", text }],
    structuredContent: result,
    isError: result.status === "failed" || result.status === "denied",
  };
}

function normalizeJsonSchema(schema) {
  if (schema && typeof schema === "object" && !Array.isArray(schema) && Object.keys(schema).length > 0) {
    return schema;
  }
  return { type: "object" };
}
