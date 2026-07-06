import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  ConfigProvider,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Layout,
  message,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Steps,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  ApiOutlined,
  AuditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  KeyOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  ToolOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";

const { Header, Content } = Layout;
const { Text, Title } = Typography;
const adminTokenStorageKey = "atg_admin_token";
const languageStorageKey = "atg_console_language";

const zhText = {
  "ATG Console": "ATG 控制台",
  "Agent Tool Gateway": "Agent Tool Gateway",
  "Admin Token": "管理令牌",
  "Paste server ADMIN_TOKEN": "输入服务器 ADMIN_TOKEN",
  Enter: "进入",
  "Local mode": "本地模式",
  "Admin token": "管理令牌",
  server: "服务",
  Refresh: "刷新",
  Lock: "锁定",
  Agents: "Agent",
  "Active Tools": "活跃工具",
  "Audit Events": "审计事件",
  Agent: "Agent",
  Tool: "工具",
  "Disabled": "禁用",
  "Pending Approvals": "待审批",
  "Success Calls": "成功调用",
  "Avg Latency": "平均延迟",
  success: "成功",
  failed: "失败",
  denied: "拒绝",
  pending: "待处理",
  "pending_approval": "待审批",
  active: "启用",
  disabled: "禁用",
  allow: "允许",
  deny: "拒绝",
  approve: "审批",
  redact: "脱敏",
  approved: "已批准",
  rejected: "已拒绝",
  "One-time API key": "一次性 API Key",
  "Create Agent": "创建 Agent",
  "Agent List": "Agent 列表",
  Name: "名称",
  Owner: "负责人",
  Source: "来源",
  Description: "描述",
  Status: "状态",
  Created: "创建时间",
  Updated: "更新时间",
  Actions: "操作",
  Rotate: "轮换",
  Disable: "禁用",
  Details: "详情",
  Test: "测试",
  Invoke: "调用",
  Approve: "批准",
  Reject: "拒绝",
  "Disable this agent?": "确认禁用这个 Agent？",
  "Disable this tool?": "确认禁用这个工具？",
  "Delete this tool?": "确认删除这个工具？",
  "Disable this policy?": "确认禁用这条策略？",
  "Reject this approval?": "确认拒绝这条审批？",
  "Agent created": "Agent 已创建",
  "Agent key rotated": "Agent Key 已轮换",
  "Agent disabled": "Agent 已禁用",
  "Tool created": "工具已创建",
  "Tool disabled": "工具已禁用",
  "Tool deleted": "工具已删除",
  "Policy created": "策略已创建",
  "Policy disabled": "策略已禁用",
  "Paste an agent API key first": "请先输入 Agent API Key",
  "Approval executed": "审批已执行",
  "Approval rejected": "审批已拒绝",
  Tools: "工具",
  "Create HTTP Tool": "创建 HTTP 工具",
  "Tool List": "工具列表",
  Method: "方法",
  Risk: "风险",
  Endpoint: "端点",
  Timeout: "超时",
  "Headers JSON": "请求头 JSON",
  "Authorization and API-key headers are stored encrypted": "Authorization 和 API Key 请求头会加密存储",
  "Input Schema JSON": "输入 Schema JSON",
  "Output Schema JSON": "输出 Schema JSON",
  "Create Tool": "创建工具",
  "Agent API key for invoke": "用于调用的 Agent API Key",
  Audit: "审计",
  Event: "事件",
  Actor: "操作者",
  Resource: "资源",
  Latency: "延迟",
  Approver: "审批人",
  "Invocation status": "调用状态",
  "Audit event": "审计事件",
  "Audit actor": "审计操作者",
  "Audit resource": "审计资源",
  "Approval status": "审批状态",
  Apply: "应用",
  Reset: "重置",
  Approvals: "审批",
  Invocations: "调用记录",
  "Audit Logs": "审计日志",
  Policies: "策略",
  "Create Policy": "创建策略",
  Action: "动作",
  Priority: "优先级",
  "Condition JSON": "条件 JSON",
  "Scope JSON": "范围 JSON",
  "Use scope.redaction for custom redact fields or regex patterns.": "使用 scope.redaction 配置自定义脱敏字段或正则规则。",
  "Preview Policy": "预览策略",
  "Input JSON": "输入 JSON",
  "Preview Decision": "预览决策",
  "Policy List": "策略列表",
  Enabled: "启用",
  "Tool Test Result": "工具测试结果",
  HTTP: "HTTP",
  "Invocation Result": "调用结果",
  Invocation: "调用",
  "Policy Preview": "策略预览",
  Decision: "决策",
  "Matched Policy": "命中策略",
  Reason: "原因",
  "Matched Policies": "命中策略数",
  "Redaction Policies": "脱敏策略数",
  Explanation: "解释",
  "Approval Details": "审批详情",
  ID: "ID",
  Comment: "备注",
  "Policy Details": "策略详情",
  Condition: "条件",
  Scope: "范围",
  "Invocation Details": "调用详情",
  Approval: "审批",
  Error: "错误",
  Request: "请求",
  "Redacted Response": "脱敏响应",
  "Policy Decision": "策略决策",
  "Decision Trace": "决策跟踪",
  "No decision trace": "暂无决策跟踪",
  "Selected Policy": "选中策略",
  "Action Counts": "动作统计",
  "Policy IDs": "策略 ID",
  Overview: "概览",
  Evidence: "证据",
  "Raw JSON": "原始 JSON",
  Payload: "载荷",
  match: "匹配",
  precedence: "优先级",
  redaction: "脱敏",
  decision: "决策",
  matched: "已命中",
  no_match: "未命中",
  apply: "应用",
  "Audit Log Details": "审计日志详情",
  Language: "语言",
  Chinese: "中文",
  English: "English",
  "Import OpenAPI": "导入 OpenAPI",
  "OpenAPI Source": "OpenAPI 来源",
  URL: "URL",
  File: "文件",
  Paste: "粘贴",
  "OpenAPI URL": "OpenAPI URL",
  "Base URL override": "Base URL 覆盖",
  "OpenAPI Content": "OpenAPI 内容",
  "Upload OpenAPI file": "上传 OpenAPI 文件",
  "Preview Operations": "预览接口",
  Review: "检查",
  Results: "结果",
  Change: "修改",
  Operation: "接口",
  "Create Imported Tool": "创建导入的工具",
  "Imported Tool Preview": "导入工具预览",
  Operations: "接口",
  Warnings: "提示",
  "OpenAPI parsed": "OpenAPI 已解析",
  "OpenAPI file loaded": "OpenAPI 文件已读取",
  "Import Selected": "导入选中项",
  "Import Results": "导入结果",
  "Selected Operations": "已选接口",
  "Select operations first": "请先选择要导入的接口",
  "Batch Defaults": "批量默认值",
  "Import Settings": "导入设置",
  "Selected": "已选",
  "Warning Count": "提示数",
  "Tool Preview": "工具预览",
  "Advanced Edit": "高级编辑",
  "Done": "完成",
  "Import More": "继续导入",
  "Test Tool": "测试工具",
  "Test Input JSON": "测试输入 JSON",
  "Run Test": "运行测试",
  "Sample Input": "示例输入",
  "Export Evidence": "导出证据",
  "Evidence exported": "证据已导出",
};

function translate(language, text) {
  return language === "zh" ? zhText[text] || text : text;
}

const samplePayload = {
  order_id: "ord_demo",
  amount: 25,
  reason: "week_1_demo",
};

async function api(path, options = {}) {
  const { headers, ...rest } = options;
  const adminToken = localStorage.getItem(adminTokenStorageKey) || "";
  const response = await fetch(path, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(adminToken ? { "x-admin-token": adminToken } : {}),
      ...(headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || response.statusText;
    const error = new Error(detail);
    error.status = response.status;
    error.code = data?.error?.code;
    error.details = data?.error?.details;
    throw error;
  }
  return data;
}

function JsonBlock({ value }) {
  return <pre className="json-block">{JSON.stringify(value ?? {}, null, 2)}</pre>;
}

function sampleValueForSchema(schema = {}, key = "value") {
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.example !== undefined) return schema.example;
  if (schema.type === "number" || schema.type === "integer") return schema.minimum ?? 1;
  if (schema.type === "boolean") return true;
  if (schema.type === "array") return [sampleValueForSchema(schema.items || {}, key)];
  if (schema.type === "object") return sampleInputFromSchema(schema);
  if (key.toLowerCase().includes("amount")) return 25;
  if (key.toLowerCase().includes("id")) return `${key}_demo`;
  return "demo";
}

function sampleInputFromSchema(schema = {}) {
  if (!schema || schema.type !== "object" || !schema.properties) return samplePayload;
  const keys = schema.required?.length ? schema.required : Object.keys(schema.properties).slice(0, 4);
  return keys.reduce((input, key) => {
    input[key] = sampleValueForSchema(schema.properties[key] || {}, key);
    return input;
  }, {});
}

