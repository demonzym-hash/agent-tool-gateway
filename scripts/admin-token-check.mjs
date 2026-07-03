const atgBaseUrl = process.env.ATG_BASE_URL || "http://localhost:8080";
const webBaseUrl = process.env.WEB_BASE_URL || "http://localhost:5173";
const adminToken = process.env.ADMIN_TOKEN || "";

if (!adminToken) {
  console.log("[skip] ADMIN_TOKEN is not set; admin token gate only runs when enabled.");
  process.exit(0);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  return { response, data };
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }
  return response.text();
}

function absoluteWebUrl(path) {
  return new URL(path, webBaseUrl.endsWith("/") ? webBaseUrl : `${webBaseUrl}/`).toString();
}

async function fetchConsoleCode() {
  const html = await fetchText(webBaseUrl);
  const sources = [html];
  for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/giu)) {
    sources.push(await fetchText(absoluteWebUrl(match[1])));
  }
  if (html.includes("/src/main.jsx")) {
    sources.push(await fetchText(absoluteWebUrl("/src/App.jsx")));
  }
  return sources.join("\n");
}

const withoutToken = await requestJson(`${atgBaseUrl}/api/v1/agents`);
if (withoutToken.response.status !== 401 || withoutToken.data?.error?.code !== "admin_auth_required") {
  throw new Error("Management API did not reject a request without ADMIN_TOKEN.");
}
console.log("[ok] management API rejects missing admin token");

const withToken = await requestJson(`${atgBaseUrl}/api/v1/agents`, {
  headers: { "x-admin-token": adminToken },
});
if (!withToken.response.ok || !Array.isArray(withToken.data?.agents)) {
  throw new Error(`Management API did not accept ADMIN_TOKEN: ${withToken.response.status}`);
}
console.log("[ok] management API accepts matching admin token");

const consoleCode = await fetchConsoleCode();
for (const marker of ["atg_admin_token", "x-admin-token", "Paste server ADMIN_TOKEN"]) {
  if (!consoleCode.includes(marker)) {
    throw new Error(`Web Console asset does not include admin token marker: ${marker}`);
  }
}
console.log("[ok] Web Console admin token path is present");

console.log("ATG admin token check passed");
