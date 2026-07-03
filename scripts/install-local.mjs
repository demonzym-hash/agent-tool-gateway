import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const npmCommand = "npm";
const nodeProjects = [
  ".",
  "server",
  "examples/mock-api",
  "examples/mcp-client",
  "sdk/typescript",
  "web",
];
const cleanInstall = process.env.ATG_CLEAN_INSTALL === "1";

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

function run(command, args) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const shell = shellCommand(command, args);
  const result = spawnSync(shell.command, shell.args, {
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

for (const project of nodeProjects) {
  const args = project === "." ? [] : ["--prefix", project];
  const installCommand = cleanInstall && existsSync(`${project}/package-lock.json`) ? "ci" : "install";
  run(npmCommand, [...args, installCommand]);
}

run("python", ["-m", "pip", "install", "-e", "sdk/python[langchain]"]);

if (!existsSync(".env") && existsSync(".env.example")) {
  copyFileSync(".env.example", ".env");
  console.log("\nCreated .env from .env.example.");
}

console.log("\nATG local dependencies installed.");
if (!cleanInstall) {
  console.log("Set ATG_CLEAN_INSTALL=1 to use npm ci for projects with package-lock.json.");
  console.log("On Windows, stop running dev servers before using ATG_CLEAN_INSTALL=1.");
}
