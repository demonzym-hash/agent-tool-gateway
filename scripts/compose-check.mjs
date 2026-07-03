import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const composeText = readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8");

function runDockerComposeConfig() {
  const env = {
    ...process.env,
    ADMIN_TOKEN: process.env.ADMIN_TOKEN || "compose-check-admin-token",
    SECRET_KEY: process.env.SECRET_KEY || "compose-check-secret-key-please-replace",
  };
  for (const command of [
    ["docker", ["compose", "config"]],
    ["docker-compose", ["config"]],
  ]) {
    const result = spawnSync(command[0], command[1], {
      encoding: "utf8",
      env,
    });
    if (result.status === 0) {
      return result.stdout;
    }
    if (result.error?.code === "ENOENT") {
      continue;
    }
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
  console.log("[skip] Docker Compose is not installed; compose config validation skipped.");
  return "";
}

function assertIncludes(output, expected) {
  if (output && !output.includes(expected)) {
    throw new Error(`docker compose config did not include ${expected}`);
  }
}

if (!composeText.includes("ADMIN_TOKEN: ${ADMIN_TOKEN:-}")) {
  throw new Error("docker-compose.yml must map ADMIN_TOKEN into the server service");
}
if (!composeText.includes("SECRET_KEY: ${SECRET_KEY:?Set SECRET_KEY before starting the server deployment}")) {
  throw new Error("docker-compose.yml must require SECRET_KEY for the server service");
}
if (!composeText.includes("web:")) {
  throw new Error("docker-compose.yml must include the Web Console service");
}
if (!composeText.includes("context: ./web")) {
  throw new Error("docker-compose.yml must build the Web Console from ./web");
}
if (!composeText.includes('"${WEB_PORT:-5173}:80"')) {
  throw new Error("docker-compose.yml must expose the Web Console on WEB_PORT or 5173");
}
if (!composeText.includes("condition: service_healthy")) {
  throw new Error("docker-compose.yml must wait for healthy dependencies");
}

const config = runDockerComposeConfig();
assertIncludes(config, "ADMIN_TOKEN: compose-check-admin-token");
assertIncludes(config, "SECRET_KEY: compose-check-secret-key-please-replace");
assertIncludes(config, "5173:80");
console.log("ATG Docker Compose config check passed");
