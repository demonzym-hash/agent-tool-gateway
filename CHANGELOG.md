# Changelog

## 0.1.0 - MVP Release Candidate

### Added

- AGPL-3.0-only public core licensing, MIT SDK/example licensing, commercial dual-license guidance, and contributor license terms.
- Agent registry with one-time API key issuance, API key hashing, rotation, and disable support.
- HTTP Tool registry with test, invoke, disable, timeout, headers, input schema, and output schema fields.
- Tool invocation gateway with Agent API key authentication, policy evaluation, target HTTP execution, invocation records, and audit logs.
- Policy actions for `allow`, `deny`, `approve`, and `redact`, with numeric and string match conditions.
- Policy preview API, Web Console preview, and SDK helper methods for evaluating enabled policies without executing target APIs.
- Policy disable API and Web Console action for removing policies from evaluation without deleting audit-visible records.
- Policy detail API, Web Console detail view, and list filters for focusing review by action and enabled state.
- Approval flow for pending tool calls, including approve/reject APIs and post-approval execution.
- Invocation, approval, and audit log detail APIs for focused evidence review.
- Default response redaction for emails, phone numbers, and Chinese ID-card-like strings before returning or storing tool results.
- Redact policy `scope.redaction` rules for customer-specific field masking, basic JSONPath paths, and regex replacement, including Web Console creation support.
- Sensitive Tool header isolation with encrypted storage for headers such as `Authorization`, `x-api-key`, and `x-auth-token`.
- Optional Admin token protection for management APIs and the Web Console.
- MCP JSON-RPC endpoint for `initialize`, `tools/list`, and `tools/call` over the same policy, approval, redaction, invocation, and audit path.
- React + Ant Design Web Console for Agents, Tools, Policies, policy preview, Approvals, Invocations, Audit Logs, evidence detail API-backed details, audit actor/resource filters, and dashboard metrics.
- OpenAPI 3.1 spec for the v0.1 HTTP API surface.
- Integrator delivery template and customer HTTP Tool JSON template for repeatable customer API adaptation.
- OpenAPI JSON operation importer for generating ATG HTTP Tool drafts.
- OpenAPI importer output separates supported path-placeholder notes from actionable warnings.
- HTTP Tool endpoint path placeholders such as `{order_id}` for OpenAPI path-parameter operations.
- Dify HTTP Tool example, MCP client example, Python SDK/LangChain adapter, and TypeScript-friendly SDK with Agent/Tool registry helpers, policy creation helpers, policy preview helpers, policy list/detail helpers, approval list helpers, approval decision helpers, time-range evidence filters, invocation/approval/audit detail helpers, invocation/audit evidence helpers, and policy disable helpers.
- TypeScript SDK declaration file and strict type-check example for editor and integrator confidence.
- Local dependency install, environment doctor, host startup, smoke, demo, filterable JSON/CSV PoC evidence export including policy snapshots, Dify, MCP client, Python SDK, TypeScript SDK, Docker Compose config, and release gate scripts.
- Admin token local gate for verifying missing-token rejection, matching-token access, and the Web Console token path.
- Secret header local gate for verifying masked Tool responses and decrypted target calls.
- Focused PoC evidence export filters for invocation status, approval status, audit event/actor/resource, and policy action/enabled state.
- Release-friendly Web Console build configuration to keep verification output focused on actionable failures.

### Release Gates

- `npm run verify`
- `npm run install:local`
- `npm run doctor:local`
- `npm run dev:local`
- `npm run smoke:local`
- `npm run demo:local`
- `npm run evidence:local`
- `npm run dify:local`
- `npm run mcp-client:local`
- `npm run python-sdk:local`
- `npm run langchain:local`
- `npm run typescript-sdk:local`

### Known MVP Limits

- Admin authentication is a lightweight shared token, not SSO/RBAC.
- Tool credential encryption currently covers sensitive HTTP headers, not every possible connector secret type.
- MCP support is intentionally limited to `initialize`, `tools/list`, and `tools/call`.
- Approval is synchronous after an approver calls the approve endpoint; callback/webhook delivery is out of scope for MVP.
- Docker Compose is for server deployment validation, not local development.
