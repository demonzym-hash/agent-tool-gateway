import dns from "node:dns/promises";
import net from "node:net";
import { HttpError } from "./errors.js";

function hostMatchesAllowedList(hostname, allowedHosts = []) {
  const normalized = hostname.toLowerCase();
  if (!allowedHosts.length) return true;
  return allowedHosts.some((allowedHost) => {
    if (allowedHost.startsWith("*.")) {
      const suffix = allowedHost.slice(1);
      return normalized.endsWith(suffix) && normalized.length > suffix.length;
    }
    return normalized === allowedHost;
  });
}

function isPrivateIpv4(address) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isPrivateIp(address) {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return false;
}

async function assertPublicHost(hostname) {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new HttpError(400, "tool_egress_blocked", "Tool endpoint resolves to a private host");
  }

  const literalFamily = net.isIP(hostname);
  if (literalFamily) {
    if (isPrivateIp(hostname)) {
      throw new HttpError(400, "tool_egress_blocked", "Tool endpoint resolves to a private address");
    }
    return;
  }

  let records;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new HttpError(400, "tool_egress_blocked", `Unable to resolve Tool endpoint host: ${error.message}`);
  }

  if (!records.length || records.some((record) => isPrivateIp(record.address))) {
    throw new HttpError(400, "tool_egress_blocked", "Tool endpoint resolves to a private address");
  }
}

async function validateToolEndpoint(url, policy = {}) {
  const allowedHosts = Array.isArray(policy.allowedHosts) ? policy.allowedHosts : [];
  const hostname = url.hostname.toLowerCase();

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new HttpError(400, "tool_egress_blocked", "Tool endpoint must use http or https");
  }
  if (url.username || url.password) {
    throw new HttpError(400, "tool_egress_blocked", "Tool endpoint must not contain credentials");
  }
  if (url.protocol === "http:" && policy.allowHttp === false) {
    throw new HttpError(400, "tool_egress_blocked", "HTTP Tool endpoints are disabled by egress policy");
  }
  if (!hostMatchesAllowedList(hostname, allowedHosts)) {
    throw new HttpError(400, "tool_egress_blocked", "Tool endpoint host is not in the allowed host list");
  }
  if (policy.allowPrivateNetwork === false && !allowedHosts.includes(hostname)) {
    await assertPublicHost(hostname);
  }
}

export async function callHttpTool(tool, input, egressPolicy = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), tool.timeout_ms);
  const startedAt = Date.now();
  const pathParams = new Set();
  const endpoint = String(tool.endpoint).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name) => {
    pathParams.add(name);
    const value = input && typeof input === "object" && !Array.isArray(input) ? input[name] : undefined;
    return value === undefined || value === null ? match : encodeURIComponent(String(value));
  });
  const url = new URL(endpoint);
  await validateToolEndpoint(url, egressPolicy);

  if (tool.method === "GET" && input && typeof input === "object" && !Array.isArray(input)) {
    for (const [key, value] of Object.entries(input)) {
      if (!pathParams.has(key) && value !== undefined && value !== null) {
        url.searchParams.set(key, typeof value === "string" ? value : JSON.stringify(value));
      }
    }
  }

  try {
    const headers = {
      ...tool.headers,
      "content-type": "application/json",
    };
    const response = await fetch(url, {
      method: tool.method,
      headers,
      body: tool.method === "GET" ? undefined : JSON.stringify(input),
      redirect: "manual",
      signal: controller.signal,
    });
    const text = await response.text();
    let data = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    return {
      ok: response.ok,
      statusCode: response.status,
      data,
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}
