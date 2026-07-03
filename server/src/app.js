import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { z } from "zod";
import { asyncHandler, errorMiddleware, HttpError, notFound } from "./errors.js";
import { callHttpTool } from "./httpTool.js";
import { createApiKey, hashApiKey } from "./keys.js";
import { atgResultToMcpToolResult, jsonRpcError, jsonRpcResult, MCP_PROTOCOL_VERSION, toolToMcpTool } from "./mcp.js";
import { evaluatePolicy } from "./policy.js";
import { redactJson } from "./redaction.js";
import { validateJsonSchema } from "./schemaValidation.js";
import { createSecretManager, maskSecretHeaderNames, splitToolHeaders } from "./secrets.js";

const agentCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  source_type: z.string().optional().default("custom"),
  owner: z.string().optional().default(""),
});

const toolCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  type: z.literal("http").optional().default("http"),
  risk_level: z.string().optional().default("low"),
  endpoint: z.string().url(),
  method: z.enum(["GET", "POST"]).default("POST"),
  headers: z.record(z.string()).optional().default({}),
  timeout_ms: z.number().int().min(100).max(60000).optional().default(5000),
  input_schema: z.record(z.unknown()).optional().default({}),
  output_schema: z.record(z.unknown()).optional().default({}),
  owner: z.string().optional().default(""),
});

const policyCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  priority: z.number().int().optional().default(100),
  scope: z.record(z.unknown()).optional().default({}),
  condition_json: z.record(z.unknown()).optional().default({}),
  action: z.enum(["allow", "deny", "approve", "redact"]).default("allow"),
  enabled: z.boolean().optional().default(true),
});

const policyEvaluateSchema = z.object({
  agent_id: z.string().min(1),
  tool_id: z.string().min(1).optional(),
  tool_name: z.string().min(1).optional(),
  input: z.record(z.unknown()).optional().default({}),
});

const approvalDecisionSchema = z.object({
  approver: z.string().optional().default("local-approver"),
  comment: z.string().optional().default(""),
});

function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "invalid_request", "Invalid request body", result.error.flatten());
  }
  return result.data;
}

function validateToolInput(tool, input) {
  const errors = validateJsonSchema(input, tool.input_schema || {});
  if (errors.length) {
    throw new HttpError(400, "invalid_tool_input", "Tool input does not match input_schema", { errors });
  }
}

function parseListLimit(value, defaultLimit = 100) {
  const limit = Number(value || defaultLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new HttpError(400, "invalid_request", "limit must be an integer between 1 and 500");
  }
  return limit;
}

function addTimeRangeFilter({ clauses, params, field, from, to }) {
  if (from) {
    const parsed = new Date(from);
    if (Number.isNaN(parsed.getTime())) throw new HttpError(400, "invalid_request", "from must be a valid date");
    params.push(parsed.toISOString());
    clauses.push(`${field} >= $${params.length}`);
  }
  if (to) {
    const parsed = new Date(to);
    if (Number.isNaN(parsed.getTime())) throw new HttpError(400, "invalid_request", "to must be a valid date");
    params.push(parsed.toISOString());
    clauses.push(`${field} <= $${params.length}`);
  }
}

