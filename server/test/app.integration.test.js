import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";

function result(rows) {
  return { rows, rowCount: rows.length };
}

function now() {
  return new Date().toISOString();
}

function createFakeDb() {
  const db = {
    agents: [],
    tools: [],
    policies: [],
    approvals: [],
    invocations: [],
    auditLogs: [],
  };

  async function query(sql, params = []) {
    const normalized = sql.replace(/\s+/g, " ").trim();

    if (normalized === "SELECT 1") {
      return result([{ "?column?": 1 }]);
    }

    if (normalized.startsWith("INSERT INTO agents")) {
      const row = {
        id: crypto.randomUUID(),
        name: params[0],
        description: params[1],
        source_type: params[2],
        owner: params[3],
        api_key_hash: params[4],
        status: "active",
        created_at: now(),
        updated_at: now(),
      };
      db.agents.push(row);
      return result([row]);
    }

    if (normalized === "SELECT * FROM agents ORDER BY created_at DESC") {
      return result([...db.agents].reverse());
    }

    if (normalized === "SELECT * FROM agents WHERE id = $1") {
      return result(db.agents.filter((agent) => agent.id === params[0]));
    }

    if (normalized === "SELECT * FROM agents WHERE api_key_hash = $1 AND status = 'active'") {
      return result(db.agents.filter((agent) => agent.api_key_hash === params[0] && agent.status === "active"));
    }

    if (normalized.startsWith("UPDATE agents SET api_key_hash")) {
      const agent = db.agents.find((item) => item.id === params[1]);
      if (!agent) return result([]);
      agent.api_key_hash = params[0];
      agent.updated_at = now();
      return result([agent]);
    }

    if (normalized.startsWith("UPDATE agents SET status = 'disabled'")) {
      const agent = db.agents.find((item) => item.id === params[0]);
      if (!agent) return result([]);
      agent.status = "disabled";
      agent.updated_at = now();
      return result([agent]);
    }

    if (normalized.startsWith("INSERT INTO tools")) {
      const row = {
        id: crypto.randomUUID(),
        name: params[0],
        description: params[1],
        type: params[2],
        risk_level: params[3],
        endpoint: params[4],
        method: params[5],
        headers: params[6],
        timeout_ms: params[7],
        input_schema: params[8],
        output_schema: params[9],
        owner: params[10],
        auth_config_encrypted: params[11],
        status: "active",
        created_at: now(),
        updated_at: now(),
      };
      db.tools.push(row);
      return result([row]);
    }

    if (normalized === "SELECT * FROM tools ORDER BY created_at DESC") {
      return result([...db.tools].reverse());
    }

    if (normalized === "SELECT * FROM tools WHERE status = 'active' ORDER BY created_at DESC") {
      return result([...db.tools].filter((tool) => tool.status === "active").reverse());
    }

    if (normalized === "SELECT * FROM tools WHERE id = $1") {
      return result(db.tools.filter((tool) => tool.id === params[0]));
    }

    if (normalized === "SELECT * FROM tools WHERE name = $1 AND status = 'active'") {
      return result(db.tools.filter((tool) => tool.name === params[0] && tool.status === "active"));
    }

    if (normalized === "SELECT * FROM tools WHERE id = $1 AND status = 'active'") {
      return result(db.tools.filter((tool) => tool.id === params[0] && tool.status === "active"));
    }

    if (normalized.startsWith("UPDATE tools SET status = 'disabled'")) {
      const tool = db.tools.find((item) => item.id === params[0]);
      if (!tool) return result([]);
      tool.status = "disabled";
      tool.updated_at = now();
      return result([tool]);
    }

    if (normalized.startsWith("INSERT INTO policies")) {
      const row = {
        id: crypto.randomUUID(),
        name: params[0],
        description: params[1],
        priority: params[2],
        scope: params[3],
        condition_json: params[4],
        action: params[5],
        enabled: params[6],
        created_at: now(),
        updated_at: now(),
      };
      db.policies.push(row);
      return result([row]);
    }

    if (normalized === "SELECT * FROM policies WHERE id = $1") {
      return result(db.policies.filter((policy) => policy.id === params[0]));
    }

    if (normalized.startsWith("SELECT * FROM policies")) {
      let policies = [...db.policies];
      if (normalized.includes("WHERE enabled = true")) {
        policies = policies.filter((policy) => policy.enabled);
      } else if (normalized.includes("WHERE")) {
        const filters = normalized.match(/WHERE (.*) ORDER BY/)?.[1]?.split(" AND ") || [];
        policies = policies.filter((policy) =>
          filters.every((filter) => {
            const match = filter.match(/^(action|enabled) = \$(\d+)$/);
            if (!match) return true;
            return policy[match[1]] === params[Number(match[2]) - 1];
          }),
        );
      }
      return result(policies.sort((a, b) => a.priority - b.priority || b.created_at.localeCompare(a.created_at)));
    }

    if (normalized.startsWith("UPDATE policies SET enabled = false")) {
      const policy = db.policies.find((item) => item.id === params[0]);
      if (!policy) return result([]);
      policy.enabled = false;
      policy.updated_at = now();
      return result([policy]);
    }

    if (normalized.startsWith("INSERT INTO invocations")) {
      const deniedShape = normalized.includes("error_message) VALUES ($1, $2, $3, $4, $5, $6, $7)");
      const row = deniedShape
        ? {
            id: crypto.randomUUID(),
            agent_id: params[0],
            tool_id: params[1],
            request_args: params[2],
            policy_decision: params[3],
            matched_policy_id: params[4],
            status: params[5],
            error_message: params[6],
            response_data_redacted: null,
            latency_ms: 0,
            created_at: now(),
          }
        : {
            id: crypto.randomUUID(),
            agent_id: params[0],
            tool_id: params[1],
            request_args: params[2],
            response_data_redacted: params[3],
            policy_decision: params[4],
            matched_policy_id: params[5],
            status: params[6],
            latency_ms: params[7],
            error_message: params[8],
            created_at: now(),
          };
      db.invocations.push(row);
      return result([row]);
    }

    if (normalized.startsWith("INSERT INTO approvals")) {
      const row = {
        id: crypto.randomUUID(),
        invocation_id: params[0],
        approver: "",
        status: "pending",
        reason: params[1],
        comment: "",
        created_at: now(),
        updated_at: now(),
      };
      db.approvals.push(row);
      return result([row]);
    }

    if (normalized.startsWith("SELECT i.*, a.name AS agent_name, t.name AS tool_name, t.endpoint, t.method, t.headers, t.timeout_ms")) {
      const rows = db.invocations
        .filter((invocation) => invocation.id === params[0] && invocation.status === "pending_approval")
        .map((invocation) => {
          const agent = db.agents.find((item) => item.id === invocation.agent_id);
          const tool = db.tools.find((item) => item.id === invocation.tool_id);
          return {
            ...invocation,
            agent_name: agent?.name,
            tool_name: tool?.name,
            endpoint: tool?.endpoint,
            method: tool?.method,
            headers: tool?.headers,
            timeout_ms: tool?.timeout_ms,
            auth_config_encrypted: tool?.auth_config_encrypted,
            input_schema: tool?.input_schema,
          };
        });
      return result(rows);
    }

    if (normalized === "SELECT * FROM approvals WHERE id = $1 AND status = 'pending'") {
      return result(db.approvals.filter((approval) => approval.id === params[0] && approval.status === "pending"));
    }

    if (normalized === "SELECT * FROM approvals WHERE id = $1") {
      return result(db.approvals.filter((approval) => approval.id === params[0]));
    }

    if (normalized.startsWith("UPDATE invocations SET response_data_redacted")) {
      const invocation = db.invocations.find((item) => item.id === params[5]);
      if (!invocation) return result([]);
      invocation.response_data_redacted = params[0];
      invocation.status = params[1];
      invocation.latency_ms = params[2];
      invocation.error_message = params[3];
      invocation.approval_id = params[4];
      return result([invocation]);
    }

    if (normalized.startsWith("UPDATE approvals SET status = 'processing'")) {
      const approval = db.approvals.find((item) => item.id === params[2] && item.status === "pending");
      if (!approval) return result([]);
      approval.status = "processing";
      approval.approver = params[0];
      approval.comment = params[1];
      approval.updated_at = now();
      return result([approval]);
    }

    if (normalized.startsWith("UPDATE approvals SET status = 'approved'")) {
      const approval = db.approvals.find((item) => item.id === params[2] && item.status === "processing");
      if (!approval) return result([]);
      approval.status = "approved";
      approval.approver = params[0];
      approval.comment = params[1];
      approval.updated_at = now();
      return result([approval]);
    }

    if (normalized.startsWith("UPDATE approvals SET status = 'rejected'")) {
      const approval = db.approvals.find((item) => item.id === params[2] && item.status === "pending");
      if (!approval) return result([]);
      approval.status = "rejected";
      approval.approver = params[0];
      approval.comment = params[1];
      approval.updated_at = now();
      return result([approval]);
    }

    if (normalized.startsWith("UPDATE invocations SET status = 'denied'")) {
      const invocation = db.invocations.find((item) => item.id === params[2] && item.status === "pending_approval");
      if (!invocation) return result([]);
      invocation.status = "denied";
      invocation.approval_id = params[0];
      invocation.error_message = params[1];
      return result([invocation]);
    }

    if (normalized.startsWith("SELECT * FROM approvals")) {
      const lower = normalized.toLowerCase();
      const limit = params.at(-1) || 100;
      let index = 0;
      let rows = [...db.approvals];
      if (lower.includes("status =")) {
        rows = rows.filter((approval) => approval.status === params[index]);
        index += 1;
      }
      if (lower.includes("created_at >=")) {
        rows = rows.filter((approval) => approval.created_at >= params[index]);
        index += 1;
      }
      if (lower.includes("created_at <=")) {
        rows = rows.filter((approval) => approval.created_at <= params[index]);
      }
      return result(rows.reverse().slice(0, limit));
    }

    if (normalized.startsWith("INSERT INTO audit_logs")) {
      const row = {
        id: crypto.randomUUID(),
        event_type: params[0],
        actor_type: params[1],
        actor_id: params[2],
        resource_type: params[3],
        resource_id: params[4],
        detail_json: params[5],
        created_at: now(),
      };
      db.auditLogs.push(row);
      return result([row]);
    }

    if (normalized.startsWith("SELECT i.*, a.name AS agent_name, t.name AS tool_name")) {
      const lower = normalized.toLowerCase();
      const limit = params.at(-1) || 100;
      let index = 0;
      let rows = db.invocations.map((invocation) => ({
        ...invocation,
        agent_name: db.agents.find((agent) => agent.id === invocation.agent_id)?.name,
        tool_name: db.tools.find((tool) => tool.id === invocation.tool_id)?.name,
      }));
      if (lower.includes("where i.id =")) {
        return result(rows.filter((invocation) => invocation.id === params[0]));
      }
      if (lower.includes("i.agent_id =")) {
        rows = rows.filter((invocation) => invocation.agent_id === params[index]);
        index += 1;
      }
      if (lower.includes("i.tool_id =")) {
        rows = rows.filter((invocation) => invocation.tool_id === params[index]);
        index += 1;
      }
      if (lower.includes("i.status =")) {
        rows = rows.filter((invocation) => invocation.status === params[index]);
        index += 1;
      }
      if (lower.includes("i.created_at >=")) {
        rows = rows.filter((invocation) => invocation.created_at >= params[index]);
        index += 1;
      }
      if (lower.includes("i.created_at <=")) {
        rows = rows.filter((invocation) => invocation.created_at <= params[index]);
      }
      return result(rows.reverse().slice(0, limit));
    }

    if (normalized === "SELECT * FROM audit_logs WHERE id = $1") {
      return result(db.auditLogs.filter((audit) => audit.id === params[0]));
    }

    if (normalized.startsWith("SELECT * FROM audit_logs")) {
      const lower = normalized.toLowerCase();
      const limit = params.at(-1) || 100;
      let index = 0;
      let rows = [...db.auditLogs];
      if (lower.includes("event_type =")) {
        rows = rows.filter((audit) => audit.event_type === params[index]);
        index += 1;
      }
      if (lower.includes("actor_type =")) {
        rows = rows.filter((audit) => audit.actor_type === params[index]);
        index += 1;
      }
      if (lower.includes("resource_type =")) {
        rows = rows.filter((audit) => audit.resource_type === params[index]);
        index += 1;
      }
      if (lower.includes("created_at >=")) {
        rows = rows.filter((audit) => audit.created_at >= params[index]);
        index += 1;
      }
      if (lower.includes("created_at <=")) {
        rows = rows.filter((audit) => audit.created_at <= params[index]);
      }
      return result(rows.reverse().slice(0, limit));
    }

    throw new Error(`Unhandled fake SQL: ${normalized}`);
  }

  return { db, query };
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function jsonFetch(url, options = {}) {
  const { headers, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(headers || {}),
    },
  });
  const data = await response.json();
  return { response, data };
}

