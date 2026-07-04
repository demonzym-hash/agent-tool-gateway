import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Layout,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  ApiOutlined,
  AuditOutlined,
  DeleteOutlined,
  EyeOutlined,
  KeyOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  ToolOutlined,
} from "@ant-design/icons";

const { Header, Content } = Layout;
const { Text, Title } = Typography;
const adminTokenStorageKey = "atg_admin_token";

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
    throw new Error(detail);
  }
  return data;
}

function JsonBlock({ value }) {
  return <pre className="json-block">{JSON.stringify(value ?? {}, null, 2)}</pre>;
}

function StatusTag({ status }) {
  const color = status === "active" || status === "success" ? "green" : status === "failed" ? "red" : "default";
  return <Tag color={color}>{status}</Tag>;
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
  const [invokeResult, setInvokeResult] = useState(null);
  const [policyPreviewResult, setPolicyPreviewResult] = useState(null);
  const [invokeKey, setInvokeKey] = useState("");
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(adminTokenStorageKey) || "");
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
  const [agentForm] = Form.useForm();
  const [toolForm] = Form.useForm();
  const [policyForm] = Form.useForm();
  const [policyPreviewForm] = Form.useForm();

  const activeTools = useMemo(() => tools.filter((tool) => tool.status === "active"), [tools]);
  const agentOptions = useMemo(() => agents.map((agent) => ({ value: agent.id, label: agent.name })), [agents]);
  const toolOptions = useMemo(() => tools.map((tool) => ({ value: tool.id, label: tool.name })), [tools]);
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
      agentForm.resetFields();
      message.success("Agent created");
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
      message.success("Agent key rotated");
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
      message.success("Agent disabled");
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
      message.success("Tool created");
      await refresh();
    } catch (error) {
      message.error(error.message);
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
      message.success("Policy created");
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
      message.success("Policy disabled");
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  async function testTool(tool) {
    try {
      const data = await api(`/api/v1/tools/${tool.id}/test`, {
        method: "POST",
        body: JSON.stringify(samplePayload),
      });
      setTestResult({ tool: tool.name, ...data });
    } catch (error) {
      message.error(error.message);
    }
  }

  async function disableTool(tool) {
    try {
      await api(`/api/v1/tools/${tool.id}/disable`, {
        method: "POST",
      });
      message.success("Tool disabled");
      await refresh();
    } catch (error) {
      message.error(error.message);
    }
  }

  async function invokeTool(tool) {
    if (!invokeKey) {
      message.warning("Paste an agent API key first");
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
      message.success(action === "approve" ? "Approval executed" : "Approval rejected");
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

  const agentColumns = [
    { title: "Name", dataIndex: "name" },
    { title: "Owner", dataIndex: "owner" },
    { title: "Source", dataIndex: "source_type" },
    { title: "Status", dataIndex: "status", render: (value) => <StatusTag status={value} /> },
    { title: "Created", dataIndex: "created_at", render: (value) => new Date(value).toLocaleString() },
    {
      title: "Actions",
      width: 210,
      render: (_, agent) => (
        <Space>
          <Button icon={<SyncOutlined />} disabled={agent.status !== "active"} onClick={() => rotateAgentKey(agent)}>
            Rotate
          </Button>
          <Popconfirm
            title="Disable this agent?"
            okText="Disable"
            okButtonProps={{ danger: true }}
            onConfirm={() => disableAgent(agent)}
            disabled={agent.status !== "active"}
          >
            <Button danger icon={<DeleteOutlined />} disabled={agent.status !== "active"}>
              Disable
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const toolColumns = [
    { title: "Name", dataIndex: "name" },
    { title: "Method", dataIndex: "method", width: 90 },
    { title: "Risk", dataIndex: "risk_level", width: 100 },
    { title: "Endpoint", dataIndex: "endpoint", ellipsis: true },
    { title: "Status", dataIndex: "status", render: (value) => <StatusTag status={value} />, width: 110 },
    {
      title: "Actions",
      width: 210,
      render: (_, tool) => (
        <Space>
          <Button icon={<PlayCircleOutlined />} disabled={tool.status !== "active"} onClick={() => testTool(tool)}>
            Test
          </Button>
          <Button icon={<ApiOutlined />} type="primary" disabled={tool.status !== "active"} onClick={() => invokeTool(tool)}>
            Invoke
          </Button>
          <Popconfirm
            title="Disable this tool?"
            okText="Disable"
            okButtonProps={{ danger: true }}
            onConfirm={() => disableTool(tool)}
            disabled={tool.status !== "active"}
          >
            <Button danger icon={<DeleteOutlined />} disabled={tool.status !== "active"}>
              Disable
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const auditColumns = [
    { title: "Event", dataIndex: "event_type" },
    { title: "Actor", dataIndex: "actor_type", width: 110 },
    { title: "Resource", dataIndex: "resource_type", width: 120 },
    { title: "Created", dataIndex: "created_at", render: (value) => new Date(value).toLocaleString(), width: 220 },
    {
      title: "Actions",
      width: 110,
      render: (_, auditLog) => (
        <Button icon={<EyeOutlined />} onClick={() => openAuditLogDetails(auditLog)}>
          Details
        </Button>
      ),
    },
  ];

  const policyColumns = [
    { title: "Name", dataIndex: "name" },
    { title: "Action", dataIndex: "action", width: 110, render: (value) => <Tag color={value === "deny" ? "red" : "green"}>{value}</Tag> },
    { title: "Priority", dataIndex: "priority", width: 100 },
    { title: "Enabled", dataIndex: "enabled", width: 100, render: (value) => <Tag color={value ? "green" : "default"}>{String(value)}</Tag> },
    { title: "Description", dataIndex: "description", ellipsis: true, render: (value) => value || "-" },
    {
      title: "Actions",
      width: 220,
      render: (_, policy) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => openPolicyDetails(policy)}>
            Details
          </Button>
          <Popconfirm
            title="Disable this policy?"
            okText="Disable"
            okButtonProps={{ danger: true }}
            onConfirm={() => disablePolicy(policy)}
            disabled={!policy.enabled}
          >
            <Button danger icon={<DeleteOutlined />} disabled={!policy.enabled}>
              Disable
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const invocationColumns = [
    { title: "Agent", dataIndex: "agent_name" },
    { title: "Tool", dataIndex: "tool_name" },
    { title: "Status", dataIndex: "status", render: (value) => <StatusTag status={value} />, width: 110 },
    { title: "Latency", dataIndex: "latency_ms", render: (value) => `${value} ms`, width: 110 },
    { title: "Created", dataIndex: "created_at", render: (value) => new Date(value).toLocaleString(), width: 220 },
    {
      title: "Actions",
      width: 110,
      render: (_, invocation) => (
        <Button icon={<EyeOutlined />} onClick={() => openInvocationDetails(invocation)}>
          Details
        </Button>
      ),
    },
  ];

  const approvalColumns = [
    { title: "Reason", dataIndex: "reason", ellipsis: true },
    { title: "Status", dataIndex: "status", render: (value) => <StatusTag status={value} />, width: 110 },
    { title: "Approver", dataIndex: "approver", width: 130 },
    { title: "Created", dataIndex: "created_at", render: (value) => new Date(value).toLocaleString(), width: 220 },
    {
      title: "Actions",
      width: 300,
      render: (_, approval) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => openApprovalDetails(approval)}>
            Details
          </Button>
          <Button type="primary" disabled={approval.status !== "pending"} onClick={() => decideApproval(approval, "approve")}>
            Approve
          </Button>
          <Popconfirm
            title="Reject this approval?"
            okText="Reject"
            okButtonProps={{ danger: true }}
            onConfirm={() => decideApproval(approval, "reject")}
            disabled={approval.status !== "pending"}
          >
            <Button danger disabled={approval.status !== "pending"}>
              Reject
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!accessGranted) {
    return (
      <Layout className="app-shell access-shell">
        <div className="access-panel">
          <Space size={12}>
            <SafetyCertificateOutlined className="brand-icon" />
            <div>
              <Title level={3}>ATG Console</Title>
              <Text>Agent Tool Gateway</Text>
            </div>
          </Space>
          <Form layout="vertical" className="access-form" onFinish={() => enterConsole()}>
            <Form.Item label="Admin Token">
              <Input.Password
                autoFocus
                placeholder="Paste server ADMIN_TOKEN"
                value={adminToken}
                onChange={(event) => saveAdminToken(event.target.value)}
              />
            </Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit">
                Enter
              </Button>
              <Button onClick={() => enterConsole({ localMode: true })}>Local mode</Button>
            </Space>
          </Form>
        </div>
      </Layout>
    );
  }

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <Space size={12}>
          <SafetyCertificateOutlined className="brand-icon" />
          <div>
            <Title level={4}>ATG Console</Title>
            <Text>Agent Tool Gateway</Text>
          </div>
        </Space>
        <Space>
          <Input.Password
            className="admin-token-input"
            placeholder="Admin token"
            value={adminToken}
            onChange={(event) => saveAdminToken(event.target.value)}
          />
          <Tag color={health === "ok" ? "green" : "red"}>server {health}</Tag>
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
            Refresh
          </Button>
          <Button onClick={lockConsole}>Lock</Button>
        </Space>
      </Header>

      <Content className="app-content">
        <Row gutter={[16, 16]} className="metrics">
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic title="Agents" value={agents.length} prefix={<KeyOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic title="Active Tools" value={activeTools.length} prefix={<ToolOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic title="Audit Events" value={auditLogs.length} prefix={<AuditOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic title="Pending Approvals" value={dashboardStats.pendingApprovals} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic title="Success Calls" value={dashboardStats.successfulInvocations} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={4}>
            <Card>
              <Statistic title="Avg Latency" value={dashboardStats.averageLatency} suffix="ms" />
            </Card>
          </Col>
          <Col xs={24}>
            <Card>
              <Space wrap>
                <Tag color="green">success {dashboardStats.successfulInvocations}</Tag>
                <Tag color="red">failed {dashboardStats.failedInvocations}</Tag>
                <Tag color="orange">denied {dashboardStats.deniedInvocations}</Tag>
                <Tag>pending {dashboardStats.pendingInvocations}</Tag>
              </Space>
            </Card>
          </Col>
        </Row>

        {oneTimeKey ? (
          <Alert
            className="key-alert"
            type="success"
            showIcon
            message="One-time API key"
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
              label: "Agents",
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={8}>
                    <Card title="Create Agent">
                      <Form form={agentForm} layout="vertical" onFinish={createAgent}>
                        <Form.Item name="name" label="Name" initialValue="customer-service-agent" rules={[{ required: true }]}>
                          <Input />
                        </Form.Item>
                        <Form.Item name="owner" label="Owner" initialValue="ops">
                          <Input />
                        </Form.Item>
                        <Form.Item name="source_type" label="Source" initialValue="custom">
                          <Select options={[{ value: "custom" }, { value: "workflow" }, { value: "assistant" }]} />
                        </Form.Item>
                        <Form.Item name="description" label="Description">
                          <Input.TextArea rows={3} />
                        </Form.Item>
                        <Button icon={<PlusOutlined />} type="primary" htmlType="submit" block>
                          Create Agent
                        </Button>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24} lg={16}>
                    <Card title="Agent List">
                      <Table rowKey="id" columns={agentColumns} dataSource={agents} loading={loading} pagination={false} />
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: "tools",
              label: "Tools",
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={8}>
                    <Card title="Create HTTP Tool">
                      <Form form={toolForm} layout="vertical" onFinish={createTool}>
                        <Form.Item name="name" label="Name" initialValue="refund_order" rules={[{ required: true }]}>
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name="endpoint"
                          label="Endpoint"
                          initialValue="http://mock-api:9090/mock/refund_order"
                          rules={[{ required: true }]}
                        >
                          <Input />
                        </Form.Item>
                        <Row gutter={12}>
                          <Col span={12}>
                            <Form.Item name="method" label="Method" initialValue="POST">
                              <Select options={[{ value: "POST" }, { value: "GET" }]} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="timeout_ms" label="Timeout" initialValue={5000}>
                              <InputNumber min={100} max={60000} step={500} className="full-width" />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item name="risk_level" label="Risk" initialValue="medium">
                          <Select options={[{ value: "low" }, { value: "medium" }, { value: "high" }]} />
                        </Form.Item>
                        <Form.Item name="owner" label="Owner" initialValue="ops">
                          <Input />
                        </Form.Item>
                        <Form.Item name="headers" label="Headers JSON" tooltip="Authorization and API-key headers are stored encrypted">
                          <Input.TextArea rows={3} />
                        </Form.Item>
                        <Form.Item
                          name="input_schema"
                          label="Input Schema JSON"
                          initialValue='{"type":"object","required":["order_id","amount"],"properties":{"order_id":{"type":"string"},"amount":{"type":"number","minimum":1},"reason":{"type":"string"}}}'
                        >
                          <Input.TextArea rows={5} />
                        </Form.Item>
                        <Form.Item name="output_schema" label="Output Schema JSON" initialValue="{}">
                          <Input.TextArea rows={3} />
                        </Form.Item>
                        <Button icon={<PlusOutlined />} type="primary" htmlType="submit" block>
                          Create Tool
                        </Button>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24} lg={16}>
                    <Card
                      title="Tool List"
                      extra={<Input.Password placeholder="Agent API key for invoke" value={invokeKey} onChange={(e) => setInvokeKey(e.target.value)} />}
                    >
                      <Table rowKey="id" columns={toolColumns} dataSource={tools} loading={loading} pagination={false} />
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: "logs",
              label: "Audit",
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Card>
                      <Space wrap>
                        <Select
                          allowClear
                          showSearch
                          placeholder="Agent"
                          className="filter-select"
                          value={logFilters.invocation_agent_id || undefined}
                          onChange={(value) => setLogFilters((current) => ({ ...current, invocation_agent_id: value || "" }))}
                          options={agentOptions}
                          optionFilterProp="label"
                        />
                        <Select
                          allowClear
                          showSearch
                          placeholder="Tool"
                          className="filter-select"
                          value={logFilters.invocation_tool_id || undefined}
                          onChange={(value) => setLogFilters((current) => ({ ...current, invocation_tool_id: value || "" }))}
                          options={toolOptions}
                          optionFilterProp="label"
                        />
                        <Select
                          allowClear
                          placeholder="Invocation status"
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
                          placeholder="Audit event"
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
                          placeholder="Audit actor"
                          className="filter-select"
                          value={logFilters.audit_actor_type || undefined}
                          onChange={(value) => setLogFilters((current) => ({ ...current, audit_actor_type: value || "" }))}
                          options={[{ value: "admin" }, { value: "agent" }, { value: "approver" }]}
                        />
                        <Select
                          allowClear
                          placeholder="Audit resource"
                          className="filter-select"
                          value={logFilters.audit_resource_type || undefined}
                          onChange={(value) => setLogFilters((current) => ({ ...current, audit_resource_type: value || "" }))}
                          options={[{ value: "agent" }, { value: "tool" }, { value: "policy" }, { value: "approval" }]}
                        />
                        <Select
                          allowClear
                          placeholder="Approval status"
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
                          Apply
                        </Button>
                        <Button onClick={resetLogFilters}>Reset</Button>
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24}>
                    <Card title="Approvals">
                      <Table rowKey="id" columns={approvalColumns} dataSource={approvals} loading={loading} pagination={{ pageSize: 6 }} />
                    </Card>
                  </Col>
                  <Col xs={24} xl={12}>
                    <Card title="Invocations">
                      <Table rowKey="id" columns={invocationColumns} dataSource={invocations} loading={loading} pagination={{ pageSize: 8 }} />
                    </Card>
                  </Col>
                  <Col xs={24} xl={12}>
                    <Card title="Audit Logs">
                      <Table rowKey="id" columns={auditColumns} dataSource={auditLogs} loading={loading} pagination={{ pageSize: 8 }} />
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: "policies",
              label: "Policies",
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={8}>
                    <Card title="Create Policy">
                      <Form form={policyForm} layout="vertical" onFinish={createPolicy}>
                        <Form.Item name="name" label="Name" initialValue="Deny delete_user" rules={[{ required: true }]}>
                          <Input />
                        </Form.Item>
                        <Row gutter={12}>
                          <Col span={12}>
                            <Form.Item name="action" label="Action" initialValue="deny">
                              <Select options={[{ value: "deny" }, { value: "allow" }, { value: "approve" }, { value: "redact" }]} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name="priority" label="Priority" initialValue={10}>
                              <InputNumber min={1} max={10000} className="full-width" />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item name="description" label="Description">
                          <Input.TextArea rows={2} />
                        </Form.Item>
                        <Form.Item name="condition_json" label="Condition JSON" initialValue={'{"tool":"delete_user"}'}>
                          <Input.TextArea rows={4} />
                        </Form.Item>
                        <Form.Item
                          name="scope"
                          label="Scope JSON"
                          initialValue={"{}"}
                          tooltip="Use scope.redaction for custom redact fields or regex patterns."
                        >
                          <Input.TextArea
                            rows={5}
                            placeholder={
                              '{\n  "redaction": {\n    "fields": ["$.profile.external_id"],\n    "patterns": [{ "pattern": "TCK-\\\\d+", "replacement": "TCK-***" }]\n  }\n}'
                            }
                          />
                        </Form.Item>
                        <Button icon={<PlusOutlined />} type="primary" htmlType="submit" block>
                          Create Policy
                        </Button>
                      </Form>
                    </Card>
                    <Card title="Preview Policy" className="stacked-card">
                      <Form
                        form={policyPreviewForm}
                        layout="vertical"
                        onFinish={previewPolicy}
                        initialValues={{ input: '{\n  "amount": 150,\n  "reason": "VIP customer escalation"\n}' }}
                      >
                        <Form.Item name="agent_id" label="Agent" rules={[{ required: true }]}>
                          <Select showSearch options={agentOptions} optionFilterProp="label" />
                        </Form.Item>
                        <Form.Item name="tool_id" label="Tool" rules={[{ required: true }]}>
                          <Select showSearch options={toolOptions} optionFilterProp="label" />
                        </Form.Item>
                        <Form.Item name="input" label="Input JSON">
                          <Input.TextArea rows={5} />
                        </Form.Item>
                        <Button icon={<PlayCircleOutlined />} type="primary" htmlType="submit" block>
                          Preview Decision
                        </Button>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24} lg={16}>
                    <Card title="Policy List">
                      <Space wrap className="toolbar">
                        <Select
                          allowClear
                          placeholder="Action"
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
                          placeholder="Enabled"
                          value={policyFilters.enabled || undefined}
                          onChange={(value) => setPolicyFilters((current) => ({ ...current, enabled: value || "" }))}
                          options={[
                            { value: "true", label: "Enabled" },
                            { value: "false", label: "Disabled" },
                          ]}
                          style={{ width: 140 }}
                        />
                        <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
                          Apply
                        </Button>
                        <Button onClick={resetPolicyFilters}>Reset</Button>
                      </Space>
                      <Table rowKey="id" columns={policyColumns} dataSource={policies} loading={loading} pagination={false} />
                    </Card>
                  </Col>
                </Row>
              ),
            },
          ]}
        />

        <Modal title="Tool Test Result" open={Boolean(testResult)} onCancel={() => setTestResult(null)} footer={null} width={720}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Tool">{testResult?.tool}</Descriptions.Item>
            <Descriptions.Item label="HTTP">{testResult?.http_status}</Descriptions.Item>
            <Descriptions.Item label="Status">{testResult?.status}</Descriptions.Item>
          </Descriptions>
          <JsonBlock value={testResult?.data} />
        </Modal>

        <Modal title="Invocation Result" open={Boolean(invokeResult)} onCancel={() => setInvokeResult(null)} footer={null} width={720}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Tool">{invokeResult?.tool}</Descriptions.Item>
            <Descriptions.Item label="Status">{invokeResult?.status}</Descriptions.Item>
            <Descriptions.Item label="Invocation">{invokeResult?.invocation_id}</Descriptions.Item>
            <Descriptions.Item label="Audit">{invokeResult?.audit_id}</Descriptions.Item>
          </Descriptions>
          <JsonBlock value={invokeResult?.data} />
        </Modal>

        <Modal
          title="Policy Preview"
          open={Boolean(policyPreviewResult)}
          onCancel={() => setPolicyPreviewResult(null)}
          footer={null}
          width={760}
        >
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Decision">{policyPreviewResult?.decision?.action}</Descriptions.Item>
            <Descriptions.Item label="Matched Policy">{policyPreviewResult?.decision?.matched_policy_name || "-"}</Descriptions.Item>
            <Descriptions.Item label="Reason">{policyPreviewResult?.decision?.reason || "-"}</Descriptions.Item>
            <Descriptions.Item label="Matched Policies">{policyPreviewResult?.decision?.matched_policies?.length ?? 0}</Descriptions.Item>
            <Descriptions.Item label="Redaction Policies">{policyPreviewResult?.decision?.redaction_policy_ids?.length ?? 0}</Descriptions.Item>
            <Descriptions.Item label="Agent">{policyPreviewResult?.agent?.name}</Descriptions.Item>
            <Descriptions.Item label="Tool">{policyPreviewResult?.tool?.name}</Descriptions.Item>
          </Descriptions>
          <div className="detail-json-grid">
            <div>
              <Text strong>Explanation</Text>
              <JsonBlock value={policyPreviewResult?.decision?.explanation} />
            </div>
            <div>
              <Text strong>Matched Policies</Text>
              <JsonBlock value={policyPreviewResult?.decision?.matched_policies} />
            </div>
          </div>
          <JsonBlock value={policyPreviewResult?.decision} />
        </Modal>

        <Modal title="Approval Details" open={Boolean(selectedApproval)} onCancel={() => setSelectedApproval(null)} footer={null} width={820}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="ID">{selectedApproval?.id}</Descriptions.Item>
            <Descriptions.Item label="Invocation">{selectedApproval?.invocation_id}</Descriptions.Item>
            <Descriptions.Item label="Status">
              {selectedApproval ? <StatusTag status={selectedApproval.status} /> : null}
            </Descriptions.Item>
            <Descriptions.Item label="Approver">{selectedApproval?.approver || "-"}</Descriptions.Item>
            <Descriptions.Item label="Reason">{selectedApproval?.reason || "-"}</Descriptions.Item>
            <Descriptions.Item label="Comment">{selectedApproval?.comment || "-"}</Descriptions.Item>
            <Descriptions.Item label="Created">
              {selectedApproval?.created_at ? new Date(selectedApproval.created_at).toLocaleString() : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Updated">
              {selectedApproval?.updated_at ? new Date(selectedApproval.updated_at).toLocaleString() : "-"}
            </Descriptions.Item>
          </Descriptions>
        </Modal>

        <Modal title="Policy Details" open={Boolean(selectedPolicy)} onCancel={() => setSelectedPolicy(null)} footer={null} width={860}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="ID">{selectedPolicy?.id}</Descriptions.Item>
            <Descriptions.Item label="Name">{selectedPolicy?.name}</Descriptions.Item>
            <Descriptions.Item label="Action">
              {selectedPolicy?.action ? (
                <Tag color={selectedPolicy.action === "deny" ? "red" : "green"}>{selectedPolicy.action}</Tag>
              ) : null}
            </Descriptions.Item>
            <Descriptions.Item label="Priority">{selectedPolicy?.priority}</Descriptions.Item>
            <Descriptions.Item label="Enabled">
              {selectedPolicy ? <Tag color={selectedPolicy.enabled ? "green" : "default"}>{String(selectedPolicy.enabled)}</Tag> : null}
            </Descriptions.Item>
            <Descriptions.Item label="Description">{selectedPolicy?.description || "-"}</Descriptions.Item>
            <Descriptions.Item label="Created">
              {selectedPolicy?.created_at ? new Date(selectedPolicy.created_at).toLocaleString() : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Updated">
              {selectedPolicy?.updated_at ? new Date(selectedPolicy.updated_at).toLocaleString() : "-"}
            </Descriptions.Item>
          </Descriptions>
          <div className="detail-json-grid">
            <div>
              <Text strong>Condition</Text>
              <JsonBlock value={selectedPolicy?.condition_json} />
            </div>
            <div>
              <Text strong>Scope</Text>
              <JsonBlock value={selectedPolicy?.scope} />
            </div>
          </div>
        </Modal>

        <Modal title="Invocation Details" open={Boolean(selectedInvocation)} onCancel={() => setSelectedInvocation(null)} footer={null} width={920}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="ID">{selectedInvocation?.id}</Descriptions.Item>
            <Descriptions.Item label="Agent">{selectedInvocation?.agent_name}</Descriptions.Item>
            <Descriptions.Item label="Tool">{selectedInvocation?.tool_name}</Descriptions.Item>
            <Descriptions.Item label="Status">
              {selectedInvocation ? <StatusTag status={selectedInvocation.status} /> : null}
            </Descriptions.Item>
            <Descriptions.Item label="Latency">{selectedInvocation?.latency_ms ?? 0} ms</Descriptions.Item>
            <Descriptions.Item label="Matched Policy">{selectedInvocation?.matched_policy_id || "-"}</Descriptions.Item>
            <Descriptions.Item label="Approval">{selectedInvocation?.approval_id || "-"}</Descriptions.Item>
            <Descriptions.Item label="Error">{selectedInvocation?.error_message || "-"}</Descriptions.Item>
            <Descriptions.Item label="Created">
              {selectedInvocation?.created_at ? new Date(selectedInvocation.created_at).toLocaleString() : "-"}
            </Descriptions.Item>
          </Descriptions>
          <div className="detail-json-grid">
            <div>
              <Text strong>Request</Text>
              <JsonBlock value={selectedInvocation?.request_args} />
            </div>
            <div>
              <Text strong>Redacted Response</Text>
              <JsonBlock value={selectedInvocation?.response_data_redacted} />
            </div>
            <div>
              <Text strong>Policy Decision</Text>
              <JsonBlock value={selectedInvocation?.policy_decision} />
            </div>
          </div>
        </Modal>

        <Modal title="Audit Log Details" open={Boolean(selectedAuditLog)} onCancel={() => setSelectedAuditLog(null)} footer={null} width={860}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="ID">{selectedAuditLog?.id}</Descriptions.Item>
            <Descriptions.Item label="Event">{selectedAuditLog?.event_type}</Descriptions.Item>
            <Descriptions.Item label="Actor">
              {[selectedAuditLog?.actor_type, selectedAuditLog?.actor_id].filter(Boolean).join(" / ") || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Resource">
              {[selectedAuditLog?.resource_type, selectedAuditLog?.resource_id].filter(Boolean).join(" / ") || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {selectedAuditLog?.created_at ? new Date(selectedAuditLog.created_at).toLocaleString() : "-"}
            </Descriptions.Item>
          </Descriptions>
          <JsonBlock value={selectedAuditLog?.detail_json} />
        </Modal>
      </Content>
    </Layout>
  );
}