function StatusTag({ status, t = (value) => value }) {
  const color = status === "active" || status === "success" ? "green" : status === "failed" ? "red" : "default";
  return <Tag color={color}>{t(status)}</Tag>;
}

function traceColor(outcome) {
  if (outcome === "deny" || outcome === "no_match") return "red";
  if (outcome === "approve") return "gold";
  if (outcome === "apply" || outcome === "matched" || outcome === "allow" || outcome === "redact") return "green";
  return "default";
}

function formatActionCounts(counts = {}, t = (value) => value) {
  return ["deny", "approve", "allow", "redact"]
    .filter((action) => counts[action])
    .map((action) => `${t(action)}: ${counts[action]}`)
    .join(", ");
}

function DecisionTrace({ trace, t }) {
  if (!Array.isArray(trace) || !trace.length) {
    return <Text type="secondary">{t("No decision trace")}</Text>;
  }

  return (
    <div className="decision-trace">
      {trace.map((step, index) => (
        <div className="decision-trace-step" key={`${step.step || "step"}-${index}`}>
          <div className="decision-trace-marker">{index + 1}</div>
          <div className="decision-trace-body">
            <Space wrap size={8}>
              <Text strong>{t(step.step || "decision")}</Text>
              {step.outcome ? <Tag color={traceColor(step.outcome)}>{t(step.outcome)}</Tag> : null}
              {step.matched_policy_count != null ? (
                <Tag>
                  {t("Matched Policies")}: {step.matched_policy_count}
                </Tag>
              ) : null}
            </Space>
            {step.message ? <div className="decision-trace-message">{step.message}</div> : null}
            {step.selected_policy_name || step.selected_policy_id ? (
              <div className="decision-trace-meta">
                <Text type="secondary">
                  {t("Selected Policy")}: {step.selected_policy_name || step.selected_policy_id}
                </Text>
              </div>
            ) : null}
            {step.action_counts ? (
              <div className="decision-trace-meta">
                <Text type="secondary">
                  {t("Action Counts")}: {formatActionCounts(step.action_counts, t) || "-"}
                </Text>
              </div>
            ) : null}
            {Array.isArray(step.policy_ids) && step.policy_ids.length ? (
              <div className="decision-trace-meta">
                <Text type="secondary">
                  {t("Policy IDs")}: {step.policy_ids.join(", ")}
                </Text>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [agents, setAgents] = useState([]);
  const [tools, setTools] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [invocations, setInvocations] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [health, setHealth] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [oneTimeKey, setOneTimeKey] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testToolTarget, setTestToolTarget] = useState(null);
  const [testToolRunning, setTestToolRunning] = useState(false);
  const [invokeResult, setInvokeResult] = useState(null);
  const [policyPreviewResult, setPolicyPreviewResult] = useState(null);
  const [invokeKey, setInvokeKey] = useState("");
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(adminTokenStorageKey) || "");
  const [language, setLanguage] = useState(() => localStorage.getItem(languageStorageKey) || "zh");
  const [accessGranted, setAccessGranted] = useState(() => localStorage.getItem("atg_console_access") === "granted");
  const [logFilters, setLogFilters] = useState({
    invocation_agent_id: "",
    invocation_tool_id: "",
    invocation_status: "",
    approval_status: "",
    audit_event_type: "",
    audit_actor_type: "",
    audit_resource_type: "",
    from: "",
    to: "",
    limit: 100,
  });
  const [policyFilters, setPolicyFilters] = useState({
    action: "",
    enabled: "",
  });
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [selectedInvocation, setSelectedInvocation] = useState(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [openApiImportOpen, setOpenApiImportOpen] = useState(false);
  const [openApiImportStep, setOpenApiImportStep] = useState(0);
  const [openApiSourceType, setOpenApiSourceType] = useState("url");
  const [openApiImportLoading, setOpenApiImportLoading] = useState(false);
  const [openApiPreview, setOpenApiPreview] = useState(null);
  const [openApiImportSource, setOpenApiImportSource] = useState(null);
  const [selectedOpenApiOperation, setSelectedOpenApiOperation] = useState("");
  const [selectedOpenApiOperations, setSelectedOpenApiOperations] = useState([]);
  const [openApiImportResults, setOpenApiImportResults] = useState(null);
  const [agentForm] = Form.useForm();
  const [toolForm] = Form.useForm();
  const [openApiForm] = Form.useForm();
  const [openApiToolForm] = Form.useForm();
  const [openApiBatchForm] = Form.useForm();
  const [toolTestForm] = Form.useForm();
  const [policyForm] = Form.useForm();
  const [policyPreviewForm] = Form.useForm();
  const t = useMemo(() => (text) => translate(language, text), [language]);
  const antdLocale = language === "zh" ? zhCN : enUS;

  const activeTools = useMemo(() => tools.filter((tool) => tool.status === "active"), [tools]);
  const agentOptions = useMemo(() => agents.map((agent) => ({ value: agent.id, label: agent.name })), [agents]);
  const toolOptions = useMemo(() => tools.map((tool) => ({ value: tool.id, label: tool.name })), [tools]);
  const selectedOpenApiOperationDetail = useMemo(
    () => openApiPreview?.operations?.find((operation) => operation.operation_key === selectedOpenApiOperation) || null,
    [openApiPreview, selectedOpenApiOperation],
  );
  const openApiWarningCount = useMemo(
    () => (openApiPreview?.operations || []).reduce((total, operation) => total + (operation.warnings?.length || 0), 0),
    [openApiPreview],
  );
  const openApiCreatedCount = useMemo(
    () => (openApiImportResults || []).filter((result) => result.status === "created").length,
    [openApiImportResults],
  );
  const dashboardStats = useMemo(() => {
    const byStatus = invocations.reduce((acc, invocation) => {
      acc[invocation.status] = (acc[invocation.status] || 0) + 1;
      return acc;
    }, {});
    const latencies = invocations.map((invocation) => Number(invocation.latency_ms || 0)).filter((latency) => latency > 0);
    const averageLatency = latencies.length
      ? Math.round(latencies.reduce((total, latency) => total + latency, 0) / latencies.length)
      : 0;
    return {
      pendingApprovals: approvals.filter((approval) => approval.status === "pending").length,
      successfulInvocations: byStatus.success || 0,
      failedInvocations: byStatus.failed || 0,
      deniedInvocations: byStatus.denied || 0,
      pendingInvocations: byStatus.pending_approval || 0,
      averageLatency,
    };
  }, [approvals, invocations]);

  function logQuery(path) {
    const params = new URLSearchParams();
    if (logFilters.limit) params.set("limit", String(logFilters.limit));
    if (path.includes("invocations") && logFilters.invocation_status) {
      params.set("status", logFilters.invocation_status);
    }
    if (path.includes("invocations") && logFilters.invocation_agent_id) {
      params.set("agent_id", logFilters.invocation_agent_id);
    }
    if (path.includes("invocations") && logFilters.invocation_tool_id) {
      params.set("tool_id", logFilters.invocation_tool_id);
    }
    if (path.includes("audit-logs") && logFilters.audit_event_type) {
      params.set("event_type", logFilters.audit_event_type);
    }
    if (path.includes("audit-logs") && logFilters.audit_actor_type) {
      params.set("actor_type", logFilters.audit_actor_type);
    }
    if (path.includes("audit-logs") && logFilters.audit_resource_type) {
      params.set("resource_type", logFilters.audit_resource_type);
    }
    if (path.includes("approvals") && logFilters.approval_status) {
      params.set("status", logFilters.approval_status);
    }
    if (logFilters.from) {
      params.set("from", new Date(logFilters.from).toISOString());
    }
    if (logFilters.to) {
      params.set("to", new Date(logFilters.to).toISOString());
    }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  function evidenceQuery() {
    const params = new URLSearchParams();
    if (logFilters.limit) params.set("limit", String(logFilters.limit));
    if (logFilters.invocation_agent_id) params.set("invocation_agent_id", logFilters.invocation_agent_id);
    if (logFilters.invocation_tool_id) params.set("invocation_tool_id", logFilters.invocation_tool_id);
    if (logFilters.invocation_status) params.set("invocation_status", logFilters.invocation_status);
    if (logFilters.approval_status) params.set("approval_status", logFilters.approval_status);
    if (logFilters.audit_event_type) params.set("audit_event_type", logFilters.audit_event_type);
    if (logFilters.audit_actor_type) params.set("audit_actor_type", logFilters.audit_actor_type);
    if (logFilters.audit_resource_type) params.set("audit_resource_type", logFilters.audit_resource_type);
    if (logFilters.from) params.set("from", new Date(logFilters.from).toISOString());
    if (logFilters.to) params.set("to", new Date(logFilters.to).toISOString());
    if (policyFilters.action) params.set("policy_action", policyFilters.action);
    if (policyFilters.enabled) params.set("policy_enabled", policyFilters.enabled);
    const query = params.toString();
    return query ? `/api/v1/evidence/export?${query}` : "/api/v1/evidence/export";
  }

  function resetLogFilters() {
    setLogFilters({
      invocation_agent_id: "",
      invocation_tool_id: "",
      invocation_status: "",
      approval_status: "",
      audit_event_type: "",
      audit_actor_type: "",
      audit_resource_type: "",
      from: "",
      to: "",
      limit: 100,
    });
  }

  function policyQuery(path) {
    const params = new URLSearchParams();
    if (policyFilters.action) params.set("action", policyFilters.action);
    if (policyFilters.enabled) params.set("enabled", policyFilters.enabled);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  function resetPolicyFilters() {
    setPolicyFilters({ action: "", enabled: "" });
  }

  async function refresh() {
    setLoading(true);
    try {
      const [healthData, agentData, toolData, policyData, approvalData, auditData, invocationData] = await Promise.all([
        api("/healthz").catch(() => ({ status: "down" })),
        api("/api/v1/agents"),
        api("/api/v1/tools"),
        api(policyQuery("/api/v1/policies")),
        api(logQuery("/api/v1/approvals")),
        api(logQuery("/api/v1/audit-logs")),
        api(logQuery("/api/v1/invocations")),
      ]);
      setHealth(healthData.status);
      setAgents(agentData.agents || []);
      setTools(toolData.tools || []);
      setPolicies(policyData.policies || []);
      setApprovals(approvalData.approvals || []);
      setAuditLogs(auditData.audit_logs || []);
      setInvocations(invocationData.invocations || []);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  function saveAdminToken(value) {
    setAdminToken(value);
    if (value) {
      localStorage.setItem(adminTokenStorageKey, value);
    } else {
      localStorage.removeItem(adminTokenStorageKey);
    }
  }

  function saveLanguage(value) {
    localStorage.setItem(languageStorageKey, value);
    setLanguage(value);
  }

  function enterConsole({ localMode = false } = {}) {
    if (localMode) {
      saveAdminToken("");
    } else {
      saveAdminToken(adminToken.trim());
    }
    localStorage.setItem("atg_console_access", "granted");
    setAccessGranted(true);
    refresh();
  }

  function lockConsole() {
    localStorage.removeItem("atg_console_access");
    setAccessGranted(false);
  }

  useEffect(() => {
    if (accessGranted) {
      refresh();
    }
  }, [accessGranted]);

  async function createAgent(values) {
    try {
      const data = await api("/api/v1/agents", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setOneTimeKey(data.api_key);
      setInvokeKey(data.api_key);
      agentForm.resetFields();
      message.success(t("Agent created"));
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  async function rotateAgentKey(agent) {
    try {
      const data = await api(`/api/v1/agents/${agent.id}/rotate-key`, {
        method: "POST",
      });
      setOneTimeKey(data.api_key);
      setInvokeKey(data.api_key);
      message.success(t("Agent key rotated"));
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  async function disableAgent(agent) {
    try {
      await api(`/api/v1/agents/${agent.id}/disable`, {
        method: "POST",
      });
      message.success(t("Agent disabled"));
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  async function createTool(values) {
    try {
      await api("/api/v1/tools", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          headers: values.headers ? JSON.parse(values.headers) : {},
          input_schema: values.input_schema ? JSON.parse(values.input_schema) : {},
          output_schema: values.output_schema ? JSON.parse(values.output_schema) : {},
        }),
      });
      toolForm.resetFields();
      message.success(t("Tool created"));
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  function fillOpenApiToolForm(operation) {
    if (!operation?.tool) {
      openApiToolForm.resetFields();
      return;
    }
    openApiToolForm.setFieldsValue({
      ...operation.tool,
      headers: JSON.stringify(operation.tool.headers || {}, null, 2),
      input_schema: JSON.stringify(operation.tool.input_schema || {}, null, 2),
      output_schema: JSON.stringify(operation.tool.output_schema || {}, null, 2),
    });
  }

  function resetOpenApiImport() {
    setOpenApiImportStep(0);
    setOpenApiSourceType("url");
    setOpenApiPreview(null);
    setOpenApiImportSource(null);
    setSelectedOpenApiOperation("");
    setSelectedOpenApiOperations([]);
    setOpenApiImportResults(null);
    openApiForm.resetFields();
    openApiToolForm.resetFields();
    openApiBatchForm.resetFields();
  }

  function openOpenApiImport() {
    resetOpenApiImport();
    setOpenApiImportOpen(true);
  }

  function closeOpenApiImport() {
    setOpenApiImportOpen(false);
    resetOpenApiImport();
  }

  async function previewOpenApiImport(values) {
    try {
      setOpenApiImportLoading(true);
      const source = {
        source_type: values.source_type,
        url: values.url,
        content: values.content,
        base_url: values.base_url || "",
      };
      const data = await api("/api/v1/openapi/import/preview", {
        method: "POST",
        body: JSON.stringify(source),
      });
      setOpenApiImportSource(source);
      setOpenApiPreview(data);
      const firstOperation = data.operations?.[0] || null;
      setSelectedOpenApiOperation(firstOperation?.operation_key || "");
      setSelectedOpenApiOperations(firstOperation?.operation_key ? [firstOperation.operation_key] : []);
      setOpenApiImportResults(null);
      fillOpenApiToolForm(firstOperation);
      setOpenApiImportStep(1);
      message.success(t("OpenAPI parsed"));
    } catch (error) {
      message.error(error.message);
    } finally {
      setOpenApiImportLoading(false);
    }
  }

  async function createImportedOpenApiTool(values) {
    try {
      await api("/api/v1/tools", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          timeout_ms: Number(values.timeout_ms),
          headers: values.headers ? JSON.parse(values.headers) : {},
          input_schema: values.input_schema ? JSON.parse(values.input_schema) : {},
          output_schema: values.output_schema ? JSON.parse(values.output_schema) : {},
        }),
      });
      message.success(t("Tool created"));
      setOpenApiImportOpen(false);
      setOpenApiPreview(null);
      setSelectedOpenApiOperation("");
      setSelectedOpenApiOperations([]);
      setOpenApiImportResults(null);
      openApiForm.resetFields();
      openApiToolForm.resetFields();
      openApiBatchForm.resetFields();
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  async function importSelectedOpenApiTools(values) {
    if (!selectedOpenApiOperations.length) {
      message.warning(t("Select operations first"));
      return;
    }
    try {
      const data = await api("/api/v1/openapi/import/tools", {
        method: "POST",
        body: JSON.stringify({
          ...(openApiImportSource || openApiForm.getFieldsValue()),
          defaults: {
            owner: values.owner || "",
            risk_level: values.risk_level || undefined,
            timeout_ms: values.timeout_ms ? Number(values.timeout_ms) : undefined,
            headers: values.headers ? JSON.parse(values.headers) : {},
          },
          operations: selectedOpenApiOperations.map((operation_key) => ({ operation_key })),
        }),
      });
      setOpenApiImportResults(data.results || []);
      const createdCount = (data.results || []).filter((result) => result.status === "created").length;
      message.success(`${createdCount}/${selectedOpenApiOperations.length} ${t("Import Results")}`);
      setOpenApiImportStep(2);
      await refresh();
    } catch (error) {
      message.error(error.message);
      setOpenApiImportResults([
        {
          operation_key: selectedOpenApiOperations.join(", "),
          status: "failed",
          error: {
            code: error.code || "import_failed",
            message: error.message,
            details: error.details,
          },
        },
      ]);
      setOpenApiImportStep(2);
    }
  }

  async function createPolicy(values) {
    try {
      await api("/api/v1/policies", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          priority: Number(values.priority),
          condition_json: values.condition_json ? JSON.parse(values.condition_json) : {},
          scope: values.scope ? JSON.parse(values.scope) : {},
          enabled: true,
        }),
      });
      policyForm.resetFields();
      message.success(t("Policy created"));
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  async function previewPolicy(values) {
    try {
      const data = await api("/api/v1/policies/evaluate", {
        method: "POST",
        body: JSON.stringify({
          agent_id: values.agent_id,
          tool_id: values.tool_id,
          input: values.input ? JSON.parse(values.input) : {},
        }),
      });
      setPolicyPreviewResult(data);
    } catch (error) {
      message.error(error.message);
    }
  }

  async function disablePolicy(policy) {
    try {
      await api(`/api/v1/policies/${policy.id}/disable`, {
        method: "POST",
      });
      message.success(t("Policy disabled"));
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  function openToolTest(tool) {
    setTestToolTarget(tool);
    setTestResult(null);
    toolTestForm.setFieldsValue({
      input: JSON.stringify(sampleInputFromSchema(tool.input_schema), null, 2),
    });
  }

  async function testTool(values) {
    if (!testToolTarget) return;
    try {
      setTestToolRunning(true);
      const data = await api(`/api/v1/tools/${testToolTarget.id}/test`, {
        method: "POST",
        body: JSON.stringify(values.input ? JSON.parse(values.input) : {}),
      });
      setTestResult({ tool: testToolTarget.name, ...data });
    } catch (error) {
      setTestResult({
        tool: testToolTarget.name,
        status: "failed",
        http_status: error.status || 0,
        data: {
          code: error.code || "request_failed",
          message: error.message,
          details: error.details,
        },
      });
    } finally {
      setTestToolRunning(false);
    }
  }

  async function disableTool(tool) {
    try {
      await api(`/api/v1/tools/${tool.id}/disable`, {
        method: "POST",
      });
      message.success(t("Tool disabled"));
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  async function invokeTool(tool) {
    if (!invokeKey) {
      message.warning(t("Paste an agent API key first"));
      return;
    }
    try {
      const data = await api(`/api/v1/invoke/${tool.name}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${invokeKey}`,
        },
        body: JSON.stringify(samplePayload),
      });
      setInvokeResult({ tool: tool.name, ...data });
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  async function decideApproval(approval, action) {
    try {
      const data = await api(`/api/v1/approvals/${approval.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({
          approver: "local-approver",
          comment: action === "approve" ? "Approved from console" : "Rejected from console",
        }),
      });
      setInvokeResult({ tool: "approval", ...data });
      message.success(action === "approve" ? t("Approval executed") : t("Approval rejected"));
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  async function openApprovalDetails(approval) {
    try {
      const data = await api(`/api/v1/approvals/${approval.id}`, { method: "GET" });
      setSelectedApproval(data.approval);
    } catch (error) {
      message.error(error.message);
    }
  }

  async function openInvocationDetails(invocation) {
    try {
      const data = await api(`/api/v1/invocations/${invocation.id}`, { method: "GET" });
      setSelectedInvocation(data.invocation);
    } catch (error) {
      message.error(error.message);
    }
  }

  async function openAuditLogDetails(auditLog) {
    try {
      const data = await api(`/api/v1/audit-logs/${auditLog.id}`, { method: "GET" });
      setSelectedAuditLog(data.audit_log);
    } catch (error) {
      message.error(error.message);
    }
  }

  async function openPolicyDetails(policy) {
    try {
      const data = await api(`/api/v1/policies/${policy.id}`, { method: "GET" });
      setSelectedPolicy(data.policy);
    } catch (error) {
      message.error(error.message);
    }
  }

  async function deleteTool(tool) {
    try {
      await api(`/api/v1/tools/${tool.id}`, {
        method: "DELETE",
      });
      message.success(t("Tool deleted"));
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  async function downloadEvidence() {
    try {
      const data = await api(evidenceQuery());
      const generatedAt = data.evidence?.manifest?.generated_at || new Date().toISOString();
      const fileName = `atg-evidence-${generatedAt.replace(/[:.]/g, "-")}.json`;
      const blob = new Blob([`${JSON.stringify(data.evidence, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      message.success(t("Evidence exported"));
    } catch (error) {
      message.error(error.message);
    }
  }

  const agentColumns = [
    { title: t("Name"), dataIndex: "name" },
    { title: t("Owner"), dataIndex: "owner" },
    { title: t("Source"), dataIndex: "source_type" },
    { title: t("Status"), dataIndex: "status", render: (value) => <StatusTag status={value} t={t} /> },
    { title: t("Created"), dataIndex: "created_at", render: (value) => new Date(value).toLocaleString() },
    {
      title: t("Actions"),
      width: 210,
      render: (_, agent) => (
        <Space>
          <Button icon={<SyncOutlined />} disabled={agent.status !== "active"} onClick={() => rotateAgentKey(agent)}>
            {t("Rotate")}
          </Button>
          <Popconfirm
            title={t("Disable this agent?")}
            okText={t("Disable")}
            okButtonProps={{ danger: true }}
            onConfirm={() => disableAgent(agent)}
            disabled={agent.status !== "active"}
          >
            <Button danger icon={<DeleteOutlined />} disabled={agent.status !== "active"}>
              {t("Disable")}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const toolColumns = [
    { title: t("Name"), dataIndex: "name" },
    { title: t("Method"), dataIndex: "method", width: 90 },
    { title: t("Risk"), dataIndex: "risk_level", width: 100 },
    { title: t("Endpoint"), dataIndex: "endpoint", ellipsis: true },
    { title: t("Status"), dataIndex: "status", render: (value) => <StatusTag status={value} t={t} />, width: 110 },
    {
      title: t("Actions"),
      width: 300,
      render: (_, tool) => (
        <Space>
          <Button icon={<PlayCircleOutlined />} disabled={tool.status !== "active"} onClick={() => openToolTest(tool)}>
            {t("Test")}
          </Button>
          <Button icon={<ApiOutlined />} type="primary" disabled={tool.status !== "active"} onClick={() => invokeTool(tool)}>
            {t("Invoke")}
          </Button>
          <Popconfirm
            title={t("Disable this tool?")}
            okText={t("Disable")}
            okButtonProps={{ danger: true }}
            onConfirm={() => disableTool(tool)}
            disabled={tool.status !== "active"}
          >
            <Button danger icon={<DeleteOutlined />} disabled={tool.status !== "active"}>
              {t("Disable")}
            </Button>
          </Popconfirm>
          <Popconfirm
            title={t("Delete this tool?")}
            okText={t("Delete")}
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteTool(tool)}
          >
            <Button danger icon={<DeleteOutlined />}>
              {t("Delete")}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const auditColumns = [
    { title: t("Event"), dataIndex: "event_type" },
    { title: t("Actor"), dataIndex: "actor_type", width: 110 },
    { title: t("Resource"), dataIndex: "resource_type", width: 120 },
    { title: t("Created"), dataIndex: "created_at", render: (value) => new Date(value).toLocaleString(), width: 220 },
    {
      title: t("Actions"),
      width: 110,
      render: (_, auditLog) => (
        <Button icon={<EyeOutlined />} onClick={() => openAuditLogDetails(auditLog)}>
          {t("Details")}
        </Button>
      ),
    },
  ];

  const policyColumns = [
    { title: t("Name"), dataIndex: "name" },
    { title: t("Action"), dataIndex: "action", width: 110, render: (value) => <Tag color={value === "deny" ? "red" : "green"}>{value}</Tag> },
    { title: t("Priority"), dataIndex: "priority", width: 100 },
    { title: t("Enabled"), dataIndex: "enabled", width: 100, render: (value) => <Tag color={value ? "green" : "default"}>{value ? t("Enabled") : t("Disabled")}</Tag> },
    { title: t("Description"), dataIndex: "description", ellipsis: true, render: (value) => value || "-" },
    {
      title: t("Actions"),
      width: 220,
      render: (_, policy) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => openPolicyDetails(policy)}>
            {t("Details")}
          </Button>
          <Popconfirm
            title={t("Disable this policy?")}
            okText={t("Disable")}
            okButtonProps={{ danger: true }}
            onConfirm={() => disablePolicy(policy)}
            disabled={!policy.enabled}
          >
            <Button danger icon={<DeleteOutlined />} disabled={!policy.enabled}>
              {t("Disable")}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const invocationColumns = [
    { title: t("Agent"), dataIndex: "agent_name" },
    { title: t("Tool"), dataIndex: "tool_name" },
    { title: t("Status"), dataIndex: "status", render: (value) => <StatusTag status={value} t={t} />, width: 110 },
    { title: t("Latency"), dataIndex: "latency_ms", render: (value) => `${value} ms`, width: 110 },
    { title: t("Created"), dataIndex: "created_at", render: (value) => new Date(value).toLocaleString(), width: 220 },
    {
      title: t("Actions"),
      width: 110,
      render: (_, invocation) => (
        <Button icon={<EyeOutlined />} onClick={() => openInvocationDetails(invocation)}>
          {t("Details")}
        </Button>
      ),
    },
  ];

  const approvalColumns = [
    { title: t("Reason"), dataIndex: "reason", ellipsis: true },
    { title: t("Status"), dataIndex: "status", render: (value) => <StatusTag status={value} t={t} />, width: 110 },
    { title: t("Approver"), dataIndex: "approver", width: 130 },
    { title: t("Created"), dataIndex: "created_at", render: (value) => new Date(value).toLocaleString(), width: 220 },
    {
      title: t("Actions"),
      width: 300,
      render: (_, approval) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => openApprovalDetails(approval)}>
            {t("Details")}
          </Button>
          <Button type="primary" disabled={approval.status !== "pending"} onClick={() => decideApproval(approval, "approve")}>
            {t("Approve")}
          </Button>
          <Popconfirm
            title={t("Reject this approval?")}
            okText={t("Reject")}
            okButtonProps={{ danger: true }}
            onConfirm={() => decideApproval(approval, "reject")}
            disabled={approval.status !== "pending"}
          >
            <Button danger disabled={approval.status !== "pending"}>
              {t("Reject")}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!accessGranted) {
    return (
      <ConfigProvider locale={antdLocale}>
        <Layout className="app-shell access-shell">
          <div className="access-panel">
            <Space size={12}>
              <SafetyCertificateOutlined className="brand-icon" />
              <div>
                <Title level={3}>{t("ATG Console")}</Title>
                <Text>{t("Agent Tool Gateway")}</Text>
              </div>
            </Space>
            <Form layout="vertical" className="access-form" onFinish={() => enterConsole()}>
              <Form.Item label={t("Admin Token")}>
                <Input.Password
                  autoFocus
                  placeholder={t("Paste server ADMIN_TOKEN")}
                  value={adminToken}
                  onChange={(event) => saveAdminToken(event.target.value)}
                />
              </Form.Item>
              <Space wrap>
                <Button type="primary" htmlType="submit">
                  {t("Enter")}
                </Button>
                <Button onClick={() => enterConsole({ localMode: true })}>{t("Local mode")}</Button>
                <Select
                  className="language-select"
                  value={language}
                  onChange={saveLanguage}
                  options={[
                    { value: "zh", label: t("Chinese") },
                    { value: "en", label: t("English") },
                  ]}
                />
              </Space>
            </Form>
          </div>
        </Layout>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider locale={antdLocale}>
      <Layout className="app-shell">
      <Header className="app-header">
        <Space size={12}>
          <SafetyCertificateOutlined className="brand-icon" />
          <div>
            <Title level={4}>{t("ATG Console")}</Title>
            <Text>{t("Agent Tool Gateway")}</Text>
          </div>
        </Space>
        <Space>
          <Input.Password
            className="admin-token-input"
            placeholder={t("Admin token")}
            value={adminToken}
            onChange={(event) => saveAdminToken(event.target.value)}
          />
          <Select
            className="language-select"
            value={language}
            onChange={saveLanguage}
            options={[
              { value: "zh", label: t("Chinese") },
              { value: "en", label: t("English") },
            ]}
          />
          <Tag color={health === "ok" ? "green" : "red"}>{t("server")} {health}</Tag>
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
            {t("Refresh")}
          </Button>
          <Button onClick={lockConsole}>{t("Lock")}</Button>
        </Space>
      </Header>

      <Content className="app-content">
        <Row gutter={[16, 16]} className="metrics">
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic title={t("Agents")} value={agents.length} prefix={<KeyOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic title={t("Active Tools")} value={activeTools.length} prefix={<ToolOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic title={t("Audit Events")} value={auditLogs.length} prefix={<AuditOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic title={t("Pending Approvals")} value={dashboardStats.pendingApprovals} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic title={t("Success Calls")} value={dashboardStats.successfulInvocations} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic title={t("Avg Latency")} value={dashboardStats.averageLatency} suffix="ms" />
            </Card>
          </Col>
          <Col xs={24}>
            <Card>
              <Space wrap>
                <Tag color="green">{t("success")} {dashboardStats.successfulInvocations}</Tag>
                <Tag color="red">{t("failed")} {dashboardStats.failedInvocations}</Tag>
                <Tag color="orange">{t("denied")} {dashboardStats.deniedInvocations}</Tag>
                <Tag>{t("pending")} {dashboardStats.pendingInvocations}</Tag>
              </Space>
            </Card>
          </Col>
        </Row>

        {oneTimeKey ? (
          <Alert
            className="key-alert"
            type="success"
            showIcon
            message={t("One-time API key")}
            description={<Text code copyable>{oneTimeKey}</Text>}
            closable
            onClose={() => setOneTimeKey("")}
          />
        ) : null}

        <Tabs
          defaultActiveKey="agents"
          items={[
            {
              key: "agents",
              label: t("Agents"),
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={8}>
                    <Card title={t("Create Agent")}>
                      <Form form={agentForm} layout="vertical" onFinish={createAgent}>
                        <Form.Item name="name" label={t("Name")} initialValue="customer-service-agent" rules={[{ required: true }]}>
                          <Input />
                        </Form.Item>
                        <Form.Item name="owner" label={t("Owner")} initialValue="ops">
                          <Input />
                        </Form.Item>
                        <Form.Item name="source_type" label={t("Source")} initialValue="custom">
                          <Select options={[{ value: "custom" }, { value: "workflow" }, { value: "assistant" }]} />
                        </Form.Item>
                        <Form.Item name="description" label={t("Description")}>
                          <Input.TextArea rows={3} />
                        </Form.Item>
                        <Button icon={<PlusOutlined />} type="primary" htmlType="submit" block>
                          {t("Create Agent")}
                        </Button>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24} lg={16}>
                    <Card title={t("Agent List")}>
                      <Table rowKey="id" columns={agentColumns} dataSource={agents} loading={loading} pagination={false} />
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: "tools",
              label: t("Tools"),
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={8}>
                    <Card
                      title={t("Create HTTP Tool")}
                      extra={
                        <Button size="small" icon={<UploadOutlined />} onClick={openOpenApiImport}>
                          {t("Import OpenAPI")}
                        </Button>
                      }
                    >
                      <Form form={toolForm} layout="vertical" onFinish={createTool}>
                        <Form.Item name="name" label={t("Name")} initialValue="refund_order" rules={[{ required: true }]}>
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name="endpoint"
                          label={t("Endpoint")}
                          initialValue="http://mock-api:9090/mock/refund_order"
                          rules={[{ required: true }]}
                        >
                          <Input />
                        </Form.Item>
                        <Row gutter={12}>
                          <Col span={12}>
                            <Form.Item name="method" label={t("Method")} initialValue="POST">
                              <Select options={[{ value: "POST" }, { value: "GET" }]} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="timeout_ms" label={t("Timeout")} initialValue={5000}>
                              <InputNumber min={100} max={60000} step={500} className="full-width" />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item name="risk_level" label={t("Risk")} initialValue="medium">
                          <Select options={[{ value: "low" }, { value: "medium" }, { value: "high" }]} />
                        </Form.Item>
                        <Form.Item name="owner" label={t("Owner")} initialValue="ops">
                          <Input />
                        </Form.Item>
                        <Form.Item name="headers" label={t("Headers JSON")} tooltip={t("Authorization and API-key headers are stored encrypted")}>
                          <Input.TextArea rows={3} />
                        </Form.Item>
                        <Form.Item
                          name="input_schema"
                          label={t("Input Schema JSON")}
                          initialValue='{"type":"object","required":["order_id","amount"],"properties":{"order_id":{"type":"string"},"amount":{"type":"number","minimum":1},"reason":{"type":"string"}}}'
                        >
                          <Input.TextArea rows={5} />
                        </Form.Item>
                        <Form.Item name="output_schema" label={t("Output Schema JSON")} initialValue="{}">
                          <Input.TextArea rows={3} />
                        </Form.Item>
                        <Button icon={<PlusOutlined />} type="primary" htmlType="submit" block>
                          {t("Create Tool")}
                        </Button>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24} lg={16}>
                    <Card
                      title={t("Tool List")}
                      extra={<Input.Password placeholder={t("Agent API key for invoke")} value={invokeKey} onChange={(e) => setInvokeKey(e.target.value)} />}
                    >
                      <Table rowKey="id" columns={toolColumns} dataSource={tools} loading={loading} pagination={false} />
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: "logs",
              label: t("Audit"),
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Card>
                      <Space wrap>
                        <Select
                          allowClear
                          showSearch
                          placeholder={t("Agent")}
                          className="filter-select"
                          value={logFilters.invocation_agent_id || undefined}
                          onChange={(value) => setLogFilters((current) => ({ ...current, invocation_agent_id: value || "" }))}
                          options={agentOptions}
                          optionFilterProp="label"
                        />
                        <Select
                          allowClear
                          showSearch
                          placeholder={t("Tool")}
                          className="filter-select"
                          value={logFilters.invocation_tool_id || undefined}
                          onChange={(value) => setLogFilters((current) => ({ ...current, invocation_tool_id: value || "" }))}
                          options={toolOptions}
                          optionFilterProp="label"
                        />
                        <Select
                          allowClear
                          placeholder={t("Invocation status")}
                          className="filter-select"
                          value={logFilters.invocation_status || undefined}
                          onChange={(value) => setLogFilters((current) => ({ ...current, invocation_status: value || "" }))}
                          options={[
                            { value: "success" },
                            { value: "failed" },
                            { value: "denied" },
                            { value: "pending_approval" },
                          ]}
                        />
                        <Select
                          allowClear
                          placeholder={t("Audit event")}
                          className="filter-select"
                          value={logFilters.audit_event_type || undefined}
                          onChange={(value) => setLogFilters((current) => ({ ...current, audit_event_type: value || "" }))}
                          options={[
                            { value: "tool.invoke.succeeded" },
                            { value: "tool.invoke.denied" },
                            { value: "tool.invoke.pending_approval" },
                            { value: "approval.approved.executed" },
                            { value: "approval.rejected" },
                          ]}
                        />
                        <Select
                          allowClear
                          placeholder={t("Audit actor")}
                          className="filter-select"
                          value={logFilters.audit_actor_type || undefined}
                          onChange={(value) => setLogFilters((current) => ({ ...current, audit_actor_type: value || "" }))}
                          options={[{ value: "admin" }, { value: "agent" }, { value: "approver" }]}
                        />
                        <Select
                          allowClear
                          placeholder={t("Audit resource")}
                          className="filter-select"
                          value={logFilters.audit_resource_type || undefined}
                          onChange={(value) => setLogFilters((current) => ({ ...current, audit_resource_type: value || "" }))}
                          options={[{ value: "agent" }, { value: "tool" }, { value: "policy" }, { value: "approval" }]}
                        />
                        <Select
                          allowClear
                          placeholder={t("Approval status")}
                          className="filter-select"
                          value={logFilters.approval_status || undefined}
                          onChange={(value) => setLogFilters((current) => ({ ...current, approval_status: value || "" }))}
                          options={[{ value: "pending" }, { value: "approved" }, { value: "rejected" }]}
                        />
                        <Input
                          className="filter-datetime"
                          type="datetime-local"
                          value={logFilters.from}
                          onChange={(event) => setLogFilters((current) => ({ ...current, from: event.target.value }))}
                        />
                        <Input
                          className="filter-datetime"
                          type="datetime-local"
                          value={logFilters.to}
                          onChange={(event) => setLogFilters((current) => ({ ...current, to: event.target.value }))}
                        />
                        <InputNumber
                          min={1}
                          max={500}
                          value={logFilters.limit}
                          onChange={(value) => setLogFilters((current) => ({ ...current, limit: value || 100 }))}
                        />
                        <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
                          {t("Apply")}
                        </Button>
                        <Button icon={<DownloadOutlined />} onClick={downloadEvidence}>
                          {t("Export Evidence")}
                        </Button>
                        <Button onClick={resetLogFilters}>{t("Reset")}</Button>
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24}>
                    <Card title={t("Approvals")}>
                      <Table rowKey="id" columns={approvalColumns} dataSource={approvals} loading={loading} pagination={{ pageSize: 6 }} />
                    </Card>
                  </Col>
                  <Col xs={24} xl={12}>
                    <Card title={t("Invocations")}>
                      <Table rowKey="id" columns={invocationColumns} dataSource={invocations} loading={loading} pagination={{ pageSize: 8 }} />
                    </Card>
                  </Col>
                  <Col xs={24} xl={12}>
                    <Card title={t("Audit Logs")}>
                      <Table rowKey="id" columns={auditColumns} dataSource={auditLogs} loading={loading} pagination={{ pageSize: 8 }} />
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: "policies",
              label: t("Policies"),
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={8}>
                    <Card title={t("Create Policy")}>
                      <Form form={policyForm} layout="vertical" onFinish={createPolicy}>
                        <Form.Item name="name" label={t("Name")} initialValue="Deny delete_user" rules={[{ required: true }]}>
                          <Input />
                        </Form.Item>
                        <Row gutter={12}>
                          <Col span={12}>
                            <Form.Item name="action" label={t("Action")} initialValue="deny">
                              <Select options={[{ value: "deny" }, { value: "allow" }, { value: "approve" }, { value: "redact" }]} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="priority" label={t("Priority")} initialValue={10}>
                              <InputNumber min={1} max={10000} className="full-width" />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item name="description" label={t("Description")}>
                          <Input.TextArea rows={2} />
                        </Form.Item>
                        <Form.Item name="condition_json" label={t("Condition JSON")} initialValue={'{"tool":"delete_user"}'}>
                          <Input.TextArea rows={4} />
                        </Form.Item>
                        <Form.Item
                          name="scope"
                          label={t("Scope JSON")}
                          initialValue={"{}"}
                          tooltip={t("Use scope.redaction for custom redact fields or regex patterns.")}
                        >
                          <Input.TextArea
                            rows={5}
                            placeholder={
                              '{\n  "redaction": {\n    "fields": ["$.profile.external_id"],\n    "patterns": [{ "pattern": "TCK-\\\\d+", "replacement": "TCK-***" }]\n  }\n}'
                            }
                          />
                        </Form.Item>
                        <Button icon={<PlusOutlined />} type="primary" htmlType="submit" block>
                          {t("Create Policy")}
                        </Button>
                      </Form>
                    </Card>
                    <Card title={t("Preview Policy")} className="stacked-card">
                      <Form
                        form={policyPreviewForm}
                        layout="vertical"
                        onFinish={previewPolicy}
                        initialValues={{ input: '{\n  "amount": 150,\n  "reason": "VIP customer escalation"\n}' }}
                      >
                        <Form.Item name="agent_id" label={t("Agent")} rules={[{ required: true }]}>
                          <Select showSearch options={agentOptions} optionFilterProp="label" />
                        </Form.Item>
                        <Form.Item name="tool_id" label={t("Tool")} rules={[{ required: true }]}>
                          <Select showSearch options={toolOptions} optionFilterProp="label" />
                        </Form.Item>
                        <Form.Item name="input" label={t("Input JSON")}>
                          <Input.TextArea rows={5} />
                        </Form.Item>
                        <Button icon={<PlayCircleOutlined />} type="primary" htmlType="submit" block>
                          {t("Preview Decision")}
                        </Button>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24} lg={16}>
                    <Card title={t("Policy List")}>
                      <Space wrap className="toolbar">
                        <Select
                          allowClear
                          placeholder={t("Action")}
                          value={policyFilters.action || undefined}
                          onChange={(value) => setPolicyFilters((current) => ({ ...current, action: value || "" }))}
                          options={[
                            { value: "allow" },
                            { value: "deny" },
                            { value: "approve" },
                            { value: "redact" },
                          ]}
                          style={{ width: 140 }}
                        />
                        <Select
                          allowClear
                          placeholder={t("Enabled")}
                          value={policyFilters.enabled || undefined}
                          onChange={(value) => setPolicyFilters((current) => ({ ...current, enabled: value || "" }))}
                          options={[
                            { value: "true", label: t("Enabled") },
                            { value: "false", label: t("Disabled") },
                          ]}
                          style={{ width: 140 }}
                        />
                        <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
                          {t("Apply")}
                        </Button>
                        <Button onClick={resetPolicyFilters}>{t("Reset")}</Button>
                      </Space>
                      <Table rowKey="id" columns={policyColumns} dataSource={policies} loading={loading} pagination={false} />
                    </Card>
                  </Col>
                </Row>
              ),
            },
          ]}
        />

        <Modal
          title={t("Import OpenAPI")}
          open={openApiImportOpen}
          onCancel={closeOpenApiImport}
          footer={null}
          width={1040}
        >
          <Steps
            size="small"
            current={openApiImportStep}
            items={[{ title: t("Source") }, { title: t("Review") }, { title: t("Results") }]}
          />

          {openApiImportStep === 0 ? (
            <Form form={openApiForm} layout="vertical" initialValues={{ source_type: "url" }} onFinish={previewOpenApiImport} className="import-step">
              <Form.Item name="source_type" label={t("OpenAPI Source")}>
                <Radio.Group
                  onChange={(event) => {
                    setOpenApiSourceType(event.target.value);
                    setOpenApiPreview(null);
                    setOpenApiImportSource(null);
                    setOpenApiImportResults(null);
                    setSelectedOpenApiOperation("");
                    setSelectedOpenApiOperations([]);
                    openApiToolForm.resetFields();
                  }}
                >
                  <Radio.Button value="url">{t("URL")}</Radio.Button>
                  <Radio.Button value="content">
                    {t("File")} / {t("Paste")}
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>
              {openApiSourceType === "url" ? (
                <Form.Item name="url" label={t("OpenAPI URL")} rules={[{ required: true }]}>
                  <Input placeholder="https://example.com/openapi.json" />
                </Form.Item>
              ) : (
                <>
                  <Upload
                    accept=".json,.yaml,.yml,application/json,text/yaml,application/yaml"
                    showUploadList={false}
                    beforeUpload={async (file) => {
                      const content = await file.text();
                      openApiForm.setFieldsValue({ source_type: "content", content });
                      setOpenApiSourceType("content");
                      message.success(t("OpenAPI file loaded"));
                      return false;
                    }}
                  >
                    <Button icon={<UploadOutlined />}>{t("Upload OpenAPI file")}</Button>
                  </Upload>
                  <Form.Item name="content" label={t("OpenAPI Content")} rules={[{ required: true }]} className="form-section">
                    <Input.TextArea rows={8} placeholder="Paste OpenAPI JSON or YAML" />
                  </Form.Item>
                </>
              )}
              <Collapse
                ghost
                items={[
                  {
                    key: "base-url",
                    label: t("Base URL override"),
                    children: (
                      <Form.Item name="base_url" label={t("Base URL override")}>
                        <Input placeholder="https://api.example.com" />
                      </Form.Item>
                    ),
                  },
                ]}
              />
              <Button icon={<EyeOutlined />} type="primary" htmlType="submit" loading={openApiImportLoading}>
                {t("Preview Operations")}
              </Button>
            </Form>
          ) : null}

          {openApiImportStep === 1 && openApiPreview ? (
            <div className="import-step">
              <Alert
                type={openApiWarningCount ? "warning" : "success"}
                showIcon
                message={`${openApiPreview.document?.title || "OpenAPI"} ${openApiPreview.document?.version || ""}`}
                description={
                  <Space wrap>
                    <span>
                      {t("Operations")}: {openApiPreview.operations?.length || 0}
                    </span>
                    <span>
                      {t("Warnings")}: {openApiWarningCount}
                    </span>
                    <span>
                      {t("Selected")}: {selectedOpenApiOperations.length}
                    </span>
                    <Button
                      size="small"
                      onClick={() => {
                        setOpenApiImportStep(0);
                        setOpenApiImportResults(null);
                      }}
                    >
                      {t("Change")}
                    </Button>
                  </Space>
                }
              />
              <div className="import-review-grid">
                <div className="import-review-main">
                  <Table
                    rowKey="operation_key"
                    size="small"
                    pagination={{ pageSize: 6 }}
                    className="form-section"
                    rowSelection={{
                      selectedRowKeys: selectedOpenApiOperations,
                      onChange: (keys) => setSelectedOpenApiOperations(keys),
                    }}
                    onRow={(operation) => ({
                      onClick: () => {
                        setSelectedOpenApiOperation(operation.operation_key);
                        fillOpenApiToolForm(operation);
                      },
                    })}
                    columns={[
                      { title: t("Method"), dataIndex: "method", width: 90 },
                      { title: t("Endpoint"), dataIndex: "path" },
                      { title: t("Operation"), dataIndex: "operation_id" },
                      { title: t("Risk"), dataIndex: "risk_level", width: 100 },
                      {
                        title: t("Warning Count"),
                        width: 120,
                        render: (_, operation) => operation.warnings?.length || 0,
                      },
                    ]}
                    dataSource={openApiPreview.operations || []}
                  />
                  <Form
                    form={openApiBatchForm}
                    layout="vertical"
                    className="form-section"
                    initialValues={{ risk_level: "medium", timeout_ms: 5000, headers: "{}" }}
                    onFinish={importSelectedOpenApiTools}
                  >
                    <Collapse
                      defaultActiveKey={["settings"]}
                      items={[
                        {
                          key: "settings",
                          label: t("Import Settings"),
                          children: (
                            <>
                              <Row gutter={12}>
                                <Col xs={24} md={8}>
                                  <Form.Item name="owner" label={t("Owner")}>
                                    <Input />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} md={8}>
                                  <Form.Item name="risk_level" label={t("Risk")}>
                                    <Select options={[{ value: "low" }, { value: "medium" }, { value: "high" }]} />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} md={8}>
                                  <Form.Item name="timeout_ms" label={t("Timeout")}>
                                    <InputNumber min={100} max={60000} step={500} className="full-width" />
                                  </Form.Item>
                                </Col>
                              </Row>
                              <Form.Item name="headers" label={t("Headers JSON")}>
                                <Input.TextArea rows={2} />
                              </Form.Item>
                            </>
                          ),
                        },
                      ]}
                    />
                    <div className="import-actions">
                      <Button type="primary" icon={<PlusOutlined />} htmlType="submit" disabled={!selectedOpenApiOperations.length}>
                        {t("Import Selected")} ({selectedOpenApiOperations.length})
                      </Button>
                    </div>
                  </Form>
                </div>
                <div className="import-inspector">
                  <Title level={5}>{t("Tool Preview")}</Title>
                  {selectedOpenApiOperationDetail?.tool ? (
                    <>
                      <Descriptions size="small" column={1} bordered>
                        <Descriptions.Item label={t("Name")}>{selectedOpenApiOperationDetail.tool.name}</Descriptions.Item>
                        <Descriptions.Item label={t("Method")}>{selectedOpenApiOperationDetail.tool.method}</Descriptions.Item>
                        <Descriptions.Item label={t("Endpoint")}>{selectedOpenApiOperationDetail.tool.endpoint}</Descriptions.Item>
                        <Descriptions.Item label={t("Risk")}>{selectedOpenApiOperationDetail.tool.risk_level}</Descriptions.Item>
                      </Descriptions>
                      {selectedOpenApiOperationDetail?.warnings?.length ? (
                        <Alert
                          type="warning"
                          showIcon
                          className="detail-section"
                          message={t("Warnings")}
                          description={selectedOpenApiOperationDetail.warnings.join(" ")}
                        />
                      ) : null}
                      <Collapse
                        className="detail-section"
                        items={[
                          {
                            key: "schemas",
                            label: t("Advanced Edit"),
                            children: (
                              <Form form={openApiToolForm} layout="vertical" onFinish={createImportedOpenApiTool}>
                                <Row gutter={12}>
                                  <Col xs={24} md={12}>
                                    <Form.Item name="name" label={t("Name")} rules={[{ required: true }]}>
                                      <Input />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} md={12}>
                                    <Form.Item name="owner" label={t("Owner")}>
                                      <Input />
                                    </Form.Item>
                                  </Col>
                                </Row>
                                <Form.Item name="endpoint" label={t("Endpoint")} rules={[{ required: true }]}>
                                  <Input />
                                </Form.Item>
                                <Form.Item name="headers" label={t("Headers JSON")}>
                                  <Input.TextArea rows={3} />
                                </Form.Item>
                                <Form.Item name="input_schema" label={t("Input Schema JSON")}>
                                  <Input.TextArea rows={5} />
                                </Form.Item>
                                <Form.Item name="output_schema" label={t("Output Schema JSON")}>
                                  <Input.TextArea rows={4} />
                                </Form.Item>
                                <Button icon={<PlusOutlined />} htmlType="submit" disabled={!selectedOpenApiOperationDetail?.tool}>
                                  {t("Create Imported Tool")}
                                </Button>
                              </Form>
                            ),
                          },
                        ]}
                      />
                    </>
                  ) : (
                    <Text type="secondary">{t("Operation")}</Text>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {openApiImportStep === 2 ? (
            <div className="import-step">
              <Alert
                type={openApiCreatedCount === selectedOpenApiOperations.length ? "success" : "warning"}
                showIcon
                message={`${openApiCreatedCount}/${selectedOpenApiOperations.length} ${t("Import Results")}`}
              />
              <Table
                rowKey="operation_key"
                size="small"
                className="form-section"
                pagination={false}
                columns={[
                  { title: t("Operation"), dataIndex: "operation_key" },
                  { title: t("Status"), dataIndex: "status", render: (value) => <StatusTag status={value} t={t} /> },
                  {
                    title: t("Tool"),
                    render: (_, record) => record.tool?.name || record.error?.message || "-",
                  },
                ]}
                dataSource={openApiImportResults || []}
              />
              <Space className="import-actions">
                <Button type="primary" onClick={closeOpenApiImport}>
                  {t("Done")}
                </Button>
                <Button
                  onClick={() => {
                    setOpenApiImportResults(null);
                    setOpenApiImportStep(1);
                  }}
                >
                  {t("Import More")}
                </Button>
              </Space>
            </div>
          ) : null}
        </Modal>

        <Modal
          title={t("Test Tool")}
          open={Boolean(testToolTarget)}
          onCancel={() => {
            setTestToolTarget(null);
            setTestResult(null);
          }}
          footer={null}
          width={760}
        >
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label={t("Tool")}>{testToolTarget?.name}</Descriptions.Item>
            <Descriptions.Item label={t("Endpoint")}>{testToolTarget?.endpoint}</Descriptions.Item>
          </Descriptions>
          <Form form={toolTestForm} layout="vertical" className="form-section" onFinish={testTool}>
            <Form.Item name="input" label={t("Test Input JSON")} rules={[{ required: true }]}>
              <Input.TextArea rows={8} />
            </Form.Item>
            <Button icon={<PlayCircleOutlined />} type="primary" htmlType="submit" loading={testToolRunning}>
              {t("Run Test")}
            </Button>
          </Form>
          {testResult ? (
            <div className="detail-section">
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label={t("HTTP")}>{testResult?.http_status}</Descriptions.Item>
                <Descriptions.Item label={t("Status")}>{testResult?.status}</Descriptions.Item>
              </Descriptions>
              <JsonBlock value={testResult?.data} />
            </div>
          ) : null}
        </Modal>

        <Modal title={t("Invocation Result")} open={Boolean(invokeResult)} onCancel={() => setInvokeResult(null)} footer={null} width={720}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label={t("Tool")}>{invokeResult?.tool}</Descriptions.Item>
            <Descriptions.Item label={t("Status")}>{invokeResult?.status}</Descriptions.Item>
            <Descriptions.Item label={t("Invocation")}>{invokeResult?.invocation_id}</Descriptions.Item>
            <Descriptions.Item label={t("Audit")}>{invokeResult?.audit_id}</Descriptions.Item>
          </Descriptions>
          <JsonBlock value={invokeResult?.data} />
        </Modal>

        <Modal
          title={t("Policy Preview")}
          open={Boolean(policyPreviewResult)}
          onCancel={() => setPolicyPreviewResult(null)}
          footer={null}
          width={760}
        >
          <Tabs
            className="detail-tabs"
            items={[
              {
                key: "overview",
                label: t("Overview"),
                children: (
                  <>
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label={t("Decision")}>{policyPreviewResult?.decision?.action}</Descriptions.Item>
                      <Descriptions.Item label={t("Matched Policy")}>
                        {policyPreviewResult?.decision?.matched_policy_name || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label={t("Reason")}>{policyPreviewResult?.decision?.reason || "-"}</Descriptions.Item>
                      <Descriptions.Item label={t("Matched Policies")}>
                        {policyPreviewResult?.decision?.matched_policies?.length ?? 0}
                      </Descriptions.Item>
                      <Descriptions.Item label={t("Redaction Policies")}>
                        {policyPreviewResult?.decision?.redaction_policy_ids?.length ?? 0}
                      </Descriptions.Item>
                      <Descriptions.Item label={t("Agent")}>{policyPreviewResult?.agent?.name}</Descriptions.Item>
                      <Descriptions.Item label={t("Tool")}>{policyPreviewResult?.tool?.name}</Descriptions.Item>
                    </Descriptions>
                    <div className="detail-section">
                      <Text strong>{t("Decision Trace")}</Text>
                      <DecisionTrace trace={policyPreviewResult?.decision?.decision_trace} t={t} />
                    </div>
                  </>
                ),
              },
              {
                key: "evidence",
                label: t("Evidence"),
                children: (
                  <div className="detail-json-grid">
                    <div>
                      <Text strong>{t("Explanation")}</Text>
                      <JsonBlock value={policyPreviewResult?.decision?.explanation} />
                    </div>
                    <div>
                      <Text strong>{t("Matched Policies")}</Text>
                      <JsonBlock value={policyPreviewResult?.decision?.matched_policies} />
                    </div>
                  </div>
                ),
              },
              {
                key: "raw",
                label: t("Raw JSON"),
                children: <JsonBlock value={policyPreviewResult?.decision} />,
              },
            ]}
          />
        </Modal>

        <Modal title={t("Approval Details")} open={Boolean(selectedApproval)} onCancel={() => setSelectedApproval(null)} footer={null} width={820}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label={t("ID")}>{selectedApproval?.id}</Descriptions.Item>
            <Descriptions.Item label={t("Invocation")}>{selectedApproval?.invocation_id}</Descriptions.Item>
            <Descriptions.Item label={t("Status")}>
              {selectedApproval ? <StatusTag status={selectedApproval.status} t={t} /> : null}
            </Descriptions.Item>
            <Descriptions.Item label={t("Approver")}>{selectedApproval?.approver || "-"}</Descriptions.Item>
            <Descriptions.Item label={t("Reason")}>{selectedApproval?.reason || "-"}</Descriptions.Item>
            <Descriptions.Item label={t("Comment")}>{selectedApproval?.comment || "-"}</Descriptions.Item>
            <Descriptions.Item label={t("Created")}>
              {selectedApproval?.created_at ? new Date(selectedApproval.created_at).toLocaleString() : "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("Updated")}>
              {selectedApproval?.updated_at ? new Date(selectedApproval.updated_at).toLocaleString() : "-"}
            </Descriptions.Item>
          </Descriptions>
        </Modal>

        <Modal title={t("Policy Details")} open={Boolean(selectedPolicy)} onCancel={() => setSelectedPolicy(null)} footer={null} width={860}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label={t("ID")}>{selectedPolicy?.id}</Descriptions.Item>
            <Descriptions.Item label={t("Name")}>{selectedPolicy?.name}</Descriptions.Item>
            <Descriptions.Item label={t("Action")}>
              {selectedPolicy?.action ? (
                <Tag color={selectedPolicy.action === "deny" ? "red" : "green"}>{selectedPolicy.action}</Tag>
              ) : null}
            </Descriptions.Item>
            <Descriptions.Item label={t("Priority")}>{selectedPolicy?.priority}</Descriptions.Item>
            <Descriptions.Item label={t("Enabled")}>
              {selectedPolicy ? <Tag color={selectedPolicy.enabled ? "green" : "default"}>{selectedPolicy.enabled ? t("Enabled") : t("Disabled")}</Tag> : null}
            </Descriptions.Item>
            <Descriptions.Item label={t("Description")}>{selectedPolicy?.description || "-"}</Descriptions.Item>
            <Descriptions.Item label={t("Created")}>
              {selectedPolicy?.created_at ? new Date(selectedPolicy.created_at).toLocaleString() : "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("Updated")}>
              {selectedPolicy?.updated_at ? new Date(selectedPolicy.updated_at).toLocaleString() : "-"}
            </Descriptions.Item>
          </Descriptions>
          <div className="detail-json-grid">
            <div>
              <Text strong>{t("Condition")}</Text>
              <JsonBlock value={selectedPolicy?.condition_json} />
            </div>
            <div>
              <Text strong>{t("Scope")}</Text>
              <JsonBlock value={selectedPolicy?.scope} />
            </div>
          </div>
        </Modal>

        <Modal title={t("Invocation Details")} open={Boolean(selectedInvocation)} onCancel={() => setSelectedInvocation(null)} footer={null} width={920}>
          <Tabs
            className="detail-tabs"
            items={[
              {
                key: "overview",
                label: t("Overview"),
                children: (
                  <>
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label={t("ID")}>{selectedInvocation?.id}</Descriptions.Item>
                      <Descriptions.Item label={t("Agent")}>{selectedInvocation?.agent_name}</Descriptions.Item>
                      <Descriptions.Item label={t("Tool")}>{selectedInvocation?.tool_name}</Descriptions.Item>
                      <Descriptions.Item label={t("Status")}>
                        {selectedInvocation ? <StatusTag status={selectedInvocation.status} t={t} /> : null}
                      </Descriptions.Item>
                      <Descriptions.Item label={t("Latency")}>{selectedInvocation?.latency_ms ?? 0} ms</Descriptions.Item>
                      <Descriptions.Item label={t("Matched Policy")}>{selectedInvocation?.matched_policy_id || "-"}</Descriptions.Item>
                      <Descriptions.Item label={t("Approval")}>{selectedInvocation?.approval_id || "-"}</Descriptions.Item>
                      <Descriptions.Item label={t("Error")}>{selectedInvocation?.error_message || "-"}</Descriptions.Item>
                      <Descriptions.Item label={t("Created")}>
                        {selectedInvocation?.created_at ? new Date(selectedInvocation.created_at).toLocaleString() : "-"}
                      </Descriptions.Item>
                    </Descriptions>
                    <div className="detail-section">
                      <Text strong>{t("Decision Trace")}</Text>
                      <DecisionTrace trace={selectedInvocation?.policy_decision?.decision_trace} t={t} />
                    </div>
                  </>
                ),
              },
              {
                key: "payload",
                label: t("Payload"),
                children: (
                  <div className="detail-json-grid">
                    <div>
                      <Text strong>{t("Request")}</Text>
                      <JsonBlock value={selectedInvocation?.request_args} />
                    </div>
                    <div>
                      <Text strong>{t("Redacted Response")}</Text>
                      <JsonBlock value={selectedInvocation?.response_data_redacted} />
                    </div>
                    <div>
                      <Text strong>{t("Policy Decision")}</Text>
                      <JsonBlock value={selectedInvocation?.policy_decision} />
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </Modal>

        <Modal title={t("Audit Log Details")} open={Boolean(selectedAuditLog)} onCancel={() => setSelectedAuditLog(null)} footer={null} width={860}>
          <Tabs
            className="detail-tabs"
            items={[
              {
                key: "overview",
                label: t("Overview"),
                children: (
                  <>
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label={t("ID")}>{selectedAuditLog?.id}</Descriptions.Item>
                      <Descriptions.Item label={t("Event")}>{selectedAuditLog?.event_type}</Descriptions.Item>
                      <Descriptions.Item label={t("Actor")}>
                        {[selectedAuditLog?.actor_type, selectedAuditLog?.actor_id].filter(Boolean).join(" / ") || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label={t("Resource")}>
                        {[selectedAuditLog?.resource_type, selectedAuditLog?.resource_id].filter(Boolean).join(" / ") || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label={t("Created")}>
                        {selectedAuditLog?.created_at ? new Date(selectedAuditLog.created_at).toLocaleString() : "-"}
                      </Descriptions.Item>
                    </Descriptions>
                    {selectedAuditLog?.detail_json?.policy_decision ? (
                      <div className="detail-section">
                        <Text strong>{t("Decision Trace")}</Text>
                        <DecisionTrace trace={selectedAuditLog.detail_json.policy_decision.decision_trace} t={t} />
                      </div>
                    ) : null}
                  </>
                ),
              },
              {
                key: "raw",
                label: t("Raw JSON"),
                children: <JsonBlock value={selectedAuditLog?.detail_json} />,
              },
            ]}
          />
        </Modal>
      </Content>
      </Layout>
    </ConfigProvider>
  );
}
