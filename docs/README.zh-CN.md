# Agent Tool Gateway

Agent Tool Gateway (ATG) 是一个开源的 Agent 工具调用治理网关，让 Dify、LangChain、MCP Client、SDK 和自研 Agent 在调用企业 HTTP API 之前，先经过统一的安全控制面。

ATG 提供：

- Agent API Key
- Tool Registry
- allow / deny / approve / redact 策略
- 审批流
- 响应脱敏
- 工具凭证隔离
- 调用与审计日志
- Web Console
- REST / MCP / SDK 接入

当前版本是 `v0.1.0` 开源 MVP，适合开发者预览、Demo、集成商 PoC 和早期开源试用。它不是企业生产版，暂不包含 SSO/RBAC、多租户、高可用、SIEM、Vault/KMS 等企业能力。

## Docker 启动

```bash
export SECRET_KEY=replace-with-a-long-random-secret-key
export ADMIN_TOKEN=replace-with-a-long-random-admin-token
docker compose up --build
```

默认地址：

- ATG API: `http://localhost:8080`
- Web Console: `http://localhost:5173`

## 本地开发

```bash
cp .env.example .env
npm run install:local
npm run doctor:local
npm run dev:local
```

PowerShell:

```powershell
Copy-Item .env.example .env
npm run install:local
npm run doctor:local
npm run dev:local
```

## 一键 Demo

本地环境：

```bash
npm run seed:demo:local
```

服务器 Docker 环境：

```bash
ATG_BASE_URL=http://<server>:8080 \
MOCK_BASE_URL=http://mock-api:9090 \
ADMIN_TOKEN=<admin-token> \
node scripts/seed-demo-data.mjs
```

Demo 会自动创建 Agent、三个 Tool 和三条策略，并验证：

- 大额退款需要审批
- CRM 查询结果会脱敏
- 危险删除操作会被拒绝

跑完后打开 Web Console，查看 Agents、Tools、Policies、Approvals、Invocations 和 Audit Logs。

## 更多

- 英文 README: [README.md](../README.md)
- 版本规划: [roadmap.md](./roadmap.md)

## 许可证

ATG 采用双授权模式：

- 核心公开版使用 GNU Affero General Public License v3.0 only (`AGPL-3.0-only`)。
- Python SDK、TypeScript SDK 和 examples 使用 MIT 许可证，方便集成和示例复用。
- 如果需要闭源嵌入、闭源修改版 SaaS / 托管服务、OEM 分发、企业功能、私有化部署或商业支持，请查看 [COMMERCIAL.md](../COMMERCIAL.md)。
