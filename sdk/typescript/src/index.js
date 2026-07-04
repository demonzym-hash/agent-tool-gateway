export class AtgError extends Error {
  constructor(message, { statusCode = null, payload = null } = {}) {
    super(message);
    this.name = "AtgError";
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

export class AtgClient {
  constructor({ baseUrl = "http://localhost:8080", apiKey = "", adminToken = "", timeoutMs = 10000 } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/u, "");
    this.apiKey = apiKey;
    this.adminToken = adminToken;
    this.timeoutMs = timeoutMs;
  }

  async invoke(toolName, args = {}) {
    return this.#request(`/api/v1/invoke/${encodeURIComponent(toolName)}`, {
      payload: args,
      headers: this.#authHeaders(),
    });
  }

  async mcpInitialize() {
    return this.#rpc("initialize", {
      protocolVersion: "2025-11-25",
      clientInfo: { name: "atg-typescript-sdk" },
    });
  }

  async mcpListTools() {
    const result = await this.#rpc("tools/list", {});
    return result.tools || [];
  }

  async mcpCallTool(toolName, args = {}) {
    return this.#rpc("tools/call", { name: toolName, arguments: args }, { auth: true });
  }

  async createAgent({ name, description = "", sourceType = "custom", owner = "" }) {
    return this.#request("/api/v1/agents", {
      payload: { name, description, source_type: sourceType, owner },
      headers: this.#adminHeaders(),
    });
  }

  async listAgents() {
    return this.#request("/api/v1/agents", {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async getAgent(agentId) {
    return this.#request(`/api/v1/agents/${encodeURIComponent(agentId)}`, {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async rotateAgentKey(agentId) {
    return this.#request(`/api/v1/agents/${encodeURIComponent(agentId)}/rotate-key`, {
      payload: {},
      headers: this.#adminHeaders(),
    });
  }

  async disableAgent(agentId) {
    return this.#request(`/api/v1/agents/${encodeURIComponent(agentId)}/disable`, {
      payload: {},
      headers: this.#adminHeaders(),
    });
  }

  async createTool({
    name,
    endpoint,
    description = "",
    type = "http",
    riskLevel = "low",
    method = "POST",
    headers = {},
    timeoutMs = 5000,
    inputSchema = {},
    outputSchema = {},
    owner = "",
  }) {
    return this.#request("/api/v1/tools", {
      payload: {
        name,
        description,
        type,
        risk_level: riskLevel,
        endpoint,
        method,
        headers,
        timeout_ms: timeoutMs,
        input_schema: inputSchema,
        output_schema: outputSchema,
        owner,
      },
      headers: this.#adminHeaders(),
    });
  }

  async listTools() {
    return this.#request("/api/v1/tools", {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async getTool(toolId) {
    return this.#request(`/api/v1/tools/${encodeURIComponent(toolId)}`, {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async testTool(toolId, args = {}) {
    return this.#request(`/api/v1/tools/${encodeURIComponent(toolId)}/test`, {
      payload: args,
      headers: this.#adminHeaders(),
    });
  }

  async disableTool(toolId) {
    return this.#request(`/api/v1/tools/${encodeURIComponent(toolId)}/disable`, {
      payload: {},
      headers: this.#adminHeaders(),
    });
  }

  async evaluatePolicy({ agentId, toolId = "", toolName = "", input = {} }) {
    return this.#request("/api/v1/policies/evaluate", {
      payload: {
        agent_id: agentId,
        ...(toolId ? { tool_id: toolId } : {}),
        ...(toolName ? { tool_name: toolName } : {}),
        input,
      },
      headers: this.#adminHeaders(),
    });
  }

  async createPolicy({
    name,
    description = "",
    priority = 100,
    scope = {},
    conditionJson = {},
    action = "allow",
    enabled = true,
  }) {
    return this.#request("/api/v1/policies", {
      payload: {
        name,
        description,
        priority,
        scope,
        condition_json: conditionJson,
        action,
        enabled,
      },
      headers: this.#adminHeaders(),
    });
  }

  async listPolicies({ action = "", enabled = null } = {}) {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (enabled !== null && enabled !== undefined) params.set("enabled", String(enabled));
    const query = params.toString();
    return this.#request(`/api/v1/policies${query ? `?${query}` : ""}`, {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async getPolicy(policyId) {
    return this.#request(`/api/v1/policies/${encodeURIComponent(policyId)}`, {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async disablePolicy(policyId) {
    return this.#request(`/api/v1/policies/${encodeURIComponent(policyId)}/disable`, {
      payload: {},
      headers: this.#adminHeaders(),
    });
  }

  async approveApproval(approvalId, { approver = "sdk-approver", comment = "" } = {}) {
    return this.#request(`/api/v1/approvals/${encodeURIComponent(approvalId)}/approve`, {
      payload: { approver, comment },
      headers: this.#adminHeaders(),
    });
  }

  async rejectApproval(approvalId, { approver = "sdk-approver", comment = "" } = {}) {
    return this.#request(`/api/v1/approvals/${encodeURIComponent(approvalId)}/reject`, {
      payload: { approver, comment },
      headers: this.#adminHeaders(),
    });
  }

  async getApproval(approvalId) {
    return this.#request(`/api/v1/approvals/${encodeURIComponent(approvalId)}`, {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async listApprovals({ status = "", from = "", to = "", limit = null } = {}) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (limit !== null && limit !== undefined) params.set("limit", String(limit));
    const query = params.toString();
    return this.#request(`/api/v1/approvals${query ? `?${query}` : ""}`, {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async getInvocation(invocationId) {
    return this.#request(`/api/v1/invocations/${encodeURIComponent(invocationId)}`, {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async listInvocations({ agentId = "", toolId = "", status = "", from = "", to = "", limit = null } = {}) {
    const params = new URLSearchParams();
    if (agentId) params.set("agent_id", agentId);
    if (toolId) params.set("tool_id", toolId);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (limit !== null && limit !== undefined) params.set("limit", String(limit));
    const query = params.toString();
    return this.#request(`/api/v1/invocations${query ? `?${query}` : ""}`, {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async getAuditLog(auditLogId) {
    return this.#request(`/api/v1/audit-logs/${encodeURIComponent(auditLogId)}`, {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async listAuditLogs({ eventType = "", actorType = "", resourceType = "", from = "", to = "", limit = null } = {}) {
    const params = new URLSearchParams();
    if (eventType) params.set("event_type", eventType);
    if (actorType) params.set("actor_type", actorType);
    if (resourceType) params.set("resource_type", resourceType);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (limit !== null && limit !== undefined) params.set("limit", String(limit));
    const query = params.toString();
    return this.#request(`/api/v1/audit-logs${query ? `?${query}` : ""}`, {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async exportEvidence({
    invocationAgentId = "",
    invocationToolId = "",
    invocationStatus = "",
    approvalStatus = "",
    auditEventType = "",
    auditActorType = "",
    auditResourceType = "",
    policyAction = "",
    policyEnabled = null,
    from = "",
    to = "",
    limit = null,
  } = {}) {
    const params = new URLSearchParams();
    if (invocationAgentId) params.set("invocation_agent_id", invocationAgentId);
    if (invocationToolId) params.set("invocation_tool_id", invocationToolId);
    if (invocationStatus) params.set("invocation_status", invocationStatus);
    if (approvalStatus) params.set("approval_status", approvalStatus);
    if (auditEventType) params.set("audit_event_type", auditEventType);
    if (auditActorType) params.set("audit_actor_type", auditActorType);
    if (auditResourceType) params.set("audit_resource_type", auditResourceType);
    if (policyAction) params.set("policy_action", policyAction);
    if (policyEnabled !== null && policyEnabled !== undefined) params.set("policy_enabled", String(policyEnabled));
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (limit !== null && limit !== undefined) params.set("limit", String(limit));
    const query = params.toString();
    return this.#request(`/api/v1/evidence/export${query ? `?${query}` : ""}`, {
      method: "GET",
      headers: this.#adminHeaders(),
    });
  }

  async #rpc(method, params, { auth = false } = {}) {
    const response = await this.#request("/mcp", {
      payload: {
        jsonrpc: "2.0",
        id: `ts_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        method,
        params,
      },
      headers: auth ? this.#authHeaders() : {},
    });
    if (response.error) {
      throw new AtgError(response.error.message || "MCP request failed", { payload: response.error });
    }
    return response.result || {};
  }

  #authHeaders() {
    if (!this.apiKey) {
      throw new AtgError("ATG API key is required for this operation");
    }
    return { authorization: `Bearer ${this.apiKey}` };
  }

  #adminHeaders() {
    return this.adminToken ? { "x-admin-token": this.adminToken } : {};
  }

  async #request(path, { method = "POST", payload, headers = {} }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    let data;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...headers,
        },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        signal: controller.signal,
      });
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      if (error.name === "AbortError") {
        throw new AtgError(`ATG request timed out after ${this.timeoutMs}ms`);
      }
      throw new AtgError(`ATG request failed: ${error.message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new AtgError(extractErrorMessage(data) || `ATG request failed with HTTP ${response.status}`, {
        statusCode: response.status,
        payload: data,
      });
    }
    return data;
  }
}

function extractErrorMessage(payload) {
  return payload?.error?.message || payload?.message || null;
}
