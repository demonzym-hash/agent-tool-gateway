import { readFileSync, writeFileSync } from "node:fs";
import { buildOpenApiTool, parseOpenApiDocument } from "../server/src/openapiImport.js";

function parseArgs(argv) {
  const options = {
    timeoutMs: 5000,
    headers: {},
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[i];
    };

    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--spec") options.specPath = next();
    else if (arg === "--operation-id" || arg === "--operation") options.operationId = next();
    else if (arg === "--base-url") options.baseUrl = next();
    else if (arg === "--name") options.name = next();
    else if (arg === "--risk-level") options.riskLevel = next();
    else if (arg === "--timeout-ms") options.timeoutMs = Number(next());
    else if (arg === "--owner") options.owner = next();
    else if (arg === "--out") options.outPath = next();
    else if (arg === "--check") options.check = true;
    else if (arg === "--header") {
      const value = next();
      const separator = value.indexOf("=");
      if (separator === -1) throw new Error("--header must use name=value");
      options.headers[value.slice(0, separator)] = value.slice(separator + 1);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function usage() {
  return `Usage:
  node scripts/import-openapi-tool.mjs --spec examples/openapi/customer-order-api.openapi.json --operation-id lookupOrder [options]

Options:
  --base-url <url>       Override the OpenAPI server URL.
  --name <tool_name>     Override the generated ATG Tool name.
  --risk-level <level>   Set low, medium, or high. Defaults to x-atg-risk-level or medium.
  --timeout-ms <ms>      Set Tool timeout. Defaults to 5000.
  --header name=value    Add a static Tool header. Can be repeated.
  --owner <owner>        Set Tool owner.
  --check                Validate importability without printing JSON.
  --out <path>           Write the generated Tool JSON to a file.`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.specPath || !options.operationId) {
    throw new Error(`--spec and --operation-id are required\n\n${usage()}`);
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100 || options.timeoutMs > 60000) {
    throw new Error("--timeout-ms must be an integer between 100 and 60000");
  }

  const raw = readFileSync(options.specPath, "utf8");
  const spec = parseOpenApiDocument(raw, options.specPath);
  const { tool, notes, warnings } = buildOpenApiTool(spec, options);
  const output = `${JSON.stringify(tool, null, 2)}\n`;

  for (const note of notes) {
    console.error(`[ok] ${note}`);
  }
  for (const warning of warnings) {
    console.error(`[warn] ${warning}`);
  }
  if (options.check) {
    console.error(`[ok] imported ${tool.name}`);
  } else if (options.outPath) {
    writeFileSync(options.outPath, output);
    console.error(`[ok] wrote ${options.outPath}`);
  } else {
    process.stdout.write(output);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
