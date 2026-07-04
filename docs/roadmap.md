# Roadmap

ATG is currently at the `v0.1.0` open-source MVP stage.

The MVP goal is simple: prove that Agents can call real HTTP APIs through one independent gateway that applies identity, policy, approval, redaction, credential isolation, and audit logging.

This roadmap is directional and may change based on user feedback, security findings, and project priorities.

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

## Versioning Approach

ATG uses semantic versioning, but the project is still before public-core GA.

- `v0.2.0` through `v0.6.0` are pre-GA milestone releases. Each one should move one product area forward while keeping the core API understandable for early adopters.
- Patch releases, such as `v0.1.1` or `v0.2.1`, may be published when needed for install fixes, documentation fixes, demo reliability, small bug fixes, and compatibility improvements. They are not roadmap milestones.
- `v1.0.0` is the Public Core GA target, currently targeted after `v0.6.0` once the core governance loop, persistence behavior, evidence export, and single-server deployment story are stable enough to support normal production evaluation.
- Protocol and runtime exploration, such as A2A gatewaying or Go/Rust data-plane work, should not block `v1.0.0`. Those items belong in post-1.0 exploration unless user feedback shows a clear public-core need earlier.

## Edition Boundary

ATG has a public core and may also offer commercial or enterprise capabilities. The boundary should stay transparent.

Public core direction:

- Agent-to-HTTP-Tool governance gateway.
- Agent identity, Tool registry, policy decisions, approval, redaction, credential isolation, and audit logs.
- Web Console for the core governance loop.
- Docker Compose deployment for demos and single-server evaluation.
- REST, MCP, Dify, Python SDK, TypeScript SDK, and OpenAPI examples.
- Low-friction built-in policy engine.
- Core reliability improvements that keep the MVP safe and usable.

Commercial or enterprise direction:

- SSO/OIDC, enterprise RBAC/ABAC, teams, tenants, and organization controls.
- HA, production Kubernetes/Helm deployment support, backup, disaster recovery, and SLA-backed operations.
- Vault/KMS/SIEM/syslog/webhook integrations.
- Enterprise approval workflow integrations.
- Long-term audit retention, compliance reporting, and externally anchored audit evidence.
- OPA/Rego or Cedar adapters for enterprises that already standardize on external policy engines.
- A2A gateway governance and Agent-to-Agent delegation controls.
- mTLS, SPIFFE/SPIRE, short-lived delegation tokens, and zero-trust workload identity.
- Sandboxed execution for code, shell, browser, or untrusted plugin Tools.
- Go/Rust data-plane components for high-throughput proxying, sidecar deployment, or low-footprint enterprise runtimes.
- Private deployment help, proprietary embedding, OEM redistribution, supported enterprise builds, and commercial licensing.

Public examples or limited adapters may still be added when they help adoption, but production-grade versions of these capabilities are commercial/enterprise candidates:

- OPA/Rego or Cedar policy adapters.
- A2A gateway support and Agent-to-Agent delegation.
- mTLS, SPIFFE/SPIRE, and short-lived delegation tokens.
- Sandboxed execution for future code, shell, browser, or untrusted plugin Tools.
- Go/Rust data-plane components for high-throughput proxying or sidecar deployment.

## v0.2.0 Policy Clarity

Focus:

- Keep the built-in policy engine simple, but make policy behavior easier to understand and review.
- Policy composition semantics for the built-in engine so `deny`, `approve`, and `redact` can work together in one evaluation path.
- Clear policy hit explanations for admins.
- Policy preview improvements for explaining matched rules before execution.
- Regression tests for policy ordering, composition, and redaction interactions.

## v0.3.0 Persistence Reliability

Focus:

- Stronger database constraints for status and action fields.
- Real PostgreSQL integration tests for transactions, approval concurrency, status transitions, and audit consistency.
- Migration safety improvements for single-server deployments.
- Cleaner service-layer separation inside the server where it reduces operational risk.

## v0.4.0 Lightweight Team Controls

Focus:

- Lightweight users and teams.
- Basic roles such as Admin, Developer, and Approver.
- Web Console flows for assigning responsibility without introducing full enterprise IAM.
- Keep SSO/OIDC, ABAC, and multi-tenant organization controls in the commercial/enterprise track.

## v0.5.0 Evidence Export

Focus:

- Better audit export for customer reviews.
- Clearer evidence packages for invocations, approvals, audit logs, and policy snapshots.
- Tamper-evident audit groundwork, such as canonical event payloads and optional hash chaining.
- Keep long-term retention, compliance reporting, and externally anchored evidence in the commercial/enterprise track.

## v0.6.0 Deployment Hardening

Focus:

- More deployment guidance for production-like single-server setups.
- Optional basic Helm chart or Kubernetes example for evaluation environments.
- Clear upgrade, backup, restore, and secret-management guidance.
- Keep production HA, SLA-backed operations, and managed private deployment in the commercial/enterprise track.

## v1.0.0 Public Core GA

Focus:

- Declare the public core ready for general availability, not just developer preview.
- Stabilize the core REST, MCP, OpenAPI, Python SDK, and TypeScript SDK contracts for normal production evaluation.
- Document the compatibility policy for future `v1.x` releases, including how breaking changes will be handled.
- Validate the full governance path across Agent identity, Tool invocation, policy decisions, approval, redaction, credential isolation, evidence export, and audit logs.
- Make upgrade, backup, restore, and secret-management guidance clear enough for single-server public-core deployments.
- Keep enterprise IAM, multi-tenancy, HA/SLA operations, external KMS/Vault/SIEM, and managed private deployment in the commercial/enterprise track.

## v1.x Labs And Exploration

Focus:

- A2A (Agent2Agent) protocol exploration: proxy A2A-compatible agent endpoints through ATG so inter-agent tasks can reuse the same policy, approval, delegation, and audit path.
- Delegation context for Agent-to-Agent and Agent-to-Tool calls, including caller, subject, purpose, scope, expiry, and trace IDs.
- Go/Rust data-plane evaluation for high-throughput HTTP proxying, sidecar deployment, or low-footprint runtime scenarios.
- Keep production-grade A2A governance, zero-trust identity, sandboxing, and Go/Rust enterprise runtimes in the commercial/enterprise track unless user feedback shows a clear public-core need.

## Long-Term Direction

ATG should stay an independent governance gateway, not a plugin tied to one Agent framework.

The public core can remain AGPL-licensed to encourage adoption while requiring modified network-service versions to stay open. Organizations that need proprietary embedding, closed-source modified services, OEM terms, enterprise features, or supported private deployments can use a commercial license.

Longer-term work may include:

- SSO/OIDC.
- Advanced RBAC or ABAC.
- Multi-tenant workspaces.
- Workload identity and zero-trust deployment options, such as mTLS and SPIFFE/SPIRE.
- Short-lived delegation tokens for permission propagation across Agent-to-Agent and Agent-to-Tool flows.
- First-class A2A gateway support, including Agent Card discovery, task delegation governance, cross-agent traceability, and policy checks before one agent delegates work to another.
- Vault/KMS integrations.
- SIEM/syslog/webhook integrations.
- Kubernetes and Helm deployment.
- Sandboxed execution for future code, shell, browser, or untrusted plugin Tools.
- Tamper-evident or externally anchored audit chains for stronger compliance evidence.
- Optional Go/Rust runtime components for the performance-sensitive data plane, while keeping the control plane and Web Console developer-friendly.
- Enterprise approval workflows.
- Policy simulation and replay tools.
- Interoperability guidance for broader agent governance stacks, with ATG focused on the standalone enterprise API gateway layer.
