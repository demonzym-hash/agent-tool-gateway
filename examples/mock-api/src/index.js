import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";

const port = Number(process.env.PORT || 9090);
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const app = express();

app.use(express.json());
app.use(pinoHttp({ logger }));

app.get("/healthz", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/mock/refund_order", (req, res) => {
  const { order_id, amount, reason } = req.body || {};
  res.json({
    refund_id: `rf_${Date.now()}`,
    order_id,
    amount,
    reason,
    status: "approved",
    processed_by: "mock-refund-api",
  });
});

app.post("/mock/search_customer", (req, res) => {
  res.json({
    customer_id: req.body?.customer_id || "cus_demo",
    name: "Demo Customer",
    tier: "gold",
    phone: "13812345678",
    email: "demo.customer@example.com",
    id_card: "110101199001011234",
    account_number: "6222020202020202",
    support_ticket: "TCK-778899",
    profile: {
      external_id: "ext_12345",
      note: "manual review TCK-778899",
    },
    contacts: [{ type: "email", value: "vip.owner@example.com" }],
  });
});

app.post("/mock/secret_header", (req, res) => {
  res.json({
    order_id: req.body?.order_id,
    authorization_received: req.get("authorization") || "",
    trace_id_received: req.get("x-trace-id") || "",
    status: "secret_header_checked",
  });
});

app.post("/mock/delete_user", (req, res) => {
  res.json({
    user_id: req.body?.user_id,
    status: "deleted",
  });
});

app.listen(port, () => {
  logger.info({ port }, "Mock API listening");
});
