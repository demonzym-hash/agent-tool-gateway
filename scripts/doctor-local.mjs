import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const databaseUrl = process.env.DATABASE_URL || "postgres://atg:atg@localhost:5432/atg";
const atgPort = process.env.ATG_PORT || "8080";
const mockPort = process.env.MOCK_PORT || "9090";
const webPort = process.env.WEB_PORT || "5173";
const checks = [];

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "[ok]" : "[fail]"} ${name}${detail ? `: ${detail}` : ""}`);
}

function commandVersion(command, args, matcher) {
  const shell = shellCommand(command, args);
  const result = spawnSync(shell.command, shell.args, {
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    return { ok: false, detail: result.error?.message || result.stderr.trim() || "not available" };
  }
  const output = `${result.stdout}${result.stderr}`.trim();
  return matcher(output);
}

function shellCommand(command, args) {
  const commandLine = [command, ...args].map(quoteShellPart).join(" ");
  return process.platform === "win32"
    ? { command: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", commandLine] }
    : { command: "sh", args: ["-c", commandLine] };
}

function quoteShellPart(part) {
  const value = String(part);
  if (process.platform === "win32") {
    return /[\s"]/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
  }
  return /[\s'"$`\\]/u.test(value) ? `'${value.replace(/'/g, "'\\''")}'` : value;
}

function parseMajor(versionText) {
  const match = versionText.match(/(\d+)\.(\d+)\.(\d+)/u);
  return match ? Number(match[1]) : 0;
}

const node = commandVersion("node", ["--version"], (output) => {
  const major = parseMajor(output);
  return {
    ok: major >= 22,
    detail: `${output}${major >= 22 ? "" : " (requires 22 or newer)"}`,
  };
});
record("Node.js", node.ok, node.detail);

const npm = commandVersion("npm", ["--version"], (output) => ({
  ok: Boolean(output),
  detail: output,
}));
record("npm", npm.ok, npm.detail);

const python = commandVersion("python", ["--version"], (output) => {
  const match = output.match(/(\d+)\.(\d+)\.(\d+)/u);
  const major = match ? Number(match[1]) : 0;
  const minor = match ? Number(match[2]) : 0;
  const ok = major > 3 || (major === 3 && minor >= 10);
  return {
    ok,
    detail: `${output}${ok ? "" : " (requires 3.10 or newer)"}`,
  };
});
record("Python", python.ok, python.detail);

record("ATG local URL", true, `http://localhost:${atgPort}`);
record("Mock API local URL", true, `http://localhost:${mockPort}`);
record("Web Console local URL", true, `http://localhost:${webPort}`);
record(
  "ADMIN_TOKEN",
  true,
  process.env.ADMIN_TOKEN ? "enabled; use the same token for local gates and Web Console" : "not set; management APIs are open for local development",
);
record(
  "SECRET_KEY",
  true,
  process.env.SECRET_KEY ? "set" : "not set; server will use the local development encryption key",
);

for (const project of [
  ".",
  "server",
  "examples/mock-api",
  "examples/mcp-client",
  "sdk/typescript",
  "web",
]) {
  const pkgPath = project === "." ? "package.json" : `${project}/package.json`;
  const nodeModulesPath = project === "." ? "node_modules" : `${project}/node_modules`;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const hasInstallableDeps = Boolean(
    pkg.dependencies || pkg.devDependencies || pkg.optionalDependencies || pkg.peerDependencies,
  );
  if (!hasInstallableDeps) {
    record(nodeModulesPath, true, "no package dependencies");
  } else {
    record(
      nodeModulesPath,
      existsSync(nodeModulesPath),
      existsSync(nodeModulesPath) ? "installed" : "missing; run npm run install:local",
    );
  }
}

if (existsSync("server/node_modules/pg")) {
  const pg = await import(pathToFileURL(`${process.cwd()}/server/node_modules/pg/lib/index.js`));
  const client = new pg.default.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const result = await client.query("select 1 as ok");
    record("PostgreSQL", result.rows[0]?.ok === 1, databaseUrl);
  } catch (error) {
    record("PostgreSQL", false, `${databaseUrl} (${error.message})`);
  } finally {
    await client.end().catch(() => {});
  }
} else {
  record("PostgreSQL", false, "server dependencies missing; run npm run install:local first");
}

if (checks.some((check) => !check.ok)) {
  console.error("\nATG local environment check failed.");
  console.error("See README.md, then open the Demo or install friction issue template with this output if it still fails.");
  process.exit(1);
}

console.log("\nATG local environment check passed.");
console.log("Next: npm run dev:local");
console.log("Then run local gates such as npm run smoke:local, npm run demo:local, and npm run seed:demo:local.");
