# Agent Tool Gateway

Agent Tool Gateway (ATG) は、AI Agent が企業 HTTP API を安全に呼び出すためのオープンソース・ゲートウェイです。

Dify、LangChain、MCP Client、SDK、独自 Agent からの Tool 呼び出しを ATG に集約し、実際の業務 API に到達する前に認証、ポリシー判定、承認、マスキング、認証情報の分離、監査ログを適用します。

ATG が提供するもの:

- Agent API Key
- Tool Registry
- allow / deny / approve / redact ポリシー
- 承認フロー
- レスポンスのマスキング
- Tool 認証情報の分離
- 呼び出しログと監査ログ
- Web Console
- REST / MCP / SDK 連携

現在の `v0.1.0` はオープンソース MVP です。開発者プレビュー、デモ、インテグレーター PoC、早期検証に向いています。SSO/RBAC、マルチテナント、高可用性、SIEM、Vault/KMS などを含むエンタープライズ本番版ではありません。

## Docker で起動

```bash
export SECRET_KEY=replace-with-a-long-random-secret-key
export ADMIN_TOKEN=replace-with-a-long-random-admin-token
docker compose up --build
```

デフォルト URL:

- ATG API: `http://localhost:8080`
- Web Console: `http://localhost:5173`

## ローカル開発

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

## クイック Demo

ローカル環境:

```bash
npm run seed:demo:local
```

Docker サーバー環境:

```bash
ATG_BASE_URL=http://<server>:8080 \
MOCK_BASE_URL=http://mock-api:9090 \
ADMIN_TOKEN=<admin-token> \
node scripts/seed-demo-data.mjs
```

この Demo は Agent、3 つの Tool、3 つのポリシーを作成し、次の流れを検証します。

- 高額返金は承認が必要
- CRM 検索結果はマスキングされる
- 危険な削除操作は拒否される

完了後、Web Console で Agents、Tools、Policies、Approvals、Invocations、Audit Logs を確認できます。

## Links

- English README: [README.md](../README.md)
- Roadmap: [roadmap.md](./roadmap.md)

## License

ATG はデュアルライセンスモデルです。

- コア公開版は GNU Affero General Public License v3.0 only (`AGPL-3.0-only`) です。
- Python SDK、TypeScript SDK、examples は統合しやすいように MIT ライセンスです。
- クローズドソースでの組み込み、改変版 SaaS / managed service、OEM 配布、エンタープライズ機能、プライベートデプロイ、商用サポートが必要な場合は [COMMERCIAL.md](../COMMERCIAL.md) を参照してください。
