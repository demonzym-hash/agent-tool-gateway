# Dify HTTP Tool Example

This example shows how to call an ATG Tool from Dify through Dify's HTTP request / API tool capability.

ATG remains the security boundary:

1. Dify stores only the Agent API key issued by ATG.
2. Dify calls `POST /api/v1/invoke/{tool_name}`.
3. ATG applies policy, approval, redaction, invocation logging, and audit logging.
4. Dify receives the redacted tool result.

## Prerequisites

- ATG server running at `http://localhost:8080`.
- Mock API running at `http://localhost:9090`.
- An active ATG Agent API key in `API_KEY`.
- A registered ATG Tool, for example `refund_order`.

Create a demo Tool:

```bash
curl -s http://localhost:8080/api/v1/tools \
  -H "content-type: application/json" \
  -d '{
    "name": "refund_order",
    "description": "Refund an order through ATG",
    "endpoint": "http://localhost:9090/mock/refund_order",
    "method": "POST",
    "risk_level": "medium",
    "timeout_ms": 5000,
    "headers": {}
  }'
```

## Dify HTTP Tool Settings

Use these settings in Dify:

| Field | Value |
|---|---|
| Method | `POST` |
| URL | `http://localhost:8080/api/v1/invoke/refund_order` |
| Header `Authorization` | `Bearer {{ATG_API_KEY}}` |
| Header `Content-Type` | `application/json` |
| Body type | JSON |

Request body:

```json
{
  "order_id": "{{order_id}}",
  "amount": {{amount}},
  "reason": "{{reason}}"
}
```

Equivalent curl:

```bash
curl -s http://localhost:8080/api/v1/invoke/refund_order \
  -H "authorization: Bearer $API_KEY" \
  -H "content-type: application/json" \
  -d '{"order_id":"ord_dify","amount":25,"reason":"dify_http_tool"}'
```

If an approval policy matches, Dify receives `pending_approval` with an `approval_id`, and the target API is not called until an approver approves it in ATG.

If a deny policy matches, ATG returns HTTP `403` with `status: "denied"`. If the upstream Tool call fails, ATG returns HTTP `502` with `status: "failed"`.
