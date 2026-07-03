import dotenv from "dotenv";

dotenv.config();

function parseCsv(value = "") {
  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseOptionalBoolean(value, defaultValue) {
  if (value === undefined || value === "") return defaultValue;
  return String(value).toLowerCase() === "true";
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

export const config = {
  nodeEnv,
  port: Number(process.env.PORT || 8080),
  databaseUrl: process.env.DATABASE_URL || "postgres://atg:atg@localhost:5432/atg",
  logLevel: process.env.LOG_LEVEL || "info",
  adminToken: process.env.ADMIN_TOKEN || "",
  secretKey: process.env.SECRET_KEY || "",
  toolEgressPolicy: {
    allowedHosts: parseCsv(process.env.TOOL_ALLOWED_HOSTS || ""),
    allowHttp: parseOptionalBoolean(process.env.TOOL_ALLOW_HTTP, !isProduction),
    allowPrivateNetwork: parseOptionalBoolean(process.env.TOOL_ALLOW_PRIVATE_NETWORK, !isProduction),
  },
};

export function validateRuntimeConfig(runtimeConfig = config) {
  if (runtimeConfig.nodeEnv !== "production") return;

  const missing = [];
  if (!runtimeConfig.adminToken) missing.push("ADMIN_TOKEN");
  if (!runtimeConfig.secretKey) missing.push("SECRET_KEY");

  if (missing.length) {
    throw new Error(`Production deployment requires ${missing.join(" and ")}`);
  }
}
