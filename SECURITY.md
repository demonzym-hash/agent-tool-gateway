# Security Policy

Agent Tool Gateway sits in front of real business APIs, so security reports are welcome even during MVP development.

## Supported Versions

| Version | Supported |
|---|---|
| `0.1.x` | Yes |

## Reporting A Vulnerability

Please do not open a public issue for vulnerabilities that could expose credentials, bypass approval/policy checks, or leak sensitive audit data.

Use one of these paths:

- If this repository has private vulnerability reporting enabled, use GitHub Security Advisories.
- Otherwise, contact the maintainer privately through the project owner profile or your existing project communication channel.

Include:

- Affected version or commit.
- Exact reproduction steps.
- Whether the issue requires `ADMIN_TOKEN`, Agent API key, or Tool credentials.
- Expected impact, such as policy bypass, credential exposure, redaction failure, or audit tampering.

## Security Expectations For Deployments

- Set `SECRET_KEY` for server deployments.
- Set `ADMIN_TOKEN` to protect management APIs and the Web Console.
- Store Agent API keys only in trusted Agent platforms.
- Register real business API credentials as Tool headers so ATG can encrypt sensitive header values.
- Keep PostgreSQL private to the deployment network.
