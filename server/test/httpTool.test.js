import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { callHttpTool } from "../src/httpTool.js";

let server;
let baseUrl;
const requests = [];

before(async () => {
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const bodyText = Buffer.concat(chunks).toString("utf8");
      const url = new URL(req.url, "http://localhost");
      requests.push({
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        headers: req.headers,
        body: bodyText ? JSON.parse(bodyText) : null,
      });

      if (url.pathname === "/plain") {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("accepted");
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, path: url.pathname, query: Object.fromEntries(url.searchParams.entries()) }));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("callHttpTool", () => {
  it("sends POST tools with a JSON body and configured headers", async () => {
    const result = await callHttpTool(
      {
        endpoint: `${baseUrl}/refund`,
        method: "POST",
        headers: { "x-atg-test": "yes" },
        timeout_ms: 1000,
      },
      { order_id: "ord_demo", amount: 25 },
    );

    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.data, { ok: true, path: "/refund", query: {} });

    const request = requests.at(-1);
    assert.equal(request.method, "POST");
    assert.equal(request.headers["x-atg-test"], "yes");
    assert.deepEqual(request.body, { order_id: "ord_demo", amount: 25 });
  });

  it("expands GET input into query params without sending a body", async () => {
    const result = await callHttpTool(
      {
        endpoint: `${baseUrl}/customer`,
        method: "GET",
        headers: {},
        timeout_ms: 1000,
      },
      { customer_id: "cus_demo", tags: ["gold"] },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.data.query, { customer_id: "cus_demo", tags: "[\"gold\"]" });

    const request = requests.at(-1);
    assert.equal(request.method, "GET");
    assert.equal(request.body, null);
  });

  it("replaces endpoint path parameters and does not duplicate them as query params", async () => {
    const result = await callHttpTool(
      {
        endpoint: `${baseUrl}/customers/{customer_id}/orders/{order_id}`,
        method: "GET",
        headers: {},
        timeout_ms: 1000,
      },
      { customer_id: "cus demo", order_id: "ord/123", include: "items" },
    );

    assert.equal(result.ok, true);
    assert.equal(result.data.path, "/customers/cus%20demo/orders/ord%2F123");
    assert.deepEqual(result.data.query, { include: "items" });

    const request = requests.at(-1);
    assert.equal(request.method, "GET");
    assert.equal(request.body, null);
    assert.deepEqual(request.query, { include: "items" });
  });

  it("replaces POST endpoint path parameters while keeping the JSON body", async () => {
    const result = await callHttpTool(
      {
        endpoint: `${baseUrl}/orders/{order_id}/refunds`,
        method: "POST",
        headers: {},
        timeout_ms: 1000,
      },
      { order_id: "ord/123", amount: 25 },
    );

    assert.equal(result.ok, true);
    assert.equal(result.data.path, "/orders/ord%2F123/refunds");

    const request = requests.at(-1);
    assert.equal(request.method, "POST");
    assert.deepEqual(request.body, { order_id: "ord/123", amount: 25 });
  });

  it("wraps non-JSON responses as raw text", async () => {
    const result = await callHttpTool(
      {
        endpoint: `${baseUrl}/plain`,
        method: "POST",
        headers: {},
        timeout_ms: 1000,
      },
      { ok: true },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.data, { raw: "accepted" });
  });

  it("blocks HTTP endpoints when egress policy disables plain HTTP", async () => {
    await assert.rejects(
      callHttpTool(
        {
          endpoint: `${baseUrl}/refund`,
          method: "POST",
          headers: {},
          timeout_ms: 1000,
        },
        { order_id: "ord_demo" },
        { allowHttp: false },
      ),
      /HTTP Tool endpoints are disabled/,
    );
  });

  it("blocks private endpoints unless explicitly allowed", async () => {
    await assert.rejects(
      callHttpTool(
        {
          endpoint: `${baseUrl}/refund`,
          method: "POST",
          headers: {},
          timeout_ms: 1000,
        },
        { order_id: "ord_demo" },
        { allowPrivateNetwork: false },
      ),
      /private address/,
    );

    const result = await callHttpTool(
      {
        endpoint: `${baseUrl}/refund`,
        method: "POST",
        headers: {},
        timeout_ms: 1000,
      },
      { order_id: "ord_demo" },
      { allowPrivateNetwork: false, allowedHosts: ["127.0.0.1"] },
    );
    assert.equal(result.ok, true);
  });
});
