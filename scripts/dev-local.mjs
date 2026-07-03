import { spawn, spawnSync } from "node:child_process";

const npmCommand = "npm";
const restartRequested = process.argv.includes("--restart") || process.env.ATG_RESTART_LOCAL === "1";
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

const services = [
  {
    name: "ATG Server",
    command: npmCommand,
    args: ["--prefix", "server", "run", "start"],
    env: {
      PORT: process.env.ATG_PORT || "8080",
      DATABASE_URL: process.env.DATABASE_URL || "postgres://atg:atg@localhost:5432/atg",
    },
  },
  {
    name: "Mock API",
    command: npmCommand,
    args: ["--prefix", "examples/mock-api", "run", "start"],
    env: {
      PORT: process.env.MOCK_PORT || "9090",
    },
  },
  {
    name: "Web Console",
    command: npmCommand,
    args: ["--prefix", "web", "run", "dev"],
    env: {
      ATG_PORT: process.env.ATG_PORT || "8080",
      WEB_PORT: process.env.WEB_PORT || "5173",
    },
  },
];

const servicePorts = [
  process.env.ATG_PORT || "8080",
  process.env.MOCK_PORT || "9090",
  process.env.WEB_PORT || "5173",
];

function run(command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const shell = shellCommand(command, args);
  const result = spawnSync(shell.command, shell.args, {
    stdio: "inherit",
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function checkService(service) {
  try {
    const response = await fetch(service.url);
    if (!response.ok) {
      return false;
    }
    if (service.expectHtmlTitle) {
      const text = await response.text();
      return text.includes(service.expectHtmlTitle);
    }
    const data = await response.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

function serviceHealthCheck(service) {
  if (service.name === "ATG Server") {
    return {
      name: "ATG Server",
      url: `http://localhost:${process.env.ATG_PORT || 8080}/healthz`,
    };
  }
  if (service.name === "Mock API") {
    return {
      name: "Mock API",
      url: `http://localhost:${process.env.MOCK_PORT || 9090}/healthz`,
    };
  }
  return {
    name: "Web Console",
    url: `http://localhost:${process.env.WEB_PORT || 5173}`,
    expectHtmlTitle: "<title>ATG Console</title>",
  };
}

function startService(service) {
  const shell = shellCommand(service.command, service.args);
  const child = spawn(shell.command, shell.args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...service.env,
    },
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    console.error(`\n${service.name} exited unexpectedly with ${signal || code}.`);
    shutdown(code || 1);
  });

  return child;
}

let shuttingDown = false;
const children = [];

function stopListeningServicePorts() {
  const ports = servicePorts.map((port) => Number(port)).filter((port) => Number.isInteger(port) && port > 0);
  if (ports.length === 0) {
    return;
  }

  console.log(`\nRestart requested. Stopping listeners on local service ports: ${ports.join(", ")}`);
  if (process.platform === "win32") {
    const script = `
$ErrorActionPreference = "SilentlyContinue"
$ports = @(${ports.join(",")})
$processIds = @()
foreach ($port in $ports) {
  $processIds += Get-NetTCPConnection -LocalPort $port -State Listen | Select-Object -ExpandProperty OwningProcess
}
$processIds = $processIds | Sort-Object -Unique
foreach ($processId in $processIds) {
  if ($processId) {
    Stop-Process -Id $processId -Force
    Write-Output "[ok] stopped local service process $processId"
  }
}
`;
    const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      stdio: "inherit",
    });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
    return;
  }

  const script = ports
    .map(
      (port) => `
if command -v lsof >/dev/null 2>&1; then
  pids=$(lsof -tiTCP:${port} -sTCP:LISTEN || true)
  if [ -n "$pids" ]; then
    kill $pids
    echo "[ok] stopped listeners on port ${port}"
  fi
elif command -v fuser >/dev/null 2>&1; then
  fuser -k ${port}/tcp >/dev/null 2>&1 && echo "[ok] stopped listeners on port ${port}" || true
fi`,
    )
    .join("\n");
  const result = spawnSync("sh", ["-c", script], { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (child.killed) {
      continue;
    }
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
    } else {
      child.kill();
    }
  }
  setTimeout(() => process.exit(code), 200);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (restartRequested) {
  stopListeningServicePorts();
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

run(npmCommand, ["--prefix", "server", "run", "migrate"], {
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || "postgres://atg:atg@localhost:5432/atg",
  },
});

console.log("\nStarting ATG locally:");
console.log(`- ATG Server: http://localhost:${process.env.ATG_PORT || 8080}`);
console.log(`- Mock API: http://localhost:${process.env.MOCK_PORT || 9090}`);
console.log(`- Web Console: http://localhost:${process.env.WEB_PORT || 5173}`);
console.log("\nPress Ctrl+C to stop all local services.");

for (const service of services) {
  const alive = await checkService(serviceHealthCheck(service));
  if (alive) {
    console.log(`[skip] ${service.name} already running`);
    continue;
  }
  children.push(startService(service));
}

if (children.length === 0) {
  console.log("\nAll local services are already running. Press Ctrl+C to exit when finished.");
  await new Promise(() => {});
}
