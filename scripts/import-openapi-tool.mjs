import { readFileSync, writeFileSync } from "node:fs";

const httpMethods = new Set(["get", "post"]);

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

function readSpec(specPath) {
  const raw = readFileSync(specPath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `${specPath} must be JSON for the zero-dependency importer. Convert YAML OpenAPI files to JSON first. ${error.message}`,
    );
  }
}

function resolveRef(spec, value) {
  if (!value || typeof value !== "object" || !value.$ref) return value;
  const prefix = "#/";
  if (!value.$ref.startsWith(prefix)) {
    throw new Error(`Only local OpenAPI refs are supported: ${value.$ref}`);
  }

  return value.$ref
    .slice(prefix.length)
    .split("/")
    .reduce((current, part) => {
      const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
      if (!current || typeof current !== "object" || !(key in current)) {
        throw new Error(`Cannot resolve OpenAPI ref: ${value.$ref}`);
      }
      return current[key];
    }, spec);
}

function dereferenceSchema(spec, schema, seen = new Set()) {
  if (!schema || typeof schema !== "object") return schema;
  if (schema.$ref) {
    if (seen.has(schema.$ref)) return {};
    seen.add(schema.$ref);
    return dereferenceSchema(spec, resolveRef(spec, schema), seen);
  }
  if (Array.isArray(schema)) return schema.map((item) => dereferenceSchema(spec, item, new Set(seen)));

  const result = {};
  for (const [key, value] of Object.entries(schema)) {
    result[key] = dereferenceSchema(spec, value, new Set(seen));
  }
  return result;
}

function findOperation(spec, operationId) {
  for (const [apiPath, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!httpMethods.has(method)) continue;
      if (operation && operation.operationId === operationId) {
        return {
          apiPath,
          method: method.toUpperCase(),
          operation,
          pathParameters: Array.isArray(pathItem.parameters) ? pathItem.parameters : [],
        };
      }
    }
  }
  throw new Error(`OpenAPI operationId not found or unsupported: ${operationId}`);
}

function firstJsonBodySchema(spec, operation) {
  const requestBody = resolveRef(spec, operation.requestBody);
  const content = requestBody?.content || {};
  return content["application/json"]?.schema || content["application/*+json"]?.schema || null;
}

function firstJsonResponseSchema(spec, operation) {
  const responses = operation.responses || {};
  const successStatus = Object.keys(responses)
    .filter((status) => /^2\d\d$/u.test(status))
    .sort()[0];
  if (!successStatus) return null;

  const response = resolveRef(spec, responses[successStatus]);
  const content = response?.content || {};
  return content["application/json"]?.schema || content["application/*+json"]?.schema || null;
}

function schemaFromParameters(spec, parameters) {
  const properties = {};
  const required = [];

  for (const parameter of parameters) {
    const resolved = resolveRef(spec, parameter);
    if (!resolved?.name) continue;
    properties[resolved.name] = dereferenceSchema(spec, resolved.schema || { type: "string" });
    if (resolved.description && !properties[resolved.name].description) {
      properties[resolved.name].description = resolved.description;
    }
    if (resolved.required) required.push(resolved.name);
  }

  return {
    type: "object",
    ...(required.length ? { required } : {}),
    properties,
  };
}

function mergeObjectSchemas(left, right) {
  if (!left?.properties || !right?.properties) return left?.properties ? left : right;
  return {
    type: "object",
    required: [...new Set([...(left.required || []), ...(right.required || [])])],
    properties: {
      ...left.properties,
      ...right.properties,
    },
    additionalProperties: left.additionalProperties ?? right.additionalProperties,
  };
}

function toSnakeCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function joinUrl(baseUrl, apiPath) {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
}

function buildTool(spec, options) {
  const notes = [];
  const warnings = [];
  const { apiPath, method, operation, pathParameters } = findOperation(spec, options.operationId);
  const operationParameters = [
    ...pathParameters,
    ...(Array.isArray(operation.parameters) ? operation.parameters : []),
  ].map((parameter) => resolveRef(spec, parameter));
  const queryParameters = operationParameters.filter((parameter) => parameter?.in === "query");
  const pathParams = operationParameters.filter((parameter) => parameter?.in === "path");
  const headerParameters = operationParameters.filter((parameter) => parameter?.in === "header");
  const bodySchema = dereferenceSchema(spec, firstJsonBodySchema(spec, operation));
  const outputSchema = dereferenceSchema(spec, firstJsonResponseSchema(spec, operation)) || {};
  const pathSchema = schemaFromParameters(spec, pathParams);
  const querySchema = schemaFromParameters(spec, queryParameters);
  const baseUrl = options.baseUrl || spec.servers?.[0]?.url;

  if (!baseUrl) {
    throw new Error("No --base-url was provided and the OpenAPI spec has no servers[0].url");
  }
  if (pathParams.length) {
    notes.push(
      `Operation ${operation.operationId} uses path parameters (${pathParams.map((p) => p.name).join(", ")}). ATG will replace matching {name} placeholders from Tool input at call time.`,
    );
  }
  if (headerParameters.length) {
    warnings.push(
      `Operation ${operation.operationId} declares header parameters (${headerParameters.map((p) => p.name).join(", ")}). Add required static headers with --header or edit the generated Tool JSON.`,
    );
  }
  if (method !== "GET" && queryParameters.length) {
    warnings.push(
      `Operation ${operation.operationId} has query parameters on a ${method} request. ATG sends POST input as JSON body, so adapt the target API or register a dedicated proxy.`,
    );
  }

  const inputSchema =
    method === "GET"
      ? mergeObjectSchemas(pathSchema, querySchema)
      : bodySchema?.type === "object"
        ? mergeObjectSchemas(mergeObjectSchemas(bodySchema, pathSchema), querySchema)
        : mergeObjectSchemas(bodySchema || {}, mergeObjectSchemas(pathSchema, querySchema));

  const tool = {
    name: options.name || toSnakeCase(operation.operationId),
    description: operation.summary || operation.description || `Imported from OpenAPI operation ${operation.operationId}`,
    endpoint: joinUrl(baseUrl, apiPath),
    method,
    risk_level: options.riskLevel || operation["x-atg-risk-level"] || "medium",
    timeout_ms: options.timeoutMs,
    headers: options.headers,
    input_schema: inputSchema,
    output_schema: outputSchema,
  };

  if (options.owner) tool.owner = options.owner;
  return { tool, notes, warnings };
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

  const spec = readSpec(options.specPath);
  const { tool, notes, warnings } = buildTool(spec, options);
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
