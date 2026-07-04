# ATG Python SDK

Minimal Python client for Agent Tool Gateway. The core SDK uses only the Python standard library and can call either the REST invoke API or the MCP JSON-RPC endpoint.

The SDK is a thin access path into the independent ATG gateway. Governance stays in ATG, not in Python application code or a LangChain-specific plugin.

## Install For Local Development

```bash
cd sdk/python
python -m pip install -e .
```

Optional LangChain adapter:

```bash
python -m pip install -e ".[langchain]"
```

## Invoke A Tool

```python
from atg_sdk import AtgClient, AtgError

client = AtgClient(base_url="http://localhost:8080", api_key="atg_...")
try:
    result = client.invoke("refund_order", {
        "order_id": "ord_sdk",
        "amount": 25,
        "reason": "python_sdk_demo",
    })
    if result["status"] == "pending_approval":
        print("Waiting for approval:", result["approval_id"])
    else:
        print(result["data"])
except AtgError as error:
    print(error.status_code, error.payload)
```

`invoke()` returns `success` or `pending_approval` for 2xx responses. Policy denials and upstream Tool failures are non-2xx responses and raise `AtgError`; the original ATG response body is available in `error.payload`.

## Admin Registry

```python
admin_client = AtgClient(base_url="http://localhost:8080", admin_token="local-admin-secret")
agent = admin_client.create_agent(name="sdk-agent", owner="ops")
tool = admin_client.create_tool(
    name="refund_order",
    endpoint="http://localhost:9090/mock/refund_order",
    risk_level="medium",
)
admin_client.test_tool(tool["tool"]["id"], {"order_id": "ord_sdk_test", "amount": 25})
agents = admin_client.list_agents()
tools = admin_client.list_tools()
rotated = admin_client.rotate_agent_key(agent["agent"]["id"])
admin_client.disable_tool(tool["tool"]["id"])
admin_client.disable_agent(agent["agent"]["id"])
```

## MCP Tools

```python
client.mcp_initialize()
tools = client.mcp_list_tools()
result = client.mcp_call_tool("refund_order", {
    "order_id": "ord_mcp_sdk",
    "amount": 25,
    "reason": "python_mcp_demo",
})
```

## Policy Preview

```python
admin_client = AtgClient(base_url="http://localhost:8080", admin_token="local-admin-secret")
policy = admin_client.create_policy(
    name="Approve large refunds",
    priority=1,
    action="approve",
    condition_json={"tool": "refund_order", "args.amount": {"gt": 100}},
)

preview = admin_client.evaluate_policy(
    agent_id="agent_id",
    tool_name="refund_order",
    input={"amount": 150},
)
print(preview["decision"])

policies = admin_client.list_policies(action="approve", enabled=True)
print(policies["policies"])
policy_detail = admin_client.get_policy(policy["policy"]["id"])
print(policy_detail["policy"])

disabled = admin_client.disable_policy(policy["policy"]["id"])
print(disabled["policy"]["enabled"])
```

## Approval Decisions

```python
pending = admin_client.list_approvals(status="pending", limit=20)
print(pending["approvals"])
approval = admin_client.get_approval(pending["approvals"][0]["id"])
print(approval["approval"])

pending_today = admin_client.list_approvals(
    status="pending",
    from_time="2026-06-01T00:00:00Z",
    to_time="2026-07-01T00:00:00Z",
    limit=50,
)
print(pending_today["approvals"])

approved = admin_client.approve_approval(
    "approval_id",
    approver="alice",
    comment="Approved from SDK",
)
print(approved["status"])

rejected = admin_client.reject_approval(
    "approval_id",
    approver="alice",
    comment="Rejected from SDK",
)
print(rejected["approval"]["status"])
```

`approve_approval()` returns `success` when the approved Tool execution succeeds. If the upstream Tool execution fails, the SDK raises `AtgError` with the ATG failure payload.

## Evidence Review

```python
invocations = admin_client.list_invocations(
    agent_id="agent_id",
    tool_id="tool_id",
    status="success",
    from_time="2026-06-01T00:00:00Z",
    to_time="2026-07-01T00:00:00Z",
    limit=20,
)
audit_logs = admin_client.list_audit_logs(
    event_type="tool.invoke.succeeded",
    actor_type="agent",
    resource_type="tool",
    from_time="2026-06-01T00:00:00Z",
    to_time="2026-07-01T00:00:00Z",
    limit=20,
)
invocation = admin_client.get_invocation(invocations["invocations"][0]["id"])
audit_log = admin_client.get_audit_log(audit_logs["audit_logs"][0]["id"])
print(invocation["invocation"], audit_log["audit_log"])

evidence = admin_client.export_evidence(
    invocation_tool_id="tool_id",
    invocation_status="success",
    audit_event_type="tool.invoke.succeeded",
    policy_action="approve",
    from_time="2026-06-01T00:00:00Z",
    to_time="2026-07-01T00:00:00Z",
    limit=100,
)
print(evidence["evidence"]["manifest"])
```

The evidence manifest includes the applied `filters`, dataset `counts`, aggregate `summaries`, per-dataset `dataset_hashes`, `health`, and `manifest_sha256`.

## Example

```bash
cd sdk/python
ATG_API_KEY=$API_KEY ATG_TOOL_NAME=refund_order python examples/langchain_tool_demo.py
```

PowerShell:

```powershell
cd sdk/python
$env:ATG_API_KEY = $API_KEY
$env:ATG_TOOL_NAME = "refund_order"
python examples/langchain_tool_demo.py
```

Set `ATG_USE_MCP=1` to run the same example through `/mcp` and `tools/call`.

Set `ATG_USE_LANGCHAIN=1` after installing `.[langchain]` to wrap the ATG tool as a LangChain `StructuredTool`. This adapter is intentionally thin; policy, approval, redaction, credential isolation, and audit still execute in ATG.
