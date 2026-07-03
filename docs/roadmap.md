# Roadmap

ATG is currently at the `v0.1.0` open-source MVP stage.

The MVP goal is simple: prove that Agents can call real HTTP APIs through one independent gateway that applies identity, policy, approval, redaction, credential isolation, and audit logging.

## v0.1.0 MVP

Included:

- Agent registry and hashed Agent API keys.
- HTTP Tool registry and Tool invocation gateway.
- Policy actions: `allow`, `deny`, `approve`, and `redact`.
- Approval flow for high-risk calls.
- Redaction before returning and storing Tool responses.
- Sensitive Tool header encryption.
- Admin token protection for management APIs and Web Console.
- MCP `initialize`, `tools/list`, and `tools/call`.
- Dify example, MCP client example, Python SDK, LangChain adapter, and TypeScript SDK.
- Web Console for Agents, Tools, Policies, Approvals, Invocations, and Audit Logs.
- Docker Compose deployment with PostgreSQL, ATG Server, Mock API, and Web Console.
- Fast demo for approval, redaction, and denial flows.

Not included in v0.1.0:

- SSO/RBAC.
- Multi-tenancy.
- High availability.
- SIEM/Vault/KMS integrations.
- Enterprise approval system integrations.
- Full AgentOps or connector marketplace.

## v0.1.x Stabilization

Focus:

- Fix install, startup, Docker, and documentation issues reported by early users.
- Keep the public API stable for early PoCs.
- Improve error messages and release checks.
- Keep examples and SDKs aligned with the MVP API.

## v0.2.0 Policy And Reliability

Focus:

- Policy composition semantics so `deny`, `approve`, and `redact` can work together in one evaluation path.
- Clear policy hit explanations for admins.
- Stronger database constraints for status and action fields.
- Real PostgreSQL integration tests for transactions, approval concurrency, and audit consistency.
- Cleaner service-layer separation inside the server.

## v0.3.0 Lightweight Team Controls

Focus:

- Lightweight users and teams.
- Basic roles such as Admin, Developer, and Approver.
- Better audit export for customer reviews.
- Optional examples for Feishu, WeCom, DingTalk, or similar approval systems.
- More deployment guidance for production-like single-server setups.

## Long-Term Direction

ATG should stay an independent governance gateway, not a plugin tied to one Agent framework.

The public core can remain AGPL-licensed to encourage adoption while requiring modified network-service versions to stay open. Organizations that need proprietary embedding, closed-source modified services, OEM terms, enterprise features, or supported private deployments can use a commercial license.

Longer-term work may include:

- SSO/OIDC.
- Advanced RBAC or ABAC.
- Multi-tenant workspaces.
- Vault/KMS integrations.
- SIEM/syslog/webhook integrations.
- Kubernetes and Helm deployment.
- Enterprise approval workflows.
- Policy simulation and replay tools.
