# Contributing

Thanks for helping improve Agent Tool Gateway. The project is early, so the most useful contributions are focused, reproducible, and tied to the MVP gateway loop.

ATG uses an AGPL public edition with a commercial licensing path. By submitting a contribution, you agree to the contributor terms in [CLA.md](./CLA.md), including the right for the project owner to use and commercially relicense accepted contributions as part of ATG and related enterprise offerings.

## Good First Contributions

- Improve local setup and verification docs.
- Add or fix examples for Dify, MCP, Python, TypeScript, or custom HTTP Agents.
- Add focused tests for policy, approval, redaction, credentials, MCP, or audit behavior.
- Report installation or demo friction with exact commands and logs.

## Local Development

Run local services directly on the host; Docker Compose is for server deployment validation.

```bash
npm install
npm --prefix server install
npm --prefix examples/mock-api install
npm --prefix examples/mcp-client install
npm --prefix web install
npm --prefix server run migrate
npm run verify
```

For runtime gates, start PostgreSQL, ATG Server, Mock API, and then run:

```bash
npm run smoke:local
npm run demo:local
npm run dify:local
npm run mcp-client:local
npm run python-sdk:local
npm run typescript-sdk:local
```

If the server is started with `ADMIN_TOKEN`, set the same `ADMIN_TOKEN` before running local gates.

## Pull Request Checklist

- Keep the change focused on one behavior or documentation outcome.
- Add or update tests when behavior changes.
- Run `npm run verify`.
- Update README, Quick Start, release notes, or examples when user-facing behavior changes.
- Do not commit secrets, Agent API keys, admin tokens, or real business API credentials.

## Project Scope

The open-source MVP focuses on HTTP Tool governance for Dify, MCP, LangChain/Python, TypeScript/JavaScript, and custom Agents. SSO/RBAC, enterprise audit exports, high availability, enterprise workflow integrations, and advanced connector marketplaces are planned outside the first MVP and may be part of commercial offerings.