function buildWhereClause(clauses) {
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

function parsePolicyListFilters(queryParams) {
  const clauses = [];
  const params = [];

  if (queryParams.action) {
    const parsed = z.enum(["allow", "deny", "approve", "redact"]).safeParse(queryParams.action);
    if (!parsed.success) {
      throw new HttpError(400, "invalid_request", "action must be one of allow, deny, approve, or redact");
    }
    params.push(parsed.data);
    clauses.push(`action = $${params.length}`);
  }

  if (queryParams.enabled) {
    if (!["true", "false"].includes(queryParams.enabled)) {
      throw new HttpError(400, "invalid_request", "enabled must be true or false");
    }
    params.push(queryParams.enabled === "true");
    clauses.push(`enabled = $${params.length}`);
  }

  return { clauses, params };
}

function publicAgent(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    source_type: row.source_type,
    owner: row.owner,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function publicTool(row, secretManager) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    risk_level: row.risk_level,
    endpoint: row.endpoint,
    method: row.method,
    headers: maskSecretHeaderNames({ headers: row.headers, encryptedPayload: row.auth_config_encrypted, secretManager }),
    timeout_ms: row.timeout_ms,
    input_schema: row.input_schema,
    output_schema: row.output_schema,
    status: row.status,
    owner: row.owner,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function publicPolicy(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priority: row.priority,
    scope: row.scope,
    condition_json: row.condition_json,
    action: row.action,
    enabled: row.enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function publicApproval(row) {
  return {
    id: row.id,
    invocation_id: row.invocation_id,
    approver: row.approver,
    status: row.status,
    reason: row.reason,
    comment: row.comment,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createApp({
  query,
  withTransaction = async (callback) => callback(query),
  logger,
  adminToken = "",
  secretKey = "",
  toolEgressPolicy = {},
}) {
  const app = express();
  const secretManager = createSecretManager(secretKey);

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  if (logger) {
    app.use(pinoHttp({ logger }));
  }

  async function writeAuditLog({ event_type, actor_type, actor_id, resource_type, resource_id, detail_json }, queryFn = query) {
    const result = await queryFn(
      `INSERT INTO audit_logs (event_type, actor_type, actor_id, resource_type, resource_id, detail_json)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [event_type, actor_type, actor_id, resource_type, resource_id, detail_json],
    );
    return result.rows[0];
  }

  async function requireAgent(req) {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new HttpError(401, "missing_api_key", "Authorization bearer token is required");
    }

    const result = await query("SELECT * FROM agents WHERE api_key_hash = $1 AND status = 'active'", [
      hashApiKey(match[1]),
    ]);
    if (!result.rowCount) {
      throw new HttpError(401, "invalid_api_key", "Invalid or disabled agent API key");
    }
    return result.rows[0];
  }

  function requireAdmin(req, res, next) {
    if (!adminToken) {
      next();
      return;
    }

    const authorization = req.get("authorization") || "";
    const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    const token = req.get("x-admin-token") || bearer;
    if (token !== adminToken) {
      res.status(401).json({ error: { code: "admin_auth_required", message: "Admin token is required" } });
      return;
    }
    next();
  }

  async function listActiveTools() {
    const result = await query("SELECT * FROM tools WHERE status = 'active' ORDER BY created_at DESC");
    return result.rows;
  }

  function toolWithSecretHeaders(tool) {
    const secretHeaders = tool.auth_config_encrypted ? secretManager.decryptJson(tool.auth_config_encrypted).headers || {} : {};
    return { ...tool, headers: { ...(tool.headers || {}), ...secretHeaders } };
  }

  async function invokeRegisteredTool({ agent, toolName, input }) {
    const toolResult = await query("SELECT * FROM tools WHERE name = $1 AND status = 'active'", [toolName]);
    if (!toolResult.rowCount) throw notFound("Tool");
    const tool = toolResult.rows[0];
    validateToolInput(tool, input);
    const policiesResult = await query("SELECT * FROM policies WHERE enabled = true ORDER BY priority ASC, created_at DESC");
    const policyDecision = evaluatePolicy({ agent, tool, input, policies: policiesResult.rows });

    if (!["allow", "redact"].includes(policyDecision.action)) {
      if (policyDecision.action === "approve") {
        const { invocation, approval, audit } = await withTransaction(async (txQuery) => {
          const invocationResult = await txQuery(
            `INSERT INTO invocations
               (agent_id, tool_id, request_args, policy_decision, matched_policy_id, status, error_message)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING *`,
            [
              agent.id,
              tool.id,
              input,
              policyDecision,
              policyDecision.matched_policy_id,
              "pending_approval",
              policyDecision.reason,
            ],
          );
          const approvalResult = await txQuery(
            `INSERT INTO approvals (invocation_id, reason)
               VALUES ($1, $2)
               RETURNING *`,
            [invocationResult.rows[0].id, policyDecision.reason],
          );
          const auditResult = await writeAuditLog(
            {
              event_type: "tool.invoke.pending_approval",
              actor_type: "agent",
              actor_id: agent.id,
              resource_type: "tool",
              resource_id: tool.id,
              detail_json: {
                invocation_id: invocationResult.rows[0].id,
                approval_id: approvalResult.rows[0].id,
                policy_decision: policyDecision,
              },
            },
            txQuery,
          );
          return { invocation: invocationResult.rows[0], approval: approvalResult.rows[0], audit: auditResult };
        });
        return {
          httpStatus: 202,
          body: {
            status: "pending_approval",
            invocation_id: invocation.id,
            approval_id: approval.id,
            audit_id: audit.id,
            reason: policyDecision.reason,
          },
        };
      }

      const { invocation, audit } = await withTransaction(async (txQuery) => {
        const invocationResult = await txQuery(
          `INSERT INTO invocations
             (agent_id, tool_id, request_args, policy_decision, matched_policy_id, status, error_message)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
          [agent.id, tool.id, input, policyDecision, policyDecision.matched_policy_id, "denied", policyDecision.reason],
        );
        const auditResult = await writeAuditLog(
          {
            event_type: "tool.invoke.denied",
            actor_type: "agent",
            actor_id: agent.id,
            resource_type: "tool",
            resource_id: tool.id,
            detail_json: { invocation_id: invocationResult.rows[0].id, policy_decision: policyDecision },
          },
          txQuery,
        );
        return { invocation: invocationResult.rows[0], audit: auditResult };
      });
      return {
        httpStatus: 403,
        body: {
          status: "denied",
          invocation_id: invocation.id,
          audit_id: audit.id,
          reason: policyDecision.reason,
        },
      };
    }

    let callResult;
    let status = "success";
    let errorMessage = null;
    try {
      callResult = await callHttpTool(toolWithSecretHeaders(tool), input, toolEgressPolicy);
      if (!callResult.ok) {
        status = "failed";
        errorMessage = `HTTP ${callResult.statusCode}`;
      }
    } catch (err) {
      status = "failed";
      errorMessage = err.name === "AbortError" ? "Tool request timed out" : err.message;
      callResult = { statusCode: 0, data: { error: errorMessage }, latencyMs: 0 };
    }
    const redactedData = redactJson(callResult.data, "", policyDecision.redaction);

    const { invocation, audit } = await withTransaction(async (txQuery) => {
      const invocationResult = await txQuery(
        `INSERT INTO invocations
           (agent_id, tool_id, request_args, response_data_redacted, policy_decision, matched_policy_id, status, latency_ms, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
        [
          agent.id,
          tool.id,
          input,
          redactedData,
          policyDecision,
          policyDecision.matched_policy_id,
          status,
          callResult.latencyMs,
          errorMessage,
        ],
      );
      const auditResult = await writeAuditLog(
        {
          event_type: status === "success" ? "tool.invoke.succeeded" : "tool.invoke.failed",
          actor_type: "agent",
          actor_id: agent.id,
          resource_type: "tool",
          resource_id: tool.id,
          detail_json: {
            invocation_id: invocationResult.rows[0].id,
            tool_name: tool.name,
            http_status: callResult.statusCode,
            latency_ms: callResult.latencyMs,
          },
        },
        txQuery,
      );
      return { invocation: invocationResult.rows[0], audit: auditResult };
    });

    return {
      httpStatus: status === "success" ? 200 : 502,
      body: {
        status,
        invocation_id: invocation.id,
        audit_id: audit.id,
        data: redactedData,
      },
    };
  }

  async function executeApprovedInvocation({ approvalId, approver, comment }) {
    const { approval, invocation } = await withTransaction(async (txQuery) => {
      const approvalResult = await txQuery(
        `UPDATE approvals
         SET status = 'processing', approver = $1, comment = $2, updated_at = now()
         WHERE id = $3 AND status = 'pending'
         RETURNING *`,
        [approver, comment, approvalId],
      );
      if (!approvalResult.rowCount) throw notFound("Pending approval");

      const invocationResult = await txQuery(
        `SELECT i.*, a.name AS agent_name, t.name AS tool_name, t.endpoint, t.method, t.headers, t.timeout_ms, t.auth_config_encrypted, t.input_schema
         FROM invocations i
         JOIN agents a ON a.id = i.agent_id
         JOIN tools t ON t.id = i.tool_id
         WHERE i.id = $1 AND i.status = 'pending_approval'`,
        [approvalResult.rows[0].invocation_id],
      );
      if (!invocationResult.rowCount) {
        throw new HttpError(409, "approval_not_executable", "Approval is not linked to a pending invocation");
      }
      return { approval: approvalResult.rows[0], invocation: invocationResult.rows[0] };
    });
    const tool = {
      id: invocation.tool_id,
      name: invocation.tool_name,
      endpoint: invocation.endpoint,
      method: invocation.method,
      headers: invocation.headers,
      timeout_ms: invocation.timeout_ms,
      auth_config_encrypted: invocation.auth_config_encrypted,
      input_schema: invocation.input_schema,
    };
    validateToolInput(tool, invocation.request_args || {});

    let callResult;
    let status = "success";
    let errorMessage = null;
    try {
      callResult = await callHttpTool(toolWithSecretHeaders(tool), invocation.request_args || {}, toolEgressPolicy);
      if (!callResult.ok) {
        status = "failed";
        errorMessage = `HTTP ${callResult.statusCode}`;
      }
    } catch (err) {
      status = "failed";
      errorMessage = err.name === "AbortError" ? "Tool request timed out" : err.message;
      callResult = { statusCode: 0, data: { error: errorMessage }, latencyMs: 0 };
    }
    const redactedData = redactJson(callResult.data, "", invocation.policy_decision?.redaction);

    const { updatedInvocation, updatedApproval, audit } = await withTransaction(async (txQuery) => {
      const updatedInvocationResult = await txQuery(
        `UPDATE invocations
         SET response_data_redacted = $1, status = $2, latency_ms = $3, error_message = $4, approval_id = $5
         WHERE id = $6 AND status = 'pending_approval'
         RETURNING *`,
        [redactedData, status, callResult.latencyMs, errorMessage, approval.id, invocation.id],
      );
      if (!updatedInvocationResult.rowCount) {
        throw new HttpError(409, "approval_not_executable", "Approval is not linked to a pending invocation");
      }

      const updatedApprovalResult = await txQuery(
        `UPDATE approvals
         SET status = 'approved', approver = $1, comment = $2, updated_at = now()
         WHERE id = $3 AND status = 'processing'
         RETURNING *`,
        [approver, comment, approval.id],
      );
      if (!updatedApprovalResult.rowCount) {
        throw new HttpError(409, "approval_not_executable", "Approval is no longer processing");
      }

      const auditResult = await writeAuditLog(
        {
          event_type: status === "success" ? "approval.approved.executed" : "approval.approved.failed",
          actor_type: "approver",
          actor_id: approver,
          resource_type: "approval",
          resource_id: approval.id,
          detail_json: {
            invocation_id: invocation.id,
            tool_name: invocation.tool_name,
            http_status: callResult.statusCode,
            latency_ms: callResult.latencyMs,
          },
        },
        txQuery,
      );
      return {
        updatedInvocation: updatedInvocationResult.rows[0],
        updatedApproval: updatedApprovalResult.rows[0],
        audit: auditResult,
      };
    });

    return { invocation: updatedInvocation, approval: updatedApproval, audit, data: redactedData, status };
  }

  app.get(
    "/healthz",
    asyncHandler(async (req, res) => {
      await query("SELECT 1");
      res.json({ status: "ok" });
    }),
  );

  app.post(
    "/api/v1/agents",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const input = parseBody(agentCreateSchema, req.body);
      const apiKey = createApiKey();
      const result = await query(
        `INSERT INTO agents (name, description, source_type, owner, api_key_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.name, input.description, input.source_type, input.owner, hashApiKey(apiKey)],
      );
      const agent = result.rows[0];
      await writeAuditLog({
        event_type: "agent.created",
        actor_type: "admin",
        actor_id: "local",
        resource_type: "agent",
        resource_id: agent.id,
        detail_json: { name: agent.name },
      });
      res.status(201).json({ agent: publicAgent(agent), api_key: apiKey });
    }),
  );

  app.get(
    "/api/v1/agents",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await query("SELECT * FROM agents ORDER BY created_at DESC");
      res.json({ agents: result.rows.map(publicAgent) });
    }),
  );

  app.get(
    "/api/v1/agents/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await query("SELECT * FROM agents WHERE id = $1", [req.params.id]);
      if (!result.rowCount) throw notFound("Agent");
      res.json({ agent: publicAgent(result.rows[0]) });
    }),
  );

  app.post(
    "/api/v1/agents/:id/rotate-key",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const apiKey = createApiKey();
      const result = await query(
        "UPDATE agents SET api_key_hash = $1, updated_at = now() WHERE id = $2 RETURNING *",
        [hashApiKey(apiKey), req.params.id],
      );
      if (!result.rowCount) throw notFound("Agent");
      await writeAuditLog({
        event_type: "agent.key_rotated",
        actor_type: "admin",
        actor_id: "local",
        resource_type: "agent",
        resource_id: req.params.id,
        detail_json: {},
      });
      res.json({ agent: publicAgent(result.rows[0]), api_key: apiKey });
    }),
  );

  app.post(
    "/api/v1/agents/:id/disable",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await query("UPDATE agents SET status = 'disabled', updated_at = now() WHERE id = $1 RETURNING *", [
        req.params.id,
      ]);
      if (!result.rowCount) throw notFound("Agent");
      await writeAuditLog({
        event_type: "agent.disabled",
        actor_type: "admin",
        actor_id: "local",
        resource_type: "agent",
        resource_id: req.params.id,
        detail_json: {},
      });
      res.json({ agent: publicAgent(result.rows[0]) });
    }),
  );

  app.post(
    "/api/v1/tools",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const input = parseBody(toolCreateSchema, req.body);
      const { publicHeaders, secretHeaders } = splitToolHeaders(input.headers);
      const authConfigEncrypted = Object.keys(secretHeaders).length ? secretManager.encryptJson({ headers: secretHeaders }) : null;
      const result = await query(
        `INSERT INTO tools
         (name, description, type, risk_level, endpoint, method, headers, timeout_ms, input_schema, output_schema, owner, auth_config_encrypted)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          input.name,
          input.description,
          input.type,
          input.risk_level,
          input.endpoint,
          input.method,
          publicHeaders,
          input.timeout_ms,
          input.input_schema,
          input.output_schema,
          input.owner,
          authConfigEncrypted,
        ],
      );
      const tool = result.rows[0];
      await writeAuditLog({
        event_type: "tool.created",
        actor_type: "admin",
        actor_id: "local",
        resource_type: "tool",
        resource_id: tool.id,
        detail_json: { name: tool.name, endpoint: tool.endpoint },
      });
      res.status(201).json({ tool: publicTool(tool, secretManager) });
    }),
  );

  app.get(
    "/api/v1/tools",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await query("SELECT * FROM tools ORDER BY created_at DESC");
      res.json({ tools: result.rows.map((tool) => publicTool(tool, secretManager)) });
    }),
  );

  app.get(
    "/api/v1/tools/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await query("SELECT * FROM tools WHERE id = $1", [req.params.id]);
      if (!result.rowCount) throw notFound("Tool");
      res.json({ tool: publicTool(result.rows[0], secretManager) });
    }),
  );

  app.post(
    "/api/v1/tools/:id/test",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const toolResult = await query("SELECT * FROM tools WHERE id = $1 AND status = 'active'", [req.params.id]);
      if (!toolResult.rowCount) throw notFound("Tool");
      validateToolInput(toolResult.rows[0], req.body || {});
      const result = await callHttpTool(toolWithSecretHeaders(toolResult.rows[0]), req.body || {}, toolEgressPolicy);
      res.json({ status: result.ok ? "success" : "failed", http_status: result.statusCode, data: redactJson(result.data) });
    }),
  );

  app.post(
    "/api/v1/tools/:id/disable",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await query("UPDATE tools SET status = 'disabled', updated_at = now() WHERE id = $1 RETURNING *", [
        req.params.id,
      ]);
      if (!result.rowCount) throw notFound("Tool");
      await writeAuditLog({
        event_type: "tool.disabled",
        actor_type: "admin",
        actor_id: "local",
        resource_type: "tool",
        resource_id: req.params.id,
        detail_json: {},
      });
      res.json({ tool: publicTool(result.rows[0], secretManager) });
    }),
  );

  app.post(
    "/api/v1/policies",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const input = parseBody(policyCreateSchema, req.body);
      const result = await query(
        `INSERT INTO policies (name, description, priority, scope, condition_json, action, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [input.name, input.description, input.priority, input.scope, input.condition_json, input.action, input.enabled],
      );
      const policy = result.rows[0];
      await writeAuditLog({
        event_type: "policy.created",
        actor_type: "admin",
        actor_id: "local",
        resource_type: "policy",
        resource_id: policy.id,
        detail_json: { name: policy.name, action: policy.action },
      });
      res.status(201).json({ policy: publicPolicy(policy) });
    }),
  );

  app.get(
    "/api/v1/policies",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { clauses, params } = parsePolicyListFilters(req.query);
      const result = await query(
        `SELECT * FROM policies ${buildWhereClause(clauses)} ORDER BY priority ASC, created_at DESC`,
        params,
      );
      res.json({ policies: result.rows.map(publicPolicy) });
    }),
  );

  app.get(
    "/api/v1/policies/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await query("SELECT * FROM policies WHERE id = $1", [req.params.id]);
      if (!result.rowCount) throw notFound("Policy");
      res.json({ policy: publicPolicy(result.rows[0]) });
    }),
  );

  app.post(
    "/api/v1/policies/:id/disable",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await query("UPDATE policies SET enabled = false, updated_at = now() WHERE id = $1 RETURNING *", [
        req.params.id,
      ]);
      if (!result.rowCount) throw notFound("Policy");
      await writeAuditLog({
        event_type: "policy.disabled",
        actor_type: "admin",
        actor_id: "local",
        resource_type: "policy",
        resource_id: req.params.id,
        detail_json: {},
      });
      res.json({ policy: publicPolicy(result.rows[0]) });
    }),
  );

  app.post(
    "/api/v1/policies/evaluate",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const input = parseBody(policyEvaluateSchema, req.body || {});
      if (!input.tool_id && !input.tool_name) {
        throw new HttpError(400, "invalid_request", "tool_id or tool_name is required");
      }

      const agentResult = await query("SELECT * FROM agents WHERE id = $1", [input.agent_id]);
      if (!agentResult.rowCount) throw notFound("Agent");

      const toolResult = input.tool_id
        ? await query("SELECT * FROM tools WHERE id = $1", [input.tool_id])
        : await query("SELECT * FROM tools WHERE name = $1 AND status = 'active'", [input.tool_name]);
      if (!toolResult.rowCount) throw notFound("Tool");

      const policiesResult = await query("SELECT * FROM policies WHERE enabled = true ORDER BY priority ASC, created_at DESC");
      const decision = evaluatePolicy({
        agent: agentResult.rows[0],
        tool: toolResult.rows[0],
        input: input.input,
        policies: policiesResult.rows,
      });

      res.json({
        decision,
        agent: publicAgent(agentResult.rows[0]),
        tool: publicTool(toolResult.rows[0], secretManager),
      });
    }),
  );

  app.post(
    "/api/v1/invoke/:toolName",
    asyncHandler(async (req, res) => {
      const agent = await requireAgent(req);
      const result = await invokeRegisteredTool({ agent, toolName: req.params.toolName, input: req.body || {} });
      res.status(result.httpStatus).json(result.body);
    }),
  );

  app.post(
    "/mcp",
    asyncHandler(async (req, res) => {
      const request = req.body || {};
      const id = Object.prototype.hasOwnProperty.call(request, "id") ? request.id : null;

      if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
        res.status(400).json(jsonRpcError(id, -32600, "Invalid JSON-RPC request"));
        return;
      }

      if (request.method === "initialize") {
        res.json(
          jsonRpcResult(id, {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "agent-tool-gateway", version: "0.1.0" },
          }),
        );
        return;
      }

      if (request.method === "tools/list") {
        const tools = await listActiveTools();
        res.json(jsonRpcResult(id, { tools: tools.map(toolToMcpTool) }));
        return;
      }

      if (request.method === "tools/call") {
        let agent;
        try {
          agent = await requireAgent(req);
        } catch (err) {
          if (err instanceof HttpError) {
            res.status(err.status).json(jsonRpcError(id, -32001, err.message, { code: err.code }));
            return;
          }
          throw err;
        }

        const params = request.params || {};
        if (!params.name || typeof params.name !== "string") {
          res.status(400).json(jsonRpcError(id, -32602, "Tool name is required"));
          return;
        }

        const result = await invokeRegisteredTool({ agent, toolName: params.name, input: params.arguments || {} });
        res.status(result.httpStatus >= 500 ? 502 : 200).json(jsonRpcResult(id, atgResultToMcpToolResult(result.body)));
        return;
      }

      res.status(404).json(jsonRpcError(id, -32601, "Method not found"));
    }),
  );

  app.get(
    "/api/v1/invocations",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const clauses = [];
      const params = [];
      if (req.query.agent_id) {
        params.push(req.query.agent_id);
        clauses.push(`i.agent_id = $${params.length}`);
      }
      if (req.query.tool_id) {
        params.push(req.query.tool_id);
        clauses.push(`i.tool_id = $${params.length}`);
      }
      if (req.query.status) {
        params.push(req.query.status);
        clauses.push(`i.status = $${params.length}`);
      }
      addTimeRangeFilter({
        clauses,
        params,
        field: "i.created_at",
        from: req.query.from,
        to: req.query.to,
      });
      const limit = parseListLimit(req.query.limit);
      params.push(limit);
      const result = await query(
        `SELECT i.*, a.name AS agent_name, t.name AS tool_name
         FROM invocations i
         JOIN agents a ON a.id = i.agent_id
         JOIN tools t ON t.id = i.tool_id
         ${buildWhereClause(clauses)}
         ORDER BY i.created_at DESC
         LIMIT $${params.length}`,
        params,
      );
      res.json({ invocations: result.rows });
    }),
  );

  app.get(
    "/api/v1/invocations/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await query(
        `SELECT i.*, a.name AS agent_name, t.name AS tool_name
         FROM invocations i
         JOIN agents a ON a.id = i.agent_id
         JOIN tools t ON t.id = i.tool_id
         WHERE i.id = $1`,
        [req.params.id],
      );
      if (!result.rowCount) throw notFound("Invocation");
      res.json({ invocation: result.rows[0] });
    }),
  );

  app.get(
    "/api/v1/approvals",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const clauses = [];
      const params = [];
      if (req.query.status) {
        params.push(req.query.status);
        clauses.push(`status = $${params.length}`);
      }
      addTimeRangeFilter({
        clauses,
        params,
        field: "created_at",
        from: req.query.from,
        to: req.query.to,
      });
      const limit = parseListLimit(req.query.limit);
      params.push(limit);
      const result = await query(
        `SELECT * FROM approvals
         ${buildWhereClause(clauses)}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      );
      res.json({ approvals: result.rows.map(publicApproval) });
    }),
  );

  app.get(
    "/api/v1/approvals/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await query("SELECT * FROM approvals WHERE id = $1", [req.params.id]);
      if (!result.rowCount) throw notFound("Approval");
      res.json({ approval: publicApproval(result.rows[0]) });
    }),
  );

  app.post(
    "/api/v1/approvals/:id/approve",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const input = parseBody(approvalDecisionSchema, req.body || {});
      const result = await executeApprovedInvocation({
        approvalId: req.params.id,
        approver: input.approver,
        comment: input.comment,
      });
      res.status(result.status === "success" ? 200 : 502).json({
        status: result.status,
        approval: publicApproval(result.approval),
        invocation_id: result.invocation.id,
        audit_id: result.audit.id,
        data: result.data,
      });
    }),
  );

  app.post(
    "/api/v1/approvals/:id/reject",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const input = parseBody(approvalDecisionSchema, req.body || {});
      const { updatedApproval, updatedInvocation, audit } = await withTransaction(async (txQuery) => {
        const updatedApprovalResult = await txQuery(
          `UPDATE approvals
           SET status = 'rejected', approver = $1, comment = $2, updated_at = now()
           WHERE id = $3 AND status = 'pending'
           RETURNING *`,
          [input.approver, input.comment, req.params.id],
        );
        if (!updatedApprovalResult.rowCount) throw notFound("Pending approval");

        const approval = updatedApprovalResult.rows[0];
        const updatedInvocationResult = await txQuery(
          `UPDATE invocations
           SET status = 'denied', approval_id = $1, error_message = $2
           WHERE id = $3 AND status = 'pending_approval'
           RETURNING *`,
          [approval.id, input.comment || "Approval rejected", approval.invocation_id],
        );
        if (!updatedInvocationResult.rowCount) {
          throw new HttpError(409, "approval_not_rejectable", "Approval is not linked to a pending invocation");
        }
        const auditResult = await writeAuditLog(
          {
            event_type: "approval.rejected",
            actor_type: "approver",
            actor_id: input.approver,
            resource_type: "approval",
            resource_id: approval.id,
            detail_json: { invocation_id: approval.invocation_id, comment: input.comment },
          },
          txQuery,
        );
        return {
          updatedApproval: updatedApprovalResult.rows[0],
          updatedInvocation: updatedInvocationResult.rows[0],
          audit: auditResult,
        };
      });
      res.json({
        status: "rejected",
        approval: publicApproval(updatedApproval),
        invocation_id: updatedInvocation.id,
        audit_id: audit.id,
      });
    }),
  );

  app.get(
    "/api/v1/audit-logs",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const clauses = [];
      const params = [];
      for (const field of ["event_type", "actor_type", "resource_type"]) {
        if (req.query[field]) {
          params.push(req.query[field]);
          clauses.push(`${field} = $${params.length}`);
        }
      }
      addTimeRangeFilter({
        clauses,
        params,
        field: "created_at",
        from: req.query.from,
        to: req.query.to,
      });
      const limit = parseListLimit(req.query.limit);
      params.push(limit);
      const result = await query(
        `SELECT * FROM audit_logs
         ${buildWhereClause(clauses)}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      );
      res.json({ audit_logs: result.rows });
    }),
  );

  app.get(
    "/api/v1/audit-logs/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await query("SELECT * FROM audit_logs WHERE id = $1", [req.params.id]);
      if (!result.rowCount) throw notFound("Audit log");
      res.json({ audit_log: result.rows[0] });
    }),
  );

  app.use((req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
  });
  app.use(errorMiddleware);

  return app;
}
