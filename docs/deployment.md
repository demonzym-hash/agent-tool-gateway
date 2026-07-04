# Deployment Guide

This guide covers the public-core deployment path for early evaluation. It focuses on Docker Compose and production-like single-server setups. ATG stores application data in PostgreSQL; backup, restore, monitoring, and infrastructure operations should use the operator's standard PostgreSQL and platform tooling.

## Deployment Modes

### Docker Compose Evaluation

Use this when you want ATG Server, PostgreSQL, Mock API, and Web Console on one host:

```bash
export SECRET_KEY=replace-with-a-long-random-secret-key
export ADMIN_TOKEN=replace-with-a-long-random-admin-token
docker compose up --build
```

Default endpoints:

- ATG API: `http://localhost:8080`
- Web Console: `http://localhost:5173`

### External PostgreSQL

Use this when PostgreSQL is managed outside the ATG Compose stack:

```bash
export DATABASE_URL=postgres://<user>:<password>@<postgres-host>:5432/<database>
export SECRET_KEY=replace-with-a-long-random-secret-key
export ADMIN_TOKEN=replace-with-a-long-random-admin-token
```

Then start the server with your deployment supervisor, container platform, or process manager. Run the migration before serving traffic:

```bash
npm --prefix server run migrate
```

## Required Configuration

| Variable | Required for evaluation | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string used by ATG Server. |
| `SECRET_KEY` | Yes | Encrypts sensitive Tool headers before storage. Use a long random value. |
| `ADMIN_TOKEN` | Yes | Protects management APIs and the Web Console. |
| `PORT` | No | ATG Server port. Defaults to `8080`. |
| `WEB_PORT` | No | Host port for the Web Console in Docker Compose. Defaults to `5173`. |
| `LOG_LEVEL` | No | Server log level. Defaults to `info`. |

Production mode also requires `ADMIN_TOKEN` and `SECRET_KEY`; the server exits if either is missing.

## Tool Egress Controls

ATG can restrict outbound Tool calls:

| Variable | Default | Purpose |
|---|---|---|
| `TOOL_ALLOWED_HOSTS` | empty | Comma-separated hostname allowlist. Empty means no hostname allowlist. |
| `TOOL_ALLOW_HTTP` | `true` outside production, `false` in production | Allows plain HTTP Tool endpoints. |
| `TOOL_ALLOW_PRIVATE_NETWORK` | `true` outside production, `false` in production | Allows private-network Tool endpoints. |

For production-like evaluation, prefer explicit business API hostnames in `TOOL_ALLOWED_HOSTS`.

## Deployment Verification

After each server update, run the deployment readiness check from your workstation:

```bash
ATG_BASE_URL=http://<server>:8080 \
MOCK_TOOL_ENDPOINT=http://<mock-api>/mock/refund_order \
ADMIN_TOKEN=<admin-token> \
npm run deployment:check
```

The check creates temporary review records in the target ATG environment and verifies:

- Health check.
- Admin token gate.
- Agent, Tool, and Policy creation.
- Approval-required invocation.
- Approval execution.
- Invocation, Approval, and Audit detail reads.
- Evidence Export counts and SHA-256 hashes.

If you do not want test records in a shared environment, run the check against a fresh evaluation database.

## Evidence Export Check

After important demos or PoCs, export a review package:

```bash
ATG_BASE_URL=http://<server>:8080 \
ADMIN_TOKEN=<admin-token> \
npm run evidence:local -- --limit 100
```

The export includes invocations, approvals, audit logs, policy snapshots, counts, and dataset hashes. Tool responses in invocation evidence are already redacted by ATG before export.

## Operator Responsibilities

ATG does not provide built-in PostgreSQL backup or restore automation in the public-core MVP. Operators should use their normal database platform tooling for:

- PostgreSQL backup and restore.
- Disk, CPU, memory, and database monitoring.
- TLS termination and network access control.
- Log collection and retention.
- Disaster recovery.

These are deployment responsibilities rather than ATG application features at this stage.
