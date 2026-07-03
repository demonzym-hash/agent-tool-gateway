from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


class AtgError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None, payload: dict[str, Any] | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


@dataclass(frozen=True)
class AtgClient:
    base_url: str = "http://localhost:8080"
    api_key: str | None = None
    admin_token: str | None = None
    timeout: float = 10

    def invoke(self, tool_name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        encoded_tool_name = urllib.parse.quote(tool_name, safe="")
        return self._request(
            f"/api/v1/invoke/{encoded_tool_name}",
            payload=arguments or {},
            headers=self._auth_headers(),
        )

    def mcp_initialize(self) -> dict[str, Any]:
        return self._rpc("initialize", {"protocolVersion": "2025-11-25", "clientInfo": {"name": "atg-python-sdk"}})

    def mcp_list_tools(self) -> list[dict[str, Any]]:
        result = self._rpc("tools/list", {})
        return result.get("tools", [])

    def mcp_call_tool(self, tool_name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._rpc("tools/call", {"name": tool_name, "arguments": arguments or {}}, auth=True)

    def create_agent(
        self,
        *,
        name: str,
        description: str = "",
        source_type: str = "custom",
        owner: str = "",
    ) -> dict[str, Any]:
        return self._request(
            "/api/v1/agents",
            payload={"name": name, "description": description, "source_type": source_type, "owner": owner},
            headers=self._admin_headers(),
        )

    def list_agents(self) -> dict[str, Any]:
        return self._request("/api/v1/agents", method="GET", headers=self._admin_headers())

    def get_agent(self, agent_id: str) -> dict[str, Any]:
        return self._request(f"/api/v1/agents/{agent_id}", method="GET", headers=self._admin_headers())

    def rotate_agent_key(self, agent_id: str) -> dict[str, Any]:
        return self._request(f"/api/v1/agents/{agent_id}/rotate-key", payload={}, headers=self._admin_headers())

    def disable_agent(self, agent_id: str) -> dict[str, Any]:
        return self._request(f"/api/v1/agents/{agent_id}/disable", payload={}, headers=self._admin_headers())

    def create_tool(
        self,
        *,
        name: str,
        endpoint: str,
        description: str = "",
        type: str = "http",
        risk_level: str = "low",
        method: str = "POST",
        headers: dict[str, str] | None = None,
        timeout_ms: int = 5000,
        input_schema: dict[str, Any] | None = None,
        output_schema: dict[str, Any] | None = None,
        owner: str = "",
    ) -> dict[str, Any]:
        return self._request(
            "/api/v1/tools",
            payload={
                "name": name,
                "description": description,
                "type": type,
                "risk_level": risk_level,
                "endpoint": endpoint,
                "method": method,
                "headers": headers or {},
                "timeout_ms": timeout_ms,
                "input_schema": input_schema or {},
                "output_schema": output_schema or {},
                "owner": owner,
            },
            headers=self._admin_headers(),
        )

    def list_tools(self) -> dict[str, Any]:
        return self._request("/api/v1/tools", method="GET", headers=self._admin_headers())

    def get_tool(self, tool_id: str) -> dict[str, Any]:
        return self._request(f"/api/v1/tools/{tool_id}", method="GET", headers=self._admin_headers())

    def test_tool(self, tool_id: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request(f"/api/v1/tools/{tool_id}/test", payload=arguments or {}, headers=self._admin_headers())

    def disable_tool(self, tool_id: str) -> dict[str, Any]:
        return self._request(f"/api/v1/tools/{tool_id}/disable", payload={}, headers=self._admin_headers())

    def evaluate_policy(
        self,
        *,
        agent_id: str,
        tool_id: str | None = None,
        tool_name: str | None = None,
        input: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload = {
            "agent_id": agent_id,
            "input": input or {},
        }
        if tool_id:
            payload["tool_id"] = tool_id
        if tool_name:
            payload["tool_name"] = tool_name
        return self._request("/api/v1/policies/evaluate", payload=payload, headers=self._admin_headers())

    def create_policy(
        self,
        *,
        name: str,
        description: str = "",
        priority: int = 100,
        scope: dict[str, Any] | None = None,
        condition_json: dict[str, Any] | None = None,
        action: str = "allow",
        enabled: bool = True,
    ) -> dict[str, Any]:
        return self._request(
            "/api/v1/policies",
            payload={
                "name": name,
                "description": description,
                "priority": priority,
                "scope": scope or {},
                "condition_json": condition_json or {},
                "action": action,
                "enabled": enabled,
            },
            headers=self._admin_headers(),
        )

    def list_policies(self, *, action: str | None = None, enabled: bool | None = None) -> dict[str, Any]:
        params: dict[str, str] = {}
        if action:
            params["action"] = action
        if enabled is not None:
            params["enabled"] = str(enabled).lower()
        query = urllib.parse.urlencode(params)
        path = f"/api/v1/policies?{query}" if query else "/api/v1/policies"
        return self._request(path, method="GET", headers=self._admin_headers())

    def get_policy(self, policy_id: str) -> dict[str, Any]:
        return self._request(f"/api/v1/policies/{policy_id}", method="GET", headers=self._admin_headers())

    def disable_policy(self, policy_id: str) -> dict[str, Any]:
        return self._request(f"/api/v1/policies/{policy_id}/disable", payload={}, headers=self._admin_headers())

    def approve_approval(
        self,
        approval_id: str,
        *,
        approver: str = "sdk-approver",
        comment: str = "",
    ) -> dict[str, Any]:
        return self._request(
            f"/api/v1/approvals/{approval_id}/approve",
            payload={"approver": approver, "comment": comment},
            headers=self._admin_headers(),
        )

    def reject_approval(
        self,
        approval_id: str,
        *,
        approver: str = "sdk-approver",
        comment: str = "",
    ) -> dict[str, Any]:
        return self._request(
            f"/api/v1/approvals/{approval_id}/reject",
            payload={"approver": approver, "comment": comment},
            headers=self._admin_headers(),
        )

    def get_approval(self, approval_id: str) -> dict[str, Any]:
        return self._request(f"/api/v1/approvals/{approval_id}", method="GET", headers=self._admin_headers())

    def list_approvals(
        self,
        *,
        status: str | None = None,
        from_time: str | None = None,
        to_time: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        params: dict[str, str] = {}
        if status:
            params["status"] = status
        if from_time:
            params["from"] = from_time
        if to_time:
            params["to"] = to_time
        if limit is not None:
            params["limit"] = str(limit)
        query = urllib.parse.urlencode(params)
        path = f"/api/v1/approvals?{query}" if query else "/api/v1/approvals"
        return self._request(path, method="GET", headers=self._admin_headers())

    def get_invocation(self, invocation_id: str) -> dict[str, Any]:
        return self._request(f"/api/v1/invocations/{invocation_id}", method="GET", headers=self._admin_headers())

    def list_invocations(
        self,
        *,
        agent_id: str | None = None,
        tool_id: str | None = None,
        status: str | None = None,
        from_time: str | None = None,
        to_time: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        params: dict[str, str] = {}
        if agent_id:
            params["agent_id"] = agent_id
        if tool_id:
            params["tool_id"] = tool_id
        if status:
            params["status"] = status
        if from_time:
            params["from"] = from_time
        if to_time:
            params["to"] = to_time
        if limit is not None:
            params["limit"] = str(limit)
        query = urllib.parse.urlencode(params)
        path = f"/api/v1/invocations?{query}" if query else "/api/v1/invocations"
        return self._request(path, method="GET", headers=self._admin_headers())

    def get_audit_log(self, audit_log_id: str) -> dict[str, Any]:
        return self._request(f"/api/v1/audit-logs/{audit_log_id}", method="GET", headers=self._admin_headers())

    def list_audit_logs(
        self,
        *,
        event_type: str | None = None,
        actor_type: str | None = None,
        resource_type: str | None = None,
        from_time: str | None = None,
        to_time: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        params: dict[str, str] = {}
        if event_type:
            params["event_type"] = event_type
        if actor_type:
            params["actor_type"] = actor_type
        if resource_type:
            params["resource_type"] = resource_type
        if from_time:
            params["from"] = from_time
        if to_time:
            params["to"] = to_time
        if limit is not None:
            params["limit"] = str(limit)
        query = urllib.parse.urlencode(params)
        path = f"/api/v1/audit-logs?{query}" if query else "/api/v1/audit-logs"
        return self._request(path, method="GET", headers=self._admin_headers())

    def _rpc(self, method: str, params: dict[str, Any], *, auth: bool = False) -> dict[str, Any]:
        payload = {
            "jsonrpc": "2.0",
            "id": f"py_{int(time.time() * 1000)}",
            "method": method,
            "params": params,
        }
        response = self._request("/mcp", payload=payload, headers=self._auth_headers() if auth else {})
        if "error" in response:
            error = response["error"]
            raise AtgError(error.get("message", "MCP request failed"), payload=error)
        return response.get("result", {})

    def _auth_headers(self) -> dict[str, str]:
        if not self.api_key:
            raise AtgError("ATG API key is required for this operation")
        return {"authorization": f"Bearer {self.api_key}"}

    def _admin_headers(self) -> dict[str, str]:
        return {"x-admin-token": self.admin_token} if self.admin_token else {}

    def _request(
        self,
        path: str,
        *,
        method: str = "POST",
        payload: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(
            f"{self.base_url.rstrip('/')}{path}",
            data=body,
            headers={
                "content-type": "application/json",
                "accept": "application/json",
                **(headers or {}),
            },
            method=method,
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return _read_json(response)
        except urllib.error.HTTPError as err:
            payload = _read_json(err)
            message = _extract_error_message(payload) or f"ATG request failed with HTTP {err.code}"
            raise AtgError(message, status_code=err.code, payload=payload) from err
        except urllib.error.URLError as err:
            raise AtgError(f"ATG request failed: {err.reason}") from err


def _read_json(response: Any) -> dict[str, Any]:
    text = response.read().decode("utf-8")
    return json.loads(text) if text else {}


def _extract_error_message(payload: dict[str, Any]) -> str | None:
    error = payload.get("error")
    if isinstance(error, dict):
        return error.get("message")
    return None