describe("ATG API flow", () => {
  let mockServer;
  let mockBaseUrl;
  let atgServer;
  let atgBaseUrl;
  let fake;

  before(async () => {
    mockServer = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        res.writeHead(200, { "content-type": "application/json" });
        if (req.url === "/mock/search_customer") {
          res.end(
            JSON.stringify({
              customer_id: body.customer_id || "cus_demo",
              name: "Demo Customer",
              tier: "gold",
              phone: "13812345678",
              email: "demo.customer@example.com",
              id_card: "110101199001011234",
              contacts: [{ type: "email", value: "vip.owner@example.com" }],
            }),
          );
          return;
        }
        if (req.url === "/mock/custom_redaction") {
          res.end(
            JSON.stringify({
              customer_id: body.customer_id || "cus_demo",
              account_number: "6222020202020202",
              support_ticket: "TCK-778899",
              notes: "manual review TCK-778899",
            }),
          );
          return;
        }
        if (req.url?.startsWith("/mock/orders/")) {
          const url = new URL(req.url, "http://localhost");
          res.end(
            JSON.stringify({
              order_path: url.pathname,
              include: url.searchParams.get("include"),
              status: "found",
            }),
          );
          return;
        }
        res.end(
          JSON.stringify({
            refund_id: "rf_test",
            order_id: body.order_id,
            amount: body.amount,
            reason: body.reason,
            status: "approved",
            processed_by: "mock-refund-api",
          }),
        );
      });
    });
    mockBaseUrl = await listen(mockServer);

    fake = createFakeDb();
    atgServer = createApp({ query: fake.query }).listen(0, "127.0.0.1");
    await new Promise((resolve) => atgServer.once("listening", resolve));
    atgBaseUrl = `http://127.0.0.1:${atgServer.address().port}`;
  });

  after(async () => {
    await close(atgServer);
    await close(mockServer);
  });

  it("creates an agent and tool, invokes the tool, and records invocation/audit rows", async () => {
    const health = await jsonFetch(`${atgBaseUrl}/healthz`);
    assert.equal(health.response.status, 200);
    assert.equal(health.data.status, "ok");

    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "customer-service-agent", owner: "ops" }),
    });
    assert.equal(createdAgent.response.status, 201);
    assert.match(createdAgent.data.api_key, /^atg_/);

    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "refund_order",
        endpoint: `${mockBaseUrl}/mock/refund_order`,
        method: "POST",
        headers: {},
      }),
    });
    assert.equal(createdTool.response.status, 201);
    assert.equal(createdTool.data.tool.name, "refund_order");

    const invoked = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/refund_order`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ order_id: "ord_demo", amount: 25, reason: "week_1_demo" }),
    });
    assert.equal(invoked.response.status, 200);
    assert.equal(invoked.data.status, "success");
    assert.equal(invoked.data.data.status, "approved");
    assert.equal(invoked.data.data.processed_by, "mock-refund-api");
    assert.match(invoked.data.invocation_id, /^[0-9a-f-]{36}$/);
    assert.match(invoked.data.audit_id, /^[0-9a-f-]{36}$/);

    const invocations = await jsonFetch(`${atgBaseUrl}/api/v1/invocations`);
    assert.equal(invocations.response.status, 200);
    assert.equal(invocations.data.invocations.length, 1);
    assert.equal(invocations.data.invocations[0].agent_name, "customer-service-agent");
    assert.equal(invocations.data.invocations[0].tool_name, "refund_order");
    assert.equal(invocations.data.invocations[0].status, "success");

    const auditLogs = await jsonFetch(`${atgBaseUrl}/api/v1/audit-logs`);
    assert.equal(auditLogs.response.status, 200);
    assert.deepEqual(
      auditLogs.data.audit_logs.map((log) => log.event_type),
      ["tool.invoke.succeeded", "tool.created", "agent.created"],
    );

    assert.equal(fake.db.agents.length, 1);
    assert.equal(fake.db.tools.length, 1);
    assert.equal(fake.db.invocations.length, 1);
    assert.equal(fake.db.auditLogs.length, 3);
  });

  it("redacts CRM response data before returning and storing invocation results", async () => {
    let targetCallCount = 0;
    mockServer.on("request", (req) => {
      if (req.url === "/mock/search_customer") {
        targetCallCount += 1;
      }
    });

    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "crm-agent", owner: "ops" }),
    });
    assert.equal(createdAgent.response.status, 201);

    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "search_customer",
        endpoint: `${mockBaseUrl}/mock/search_customer`,
        method: "POST",
        risk_level: "low",
        headers: {},
      }),
    });
    assert.equal(createdTool.response.status, 201);

    const createdPolicy = await jsonFetch(`${atgBaseUrl}/api/v1/policies`, {
      method: "POST",
      body: JSON.stringify({
        name: "Redact CRM customer data",
        priority: 1,
        action: "redact",
        condition_json: { tool: "search_customer" },
      }),
    });
    assert.equal(createdPolicy.response.status, 201);

    const tested = await jsonFetch(`${atgBaseUrl}/api/v1/tools/${createdTool.data.tool.id}/test`, {
      method: "POST",
      body: JSON.stringify({ customer_id: "cus_demo" }),
    });
    assert.equal(tested.response.status, 200);
    assert.equal(tested.data.data.email, "d************@example.com");
    assert.equal(tested.data.data.phone, "138****5678");
    assert.equal(tested.data.data.id_card, "110101********1234");

    const invoked = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/search_customer`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ customer_id: "cus_demo" }),
    });
    assert.equal(invoked.response.status, 200);
    assert.equal(invoked.data.status, "success");
    assert.equal(invoked.data.data.customer_id, "cus_demo");
    assert.equal(invoked.data.data.email, "d************@example.com");
    assert.equal(invoked.data.data.phone, "138****5678");
    assert.equal(invoked.data.data.id_card, "110101********1234");
    assert.equal(invoked.data.data.contacts[0].value, "v********@example.com");
    assert.equal(targetCallCount, 2);

    const invocation = fake.db.invocations.find((item) => item.id === invoked.data.invocation_id);
    assert.equal(invocation.response_data_redacted.email, "d************@example.com");
    assert.equal(invocation.response_data_redacted.phone, "138****5678");
    assert.equal(invocation.response_data_redacted.id_card, "110101********1234");
    assert.equal(invocation.policy_decision.matched_policy_id, createdPolicy.data.policy.id);
    assert.equal(invocation.policy_decision.action, "redact");
  });

  it("applies custom redact policy fields and patterns to returned and stored results", async () => {
    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "custom-redaction-agent", owner: "ops" }),
    });
    assert.equal(createdAgent.response.status, 201);

    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "custom_redaction_lookup",
        endpoint: `${mockBaseUrl}/mock/custom_redaction`,
        method: "POST",
        risk_level: "low",
        headers: {},
      }),
    });
    assert.equal(createdTool.response.status, 201);

    const createdPolicy = await jsonFetch(`${atgBaseUrl}/api/v1/policies`, {
      method: "POST",
      body: JSON.stringify({
        name: "Redact account and ticket data",
        priority: 1,
        action: "redact",
        condition_json: { tool: "custom_redaction_lookup" },
        scope: {
          redaction: {
            fields: ["account_number"],
            patterns: [{ pattern: "TCK-\\d+", replacement: "TCK-***" }],
          },
        },
      }),
    });
    assert.equal(createdPolicy.response.status, 201);

    const invoked = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/custom_redaction_lookup`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ customer_id: "cus_demo" }),
    });
    assert.equal(invoked.response.status, 200);
    assert.equal(invoked.data.status, "success");
    assert.equal(invoked.data.data.account_number, "***");
    assert.equal(invoked.data.data.support_ticket, "TCK-***");
    assert.equal(invoked.data.data.notes, "manual review TCK-***");

    const invocation = fake.db.invocations.find((item) => item.id === invoked.data.invocation_id);
    assert.equal(invocation.response_data_redacted.account_number, "***");
    assert.equal(invocation.response_data_redacted.support_ticket, "TCK-***");
    assert.equal(invocation.response_data_redacted.notes, "manual review TCK-***");
    assert.equal(invocation.policy_decision.redaction.fields[0], "account_number");
  });

  it("invokes tools with endpoint path placeholders from request input", async () => {
    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "path-agent", owner: "ops" }),
    });
    assert.equal(createdAgent.response.status, 201);

    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "get_order_by_path",
        endpoint: `${mockBaseUrl}/mock/orders/{order_id}`,
        method: "GET",
        risk_level: "low",
        headers: {},
        input_schema: {
          type: "object",
          required: ["order_id"],
          properties: {
            order_id: { type: "string" },
            include: { type: "string" },
          },
        },
      }),
    });
    assert.equal(createdTool.response.status, 201);

    const invoked = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/get_order_by_path`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ order_id: "ord/123", include: "items" }),
    });
    assert.equal(invoked.response.status, 200);
    assert.equal(invoked.data.status, "success");
    assert.equal(invoked.data.data.order_path, "/mock/orders/ord%2F123");
    assert.equal(invoked.data.data.include, "items");
  });

  it("exposes active registry tools through MCP tools/list and calls them through the gateway", async () => {
    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "mcp-agent", source_type: "mcp", owner: "dev" }),
    });
    assert.equal(createdAgent.response.status, 201);

    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "mcp_refund_order",
        description: "Refund through MCP",
        endpoint: `${mockBaseUrl}/mock/refund_order`,
        method: "POST",
        risk_level: "medium",
        input_schema: {
          type: "object",
          properties: { order_id: { type: "string" }, amount: { type: "number" } },
          required: ["order_id", "amount"],
        },
        headers: {},
      }),
    });
    assert.equal(createdTool.response.status, 201);

    const initialized = await jsonFetch(`${atgBaseUrl}/mcp`, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });
    assert.equal(initialized.response.status, 200);
    assert.equal(initialized.data.result.serverInfo.name, "agent-tool-gateway");
    assert.equal(initialized.data.result.capabilities.tools.listChanged, false);

    const listed = await jsonFetch(`${atgBaseUrl}/mcp`, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    assert.equal(listed.response.status, 200);
    const listedTool = listed.data.result.tools.find((tool) => tool.name === "mcp_refund_order");
    assert.equal(listedTool.description, "Refund through MCP");
    assert.equal(listedTool.inputSchema.required[0], "order_id");
    assert.equal(listedTool._meta["atg/riskLevel"], "medium");

    const called = await jsonFetch(`${atgBaseUrl}/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "mcp_refund_order",
          arguments: { order_id: "ord_mcp", amount: 42, reason: "mcp_demo" },
        },
      }),
    });
    assert.equal(called.response.status, 200);
    assert.equal(called.data.result.isError, false);
    assert.equal(called.data.result.structuredContent.status, "success");
    assert.equal(called.data.result.structuredContent.data.order_id, "ord_mcp");
    assert.equal(called.data.result.content[0].type, "text");

    const invocation = fake.db.invocations.find((item) => item.id === called.data.result.structuredContent.invocation_id);
    assert.equal(invocation.status, "success");
    assert.equal(invocation.request_args.order_id, "ord_mcp");
  });

  it("stores sensitive tool headers encrypted while using them for target calls", async () => {
    let receivedAuthorization = "";
    mockServer.on("request", (req) => {
      if (req.url === "/mock/secret_header") {
        receivedAuthorization = req.headers.authorization || "";
      }
    });

    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "secret-header-agent", owner: "ops" }),
    });
    assert.equal(createdAgent.response.status, 201);

    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "secret_header_tool",
        endpoint: `${mockBaseUrl}/mock/secret_header`,
        method: "POST",
        headers: {
          authorization: "Bearer upstream-secret",
          "x-trace-id": "trace-public",
        },
      }),
    });
    assert.equal(createdTool.response.status, 201);
    assert.equal(createdTool.data.tool.headers.authorization, "***");
    assert.equal(createdTool.data.tool.headers["x-trace-id"], "trace-public");

    const storedTool = fake.db.tools.find((tool) => tool.id === createdTool.data.tool.id);
    assert.deepEqual(storedTool.headers, { "x-trace-id": "trace-public" });
    assert.equal(storedTool.auth_config_encrypted.includes("upstream-secret"), false);

    const invoked = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/secret_header_tool`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ order_id: "ord_secret_header" }),
    });
    assert.equal(invoked.response.status, 200);
    assert.equal(receivedAuthorization, "Bearer upstream-secret");
  });

  it("validates tool input_schema before testing, invoking, or creating approvals", async () => {
    let targetCallCount = 0;
    mockServer.on("request", (req) => {
      if (req.url === "/mock/schema_guard") {
        targetCallCount += 1;
      }
    });

    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "schema-agent", owner: "ops" }),
    });
    assert.equal(createdAgent.response.status, 201);

    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "schema_guard",
        endpoint: `${mockBaseUrl}/mock/schema_guard`,
        method: "POST",
        input_schema: {
          type: "object",
          required: ["order_id", "amount"],
          properties: {
            order_id: { type: "string" },
            amount: { type: "number", minimum: 1 },
          },
        },
        headers: {},
      }),
    });
    assert.equal(createdTool.response.status, 201);

    await jsonFetch(`${atgBaseUrl}/api/v1/policies`, {
      method: "POST",
      body: JSON.stringify({
        name: "Approve schema guarded refunds",
        priority: 1,
        action: "approve",
        condition_json: { tool: "schema_guard", "args.amount": { gt: 100 } },
      }),
    });

    const invalidTest = await jsonFetch(`${atgBaseUrl}/api/v1/tools/${createdTool.data.tool.id}/test`, {
      method: "POST",
      body: JSON.stringify({ order_id: "ord_invalid", amount: "150" }),
    });
    assert.equal(invalidTest.response.status, 400);
    assert.equal(invalidTest.data.error.code, "invalid_tool_input");

    const invalidInvoke = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/schema_guard`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ order_id: "ord_invalid", amount: "150" }),
    });
    assert.equal(invalidInvoke.response.status, 400);
    assert.equal(invalidInvoke.data.error.code, "invalid_tool_input");
    assert.equal(targetCallCount, 0);
    assert.equal(fake.db.approvals.some((approval) => approval.reason.includes("schema guarded")), false);

    const validPending = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/schema_guard`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ order_id: "ord_valid", amount: 150 }),
    });
    assert.equal(validPending.response.status, 202);
    assert.equal(validPending.data.status, "pending_approval");
    assert.equal(targetCallCount, 0);
  });

  it("returns MCP tool call results for approval-required invocations without executing the target API", async () => {
    let targetCallCount = 0;
    mockServer.on("request", (req) => {
      if (req.url === "/mock/mcp_refund_approval") {
        targetCallCount += 1;
      }
    });

    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "mcp-approval-agent", source_type: "mcp", owner: "dev" }),
    });
    await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "mcp_refund_approval",
        endpoint: `${mockBaseUrl}/mock/mcp_refund_approval`,
        method: "POST",
        risk_level: "medium",
        headers: {},
      }),
    });
    await jsonFetch(`${atgBaseUrl}/api/v1/policies`, {
      method: "POST",
      body: JSON.stringify({
        name: "Approve MCP refunds over 100",
        priority: 1,
        action: "approve",
        condition_json: { tool: "mcp_refund_approval", "args.amount": { gt: 100 } },
      }),
    });

    const called = await jsonFetch(`${atgBaseUrl}/mcp`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "approval-call",
        method: "tools/call",
        params: {
          name: "mcp_refund_approval",
          arguments: { order_id: "ord_mcp_pending", amount: 150, reason: "needs_approval" },
        },
      }),
    });

    assert.equal(called.response.status, 200);
    assert.equal(called.data.id, "approval-call");
    assert.equal(called.data.result.isError, false);
    assert.equal(called.data.result.structuredContent.status, "pending_approval");
    assert.match(called.data.result.structuredContent.approval_id, /^[0-9a-f-]{36}$/);
    assert.equal(targetCallCount, 0);
  });

  it("rotates agent keys and enforces disabled agents/tools", async () => {
    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "management-agent", owner: "ops" }),
    });
    assert.equal(createdAgent.response.status, 201);
    const originalApiKey = createdAgent.data.api_key;

    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "refund_management",
        endpoint: `${mockBaseUrl}/mock/refund_order`,
        method: "POST",
        headers: {},
      }),
    });
    assert.equal(createdTool.response.status, 201);

    const firstInvoke = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/refund_management`, {
      method: "POST",
      headers: { authorization: `Bearer ${originalApiKey}` },
      body: JSON.stringify({ order_id: "ord_before_rotate", amount: 10, reason: "before_rotate" }),
    });
    assert.equal(firstInvoke.response.status, 200);
    assert.equal(firstInvoke.data.status, "success");

    const rotated = await jsonFetch(`${atgBaseUrl}/api/v1/agents/${createdAgent.data.agent.id}/rotate-key`, {
      method: "POST",
    });
    assert.equal(rotated.response.status, 200);
    assert.match(rotated.data.api_key, /^atg_/);
    assert.notEqual(rotated.data.api_key, originalApiKey);

    const oldKeyInvoke = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/refund_management`, {
      method: "POST",
      headers: { authorization: `Bearer ${originalApiKey}` },
      body: JSON.stringify({ order_id: "ord_old_key", amount: 10, reason: "old_key" }),
    });
    assert.equal(oldKeyInvoke.response.status, 401);
    assert.equal(oldKeyInvoke.data.error.code, "invalid_api_key");

    const newKeyInvoke = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/refund_management`, {
      method: "POST",
      headers: { authorization: `Bearer ${rotated.data.api_key}` },
      body: JSON.stringify({ order_id: "ord_new_key", amount: 10, reason: "new_key" }),
    });
    assert.equal(newKeyInvoke.response.status, 200);
    assert.equal(newKeyInvoke.data.status, "success");

    const disabledTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools/${createdTool.data.tool.id}/disable`, {
      method: "POST",
    });
    assert.equal(disabledTool.response.status, 200);
    assert.equal(disabledTool.data.tool.status, "disabled");

    const disabledToolInvoke = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/refund_management`, {
      method: "POST",
      headers: { authorization: `Bearer ${rotated.data.api_key}` },
      body: JSON.stringify({ order_id: "ord_disabled_tool", amount: 10, reason: "disabled_tool" }),
    });
    assert.equal(disabledToolInvoke.response.status, 404);
    assert.equal(disabledToolInvoke.data.error.code, "not_found");

    const secondTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "refund_agent_disabled",
        endpoint: `${mockBaseUrl}/mock/refund_order`,
        method: "POST",
        headers: {},
      }),
    });
    assert.equal(secondTool.response.status, 201);

    const disabledAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents/${createdAgent.data.agent.id}/disable`, {
      method: "POST",
    });
    assert.equal(disabledAgent.response.status, 200);
    assert.equal(disabledAgent.data.agent.status, "disabled");

    const disabledAgentInvoke = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/${secondTool.data.tool.name}`, {
      method: "POST",
      headers: { authorization: `Bearer ${rotated.data.api_key}` },
      body: JSON.stringify({ order_id: "ord_disabled_agent", amount: 10, reason: "disabled_agent" }),
    });
    assert.equal(disabledAgentInvoke.response.status, 401);
    assert.equal(disabledAgentInvoke.data.error.code, "invalid_api_key");

    const auditEvents = fake.db.auditLogs.map((log) => log.event_type);
    assert.ok(auditEvents.includes("agent.key_rotated"));
    assert.ok(auditEvents.includes("tool.disabled"));
    assert.ok(auditEvents.includes("agent.disabled"));
  });

  it("denies matching policy calls before reaching the target API", async () => {
    let targetCallCount = 0;
    mockServer.on("request", (req) => {
      if (req.url === "/mock/delete_user") {
        targetCallCount += 1;
      }
    });

    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "policy-agent", owner: "ops" }),
    });
    assert.equal(createdAgent.response.status, 201);

    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "delete_user",
        endpoint: `${mockBaseUrl}/mock/delete_user`,
        method: "POST",
        risk_level: "high",
        headers: {},
      }),
    });
    assert.equal(createdTool.response.status, 201);

    const createdPolicy = await jsonFetch(`${atgBaseUrl}/api/v1/policies`, {
      method: "POST",
      body: JSON.stringify({
        name: "Deny delete_user",
        priority: 10,
        action: "deny",
        condition_json: { tool: "delete_user" },
      }),
    });
    assert.equal(createdPolicy.response.status, 201);
    assert.equal(createdPolicy.data.policy.action, "deny");

    const policies = await jsonFetch(`${atgBaseUrl}/api/v1/policies`);
    assert.equal(policies.response.status, 200);
    assert.equal(policies.data.policies.some((policy) => policy.name === "Deny delete_user"), true);

    const activeDenyPolicies = await jsonFetch(`${atgBaseUrl}/api/v1/policies?action=deny&enabled=true`);
    assert.equal(activeDenyPolicies.response.status, 200);
    assert.equal(activeDenyPolicies.data.policies.length, 1);
    assert.equal(activeDenyPolicies.data.policies[0].id, createdPolicy.data.policy.id);

    const policyDetails = await jsonFetch(`${atgBaseUrl}/api/v1/policies/${createdPolicy.data.policy.id}`);
    assert.equal(policyDetails.response.status, 200);
    assert.equal(policyDetails.data.policy.id, createdPolicy.data.policy.id);
    assert.equal(policyDetails.data.policy.name, "Deny delete_user");
    assert.equal(policyDetails.data.policy.action, "deny");

    const missingPolicy = await jsonFetch(`${atgBaseUrl}/api/v1/policies/${crypto.randomUUID()}`);
    assert.equal(missingPolicy.response.status, 404);
    assert.equal(missingPolicy.data.error.code, "not_found");

    const invalidPolicyFilter = await jsonFetch(`${atgBaseUrl}/api/v1/policies?enabled=maybe`);
    assert.equal(invalidPolicyFilter.response.status, 400);
    assert.equal(invalidPolicyFilter.data.error.code, "invalid_request");

    const denied = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/delete_user`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ user_id: "user_123" }),
    });
    assert.equal(denied.response.status, 403);
    assert.equal(denied.data.status, "denied");
    assert.equal(denied.data.reason, "Denied by policy: Deny delete_user");
    assert.equal(targetCallCount, 0);

    const invocation = fake.db.invocations.find((item) => item.id === denied.data.invocation_id);
    assert.equal(invocation.status, "denied");
    assert.equal(invocation.matched_policy_id, createdPolicy.data.policy.id);

    const audit = fake.db.auditLogs.find((item) => item.id === denied.data.audit_id);
    assert.equal(audit.event_type, "tool.invoke.denied");
    assert.equal(audit.detail_json.policy_decision.matched_policy_name, "Deny delete_user");
    assert.match(audit.detail_json.policy_decision.explanation.join(" "), /Deny policies take precedence/);

    const disabledPolicy = await jsonFetch(`${atgBaseUrl}/api/v1/policies/${createdPolicy.data.policy.id}/disable`, {
      method: "POST",
    });
    assert.equal(disabledPolicy.response.status, 200);
    assert.equal(disabledPolicy.data.policy.enabled, false);

    const disabledPolicyDetails = await jsonFetch(`${atgBaseUrl}/api/v1/policies/${createdPolicy.data.policy.id}`);
    assert.equal(disabledPolicyDetails.response.status, 200);
    assert.equal(disabledPolicyDetails.data.policy.enabled, false);

    const disabledDenyPolicies = await jsonFetch(`${atgBaseUrl}/api/v1/policies?action=deny&enabled=false`);
    assert.equal(disabledDenyPolicies.response.status, 200);
    assert.equal(disabledDenyPolicies.data.policies.length, 1);
    assert.equal(disabledDenyPolicies.data.policies[0].id, createdPolicy.data.policy.id);
    assert.equal(disabledDenyPolicies.data.policies[0].enabled, false);

    const allowedAfterDisable = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/delete_user`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ user_id: "user_456" }),
    });
    assert.equal(allowedAfterDisable.response.status, 200);
    assert.equal(allowedAfterDisable.data.status, "success");
    assert.equal(targetCallCount, 1);

    const disabledAudit = fake.db.auditLogs.find((item) => item.event_type === "policy.disabled");
    assert.equal(disabledAudit.resource_id, createdPolicy.data.policy.id);
  });

  it("evaluates policies without invoking tools or writing invocation records", async () => {
    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "policy-preview-agent", owner: "ops" }),
    });
    assert.equal(createdAgent.response.status, 201);

    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "preview_refund",
        endpoint: `${mockBaseUrl}/mock/preview_refund`,
        method: "POST",
        risk_level: "medium",
        headers: {},
      }),
    });
    assert.equal(createdTool.response.status, 201);

    const createdPolicy = await jsonFetch(`${atgBaseUrl}/api/v1/policies`, {
      method: "POST",
      body: JSON.stringify({
        name: "Preview approve refunds over 100",
        priority: 1,
        action: "approve",
        condition_json: { tool: "preview_refund", "args.amount": { gt: 100 } },
      }),
    });
    assert.equal(createdPolicy.response.status, 201);

    const invocationCountBefore = fake.db.invocations.length;
    const evaluated = await jsonFetch(`${atgBaseUrl}/api/v1/policies/evaluate`, {
      method: "POST",
      body: JSON.stringify({
        agent_id: createdAgent.data.agent.id,
        tool_name: "preview_refund",
        input: { amount: 150 },
      }),
    });

    assert.equal(evaluated.response.status, 200);
    assert.equal(evaluated.data.decision.action, "approve");
    assert.equal(evaluated.data.decision.matched_policy_id, createdPolicy.data.policy.id);
    assert.equal(evaluated.data.decision.evaluation.mode, "composed");
    assert.equal(evaluated.data.decision.evaluation.evaluated_policies[0].matched, true);
    assert.equal(evaluated.data.agent.id, createdAgent.data.agent.id);
    assert.equal(evaluated.data.tool.id, createdTool.data.tool.id);
    assert.equal(fake.db.invocations.length, invocationCountBefore);
  });

  it("filters invocation, audit log, and approval lists for audit review", async () => {
    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "filter-agent", owner: "ops" }),
    });
    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "filter_refund",
        endpoint: `${mockBaseUrl}/mock/filter_refund`,
        method: "POST",
        headers: {},
      }),
    });
    await jsonFetch(`${atgBaseUrl}/api/v1/invoke/filter_refund`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ order_id: "ord_filter", amount: 10 }),
    });

    const filteredInvocations = await jsonFetch(
      `${atgBaseUrl}/api/v1/invocations?tool_id=${createdTool.data.tool.id}&status=success&limit=5`,
    );
    assert.equal(filteredInvocations.response.status, 200);
    assert.equal(filteredInvocations.data.invocations.every((item) => item.tool_id === createdTool.data.tool.id), true);
    assert.equal(filteredInvocations.data.invocations.every((item) => item.status === "success"), true);
    assert.equal(filteredInvocations.data.invocations.length <= 5, true);

    const filteredAuditLogs = await jsonFetch(`${atgBaseUrl}/api/v1/audit-logs?event_type=tool.invoke.succeeded&limit=3`);
    assert.equal(filteredAuditLogs.response.status, 200);
    assert.equal(filteredAuditLogs.data.audit_logs.every((item) => item.event_type === "tool.invoke.succeeded"), true);
    assert.equal(filteredAuditLogs.data.audit_logs.length <= 3, true);

    const approvalCreatedAt = new Date(Date.now() - 60_000).toISOString();
    fake.db.approvals.push(
      {
        id: crypto.randomUUID(),
        invocation_id: filteredInvocations.data.invocations[0].id,
        approver: "",
        status: "pending",
        reason: "filter pending approval",
        comment: "",
        created_at: approvalCreatedAt,
        updated_at: approvalCreatedAt,
      },
      {
        id: crypto.randomUUID(),
        invocation_id: filteredInvocations.data.invocations[0].id,
        approver: "alice",
        status: "approved",
        reason: "filter approved approval",
        comment: "approved",
        created_at: new Date(Date.now() - 120_000).toISOString(),
        updated_at: new Date(Date.now() - 60_000).toISOString(),
      },
    );
    const filteredApprovals = await jsonFetch(
      `${atgBaseUrl}/api/v1/approvals?status=pending&from=${encodeURIComponent(approvalCreatedAt)}&limit=1`,
    );
    assert.equal(filteredApprovals.response.status, 200);
    assert.equal(filteredApprovals.data.approvals.length, 1);
    assert.equal(filteredApprovals.data.approvals[0].status, "pending");
    assert.equal(filteredApprovals.data.approvals[0].created_at >= approvalCreatedAt, true);

    const invocationDetails = await jsonFetch(
      `${atgBaseUrl}/api/v1/invocations/${filteredInvocations.data.invocations[0].id}`,
    );
    assert.equal(invocationDetails.response.status, 200);
    assert.equal(invocationDetails.data.invocation.id, filteredInvocations.data.invocations[0].id);
    assert.equal(invocationDetails.data.invocation.agent_name, "filter-agent");
    assert.equal(invocationDetails.data.invocation.tool_name, "filter_refund");

    const approvalDetails = await jsonFetch(
      `${atgBaseUrl}/api/v1/approvals/${filteredApprovals.data.approvals[0].id}`,
    );
    assert.equal(approvalDetails.response.status, 200);
    assert.equal(approvalDetails.data.approval.id, filteredApprovals.data.approvals[0].id);
    assert.equal(approvalDetails.data.approval.status, "pending");

    const auditDetails = await jsonFetch(`${atgBaseUrl}/api/v1/audit-logs/${filteredAuditLogs.data.audit_logs[0].id}`);
    assert.equal(auditDetails.response.status, 200);
    assert.equal(auditDetails.data.audit_log.id, filteredAuditLogs.data.audit_logs[0].id);
    assert.equal(auditDetails.data.audit_log.event_type, "tool.invoke.succeeded");

    const missingInvocation = await jsonFetch(`${atgBaseUrl}/api/v1/invocations/${crypto.randomUUID()}`);
    assert.equal(missingInvocation.response.status, 404);
    assert.equal(missingInvocation.data.error.code, "not_found");

    const invalidLimit = await jsonFetch(`${atgBaseUrl}/api/v1/invocations?limit=9999`);
    assert.equal(invalidLimit.response.status, 400);
    assert.equal(invalidLimit.data.error.code, "invalid_request");

    const invalidApprovalDate = await jsonFetch(`${atgBaseUrl}/api/v1/approvals?from=not-a-date`);
    assert.equal(invalidApprovalDate.response.status, 400);
    assert.equal(invalidApprovalDate.data.error.code, "invalid_request");

    const evidence = await jsonFetch(
      `${atgBaseUrl}/api/v1/evidence/export?invocation_tool_id=${createdTool.data.tool.id}&invocation_status=success&audit_event_type=tool.invoke.succeeded&approval_status=pending&limit=5`,
    );
    assert.equal(evidence.response.status, 200);
    assert.equal(evidence.data.evidence.manifest.format, "atg.evidence.export.v1");
    assert.equal(evidence.data.evidence.manifest.filters.invocation_tool_id, createdTool.data.tool.id);
    assert.equal(evidence.data.evidence.manifest.counts.invocations, evidence.data.evidence.datasets.invocations.length);
    assert.equal(evidence.data.evidence.manifest.counts.audit_logs, evidence.data.evidence.datasets.audit_logs.length);
    assert.equal(evidence.data.evidence.datasets.invocations.every((item) => item.tool_id === createdTool.data.tool.id), true);
    assert.equal(evidence.data.evidence.datasets.invocations.every((item) => item.status === "success"), true);
    assert.equal(evidence.data.evidence.datasets.audit_logs.every((item) => item.event_type === "tool.invoke.succeeded"), true);
    assert.equal(evidence.data.evidence.datasets.approvals.every((item) => item.status === "pending"), true);
    assert.match(evidence.data.evidence.manifest.dataset_hashes.invocations_sha256, /^[0-9a-f]{64}$/);
    assert.match(evidence.data.evidence.manifest.dataset_hashes.audit_logs_sha256, /^[0-9a-f]{64}$/);
    assert.match(evidence.data.evidence.manifest.manifest_sha256, /^[0-9a-f]{64}$/);

    const invalidEvidenceDate = await jsonFetch(`${atgBaseUrl}/api/v1/evidence/export?from=not-a-date`);
    assert.equal(invalidEvidenceDate.response.status, 400);
    assert.equal(invalidEvidenceDate.data.error.code, "invalid_request");
  });

  it("creates a pending approval for approve policies before reaching the target API", async () => {
    let targetCallCount = 0;
    mockServer.on("request", (req) => {
      if (req.url === "/mock/refund_approval") {
        targetCallCount += 1;
      }
    });

    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "approval-agent", owner: "ops" }),
    });
    assert.equal(createdAgent.response.status, 201);

    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "refund_approval",
        endpoint: `${mockBaseUrl}/mock/refund_approval`,
        method: "POST",
        risk_level: "medium",
        headers: {},
      }),
    });
    assert.equal(createdTool.response.status, 201);

    const createdPolicy = await jsonFetch(`${atgBaseUrl}/api/v1/policies`, {
      method: "POST",
      body: JSON.stringify({
        name: "Approve large refunds",
        priority: 1,
        action: "approve",
        condition_json: { tool: "refund_approval", "args.amount": { gt: 100 } },
      }),
    });
    assert.equal(createdPolicy.response.status, 201);
    assert.equal(createdPolicy.data.policy.action, "approve");

    const pending = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/refund_approval`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ order_id: "ord_big", amount: 150, reason: "large_refund" }),
    });
    assert.equal(pending.response.status, 202);
    assert.equal(pending.data.status, "pending_approval");
    assert.equal(pending.data.reason, "Approval required by policy: Approve large refunds");
    assert.match(pending.data.approval_id, /^[0-9a-f-]{36}$/);
    assert.equal(targetCallCount, 0);

    const approvals = await jsonFetch(`${atgBaseUrl}/api/v1/approvals`);
    assert.equal(approvals.response.status, 200);
    assert.equal(approvals.data.approvals.some((approval) => approval.id === pending.data.approval_id), true);

    const invocation = fake.db.invocations.find((item) => item.id === pending.data.invocation_id);
    assert.equal(invocation.status, "pending_approval");
    assert.equal(invocation.matched_policy_id, createdPolicy.data.policy.id);

    const audit = fake.db.auditLogs.find((item) => item.id === pending.data.audit_id);
    assert.equal(audit.event_type, "tool.invoke.pending_approval");
    assert.equal(audit.detail_json.approval_id, pending.data.approval_id);
  });

  it("executes the original tool after approval", async () => {
    let targetCallCount = 0;
    mockServer.on("request", (req) => {
      if (req.url === "/mock/refund_execute") {
        targetCallCount += 1;
      }
    });

    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "approval-exec-agent", owner: "ops" }),
    });
    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "refund_execute",
        endpoint: `${mockBaseUrl}/mock/refund_execute`,
        method: "POST",
        risk_level: "medium",
        headers: {},
      }),
    });
    assert.equal(createdTool.response.status, 201);
    await jsonFetch(`${atgBaseUrl}/api/v1/policies`, {
      method: "POST",
      body: JSON.stringify({
        name: "Approve executable refund",
        priority: 1,
        action: "approve",
        condition_json: { tool: "refund_execute", "args.amount": { gt: 100 } },
      }),
    });

    const pending = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/refund_execute`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ order_id: "ord_execute", amount: 150, reason: "execute_after_approval" }),
    });
    assert.equal(pending.response.status, 202);
    assert.equal(targetCallCount, 0);

    const approved = await jsonFetch(`${atgBaseUrl}/api/v1/approvals/${pending.data.approval_id}/approve`, {
      method: "POST",
      body: JSON.stringify({ approver: "alice", comment: "approved" }),
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.data.status, "success");
    assert.equal(approved.data.approval.status, "approved");
    assert.equal(approved.data.data.status, "approved");
    assert.equal(targetCallCount, 1);

    const secondApprove = await jsonFetch(`${atgBaseUrl}/api/v1/approvals/${pending.data.approval_id}/approve`, {
      method: "POST",
      body: JSON.stringify({ approver: "alice", comment: "approved again" }),
    });
    assert.equal(secondApprove.response.status, 409);
    assert.equal(secondApprove.data.error.code, "approval_already_decided");
    assert.equal(targetCallCount, 1);

    const rejectAfterApprove = await jsonFetch(`${atgBaseUrl}/api/v1/approvals/${pending.data.approval_id}/reject`, {
      method: "POST",
      body: JSON.stringify({ approver: "bob", comment: "too late" }),
    });
    assert.equal(rejectAfterApprove.response.status, 409);
    assert.equal(rejectAfterApprove.data.error.code, "approval_already_decided");
    assert.equal(targetCallCount, 1);

    const invocation = fake.db.invocations.find((item) => item.id === pending.data.invocation_id);
    assert.equal(invocation.status, "success");
    assert.equal(invocation.response_data_redacted.status, "approved");

    const audit = fake.db.auditLogs.find((item) => item.id === approved.data.audit_id);
    assert.equal(audit.event_type, "approval.approved.executed");
  });

  it("keeps redaction rules when approval and redact policies both match", async () => {
    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "approval-redaction-agent", owner: "ops" }),
    });
    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "approval_redaction_lookup",
        endpoint: `${mockBaseUrl}/mock/custom_redaction`,
        method: "POST",
        risk_level: "high",
        headers: {},
      }),
    });
    assert.equal(createdTool.response.status, 201);

    const approvePolicy = await jsonFetch(`${atgBaseUrl}/api/v1/policies`, {
      method: "POST",
      body: JSON.stringify({
        name: "Approve sensitive lookup",
        priority: 1,
        action: "approve",
        condition_json: { tool: "approval_redaction_lookup" },
      }),
    });
    const redactPolicy = await jsonFetch(`${atgBaseUrl}/api/v1/policies`, {
      method: "POST",
      body: JSON.stringify({
        name: "Redact approved lookup",
        priority: 2,
        action: "redact",
        condition_json: { tool: "approval_redaction_lookup" },
        scope: { redaction: { fields: ["account_number"] } },
      }),
    });

    const pending = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/approval_redaction_lookup`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ customer_id: "cus_composed" }),
    });
    assert.equal(pending.response.status, 202);
    assert.equal(pending.data.status, "pending_approval");
    assert.match(pending.data.reason, /redaction also applies/);

    const pendingInvocation = fake.db.invocations.find((item) => item.id === pending.data.invocation_id);
    assert.equal(pendingInvocation.matched_policy_id, approvePolicy.data.policy.id);
    assert.equal(pendingInvocation.policy_decision.action, "approve");
    assert.deepEqual(pendingInvocation.policy_decision.redaction_policy_ids, [redactPolicy.data.policy.id]);
    assert.deepEqual(pendingInvocation.policy_decision.redaction, { fields: ["account_number"] });

    const approved = await jsonFetch(`${atgBaseUrl}/api/v1/approvals/${pending.data.approval_id}/approve`, {
      method: "POST",
      body: JSON.stringify({ approver: "alice", comment: "approved with redaction" }),
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.data.status, "success");
    assert.equal(approved.data.data.account_number, "***");
    assert.equal(approved.data.data.support_ticket, "TCK-778899");

    const completedInvocation = fake.db.invocations.find((item) => item.id === pending.data.invocation_id);
    assert.equal(completedInvocation.status, "success");
    assert.equal(completedInvocation.response_data_redacted.account_number, "***");
  });

  it("rejects pending approvals without executing the target API", async () => {
    let targetCallCount = 0;
    mockServer.on("request", (req) => {
      if (req.url === "/mock/refund_reject") {
        targetCallCount += 1;
      }
    });

    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "approval-reject-agent", owner: "ops" }),
    });
    await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      body: JSON.stringify({
        name: "refund_reject",
        endpoint: `${mockBaseUrl}/mock/refund_reject`,
        method: "POST",
        risk_level: "medium",
        headers: {},
      }),
    });
    await jsonFetch(`${atgBaseUrl}/api/v1/policies`, {
      method: "POST",
      body: JSON.stringify({
        name: "Approve reject refund",
        priority: 1,
        action: "approve",
        condition_json: { tool: "refund_reject", "args.amount": { gt: 100 } },
      }),
    });

    const pending = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/refund_reject`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ order_id: "ord_reject", amount: 150, reason: "reject_approval" }),
    });
    assert.equal(pending.response.status, 202);

    const rejected = await jsonFetch(`${atgBaseUrl}/api/v1/approvals/${pending.data.approval_id}/reject`, {
      method: "POST",
      body: JSON.stringify({ approver: "bob", comment: "too risky" }),
    });
    assert.equal(rejected.response.status, 200);
    assert.equal(rejected.data.status, "rejected");
    assert.equal(rejected.data.approval.status, "rejected");
    assert.equal(targetCallCount, 0);

    const approveAfterReject = await jsonFetch(`${atgBaseUrl}/api/v1/approvals/${pending.data.approval_id}/approve`, {
      method: "POST",
      body: JSON.stringify({ approver: "alice", comment: "too late" }),
    });
    assert.equal(approveAfterReject.response.status, 409);
    assert.equal(approveAfterReject.data.error.code, "approval_already_decided");
    assert.equal(targetCallCount, 0);

    const secondReject = await jsonFetch(`${atgBaseUrl}/api/v1/approvals/${pending.data.approval_id}/reject`, {
      method: "POST",
      body: JSON.stringify({ approver: "bob", comment: "still too risky" }),
    });
    assert.equal(secondReject.response.status, 409);
    assert.equal(secondReject.data.error.code, "approval_already_decided");
    assert.equal(targetCallCount, 0);

    const invocation = fake.db.invocations.find((item) => item.id === pending.data.invocation_id);
    assert.equal(invocation.status, "denied");
    assert.equal(invocation.error_message, "too risky");

    const audit = fake.db.auditLogs.find((item) => item.id === rejected.data.audit_id);
    assert.equal(audit.event_type, "approval.rejected");
  });
});

describe("ATG admin auth", () => {
  let mockServer;
  let mockBaseUrl;
  let atgServer;
  let atgBaseUrl;
  let fake;

  before(async () => {
    mockServer = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ order_id: body.order_id, status: "approved" }));
      });
    });
    mockBaseUrl = await listen(mockServer);

    fake = createFakeDb();
    atgServer = createApp({ query: fake.query, adminToken: "admin-secret" }).listen(0, "127.0.0.1");
    await new Promise((resolve) => atgServer.once("listening", resolve));
    atgBaseUrl = `http://127.0.0.1:${atgServer.address().port}`;
  });

  after(async () => {
    await close(atgServer);
    await close(mockServer);
  });

  function adminHeaders(extra = {}) {
    return { "x-admin-token": "admin-secret", ...extra };
  }

  it("requires admin token for management APIs while preserving agent invoke auth", async () => {
    const blocked = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      body: JSON.stringify({ name: "blocked-agent" }),
    });
    assert.equal(blocked.response.status, 401);
    assert.equal(blocked.data.error.code, "admin_auth_required");

    const createdAgent = await jsonFetch(`${atgBaseUrl}/api/v1/agents`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name: "admin-auth-agent", owner: "ops" }),
    });
    assert.equal(createdAgent.response.status, 201);

    const createdTool = await jsonFetch(`${atgBaseUrl}/api/v1/tools`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        name: "admin_auth_refund",
        endpoint: `${mockBaseUrl}/mock/refund_order`,
        method: "POST",
        headers: {},
      }),
    });
    assert.equal(createdTool.response.status, 201);

    const listedWithoutToken = await jsonFetch(`${atgBaseUrl}/api/v1/tools`);
    assert.equal(listedWithoutToken.response.status, 401);

    const invoked = await jsonFetch(`${atgBaseUrl}/api/v1/invoke/admin_auth_refund`, {
      method: "POST",
      headers: { authorization: `Bearer ${createdAgent.data.api_key}` },
      body: JSON.stringify({ order_id: "ord_admin_auth" }),
    });
    assert.equal(invoked.response.status, 200);
    assert.equal(invoked.data.status, "success");
  });
});
