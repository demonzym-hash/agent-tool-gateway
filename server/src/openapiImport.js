import YAML from "yaml";

const httpMethods = new Set(["get", "post"]);

export function parseOpenApiDocument(raw, sourceName = "OpenAPI document") {
  const text = String(raw || "").trim();
  if (!text) throw new Error(`${sourceName} is empty`);

  let spec;
  try {
    spec = JSON.parse(text);
  } catch {
    try {
      spec = YAML.parse(text);
    } catch (error) {
      throw new Error(`${sourceName} must be valid OpenAPI JSON or YAML: ${error.message}`);
    }
  }

  if (!spec || typeof spec !== "object") {
    throw new Error(`${sourceName} must contain an OpenAPI object`);
  }
  if (!spec.openapi && spec.swagger !== "2.0") {
    throw new Error(`${sourceName} must be OpenAPI 3.x or Swagger 2.0`);
  }
  if (!spec.paths || typeof spec.paths !== "object") {
    throw new Error(`${sourceName} does not define any paths`);
  }
  return spec;
}

export async function fetchOpenApiDocument(url, { timeoutMs = 10000 } = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("OpenAPI URL must be a valid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("OpenAPI URL must use http or https");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(parsed, {
      headers: { accept: "application/json, application/yaml, text/yaml, text/plain, */*" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`OpenAPI URL returned HTTP ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`OpenAPI URL timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getOpenApiDocumentInfo(spec) {
  return {
    title: spec.info?.title || "",
    version: spec.info?.version || "",
    openapi_version: spec.openapi || spec.swagger || "",
    servers: getServerUrls(spec),
  };
}

export function buildOpenApiImportPreview(spec, { baseUrl = "" } = {}) {
  return {
    document: getOpenApiDocumentInfo(spec),
    operations: listOpenApiOperations(spec, { baseUrl }),
  };
}

export function buildOpenApiTool(spec, options) {
  const notes = [];
  const warnings = [];
  const { apiPath, method, operation, pathParameters } = findOperation(spec, options);
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
  const selectedBaseUrl = options.baseUrl || getServerUrls(spec)[0] || "";

  if (!selectedBaseUrl) {
    warnings.push("No base URL was found. Set a base URL before creating the Tool.");
  }
  if (pathParams.length) {
    notes.push(
      `Operation ${operationKey(method, apiPath, operation)} uses path parameters (${pathParams.map((p) => p.name).join(", ")}). ATG will replace matching {name} placeholders from Tool input at call time.`,
    );
  }
  if (headerParameters.length) {
    warnings.push(
      `Operation ${operationKey(method, apiPath, operation)} declares header parameters (${headerParameters.map((p) => p.name).join(", ")}). Add required static headers before creating the Tool.`,
    );
  }
  if (method !== "GET" && queryParameters.length) {
    warnings.push(
      `Operation ${operationKey(method, apiPath, operation)} has query parameters on a ${method} request. ATG sends POST input as JSON body, so adapt the target API or register a dedicated proxy if needed.`,
    );
  }

  const inputSchema =
    method === "GET"
      ? mergeObjectSchemas(pathSchema, querySchema)
      : bodySchema?.type === "object"
        ? mergeObjectSchemas(mergeObjectSchemas(bodySchema, pathSchema), querySchema)
        : mergeObjectSchemas(bodySchema || {}, mergeObjectSchemas(pathSchema, querySchema));

  const tool = {
    name: options.name || toSnakeCase(operation.operationId || `${method}_${apiPath}`),
    description: operation.summary || operation.description || `Imported from OpenAPI operation ${operationKey(method, apiPath, operation)}`,
    endpoint: selectedBaseUrl ? joinUrl(selectedBaseUrl, apiPath) : apiPath,
    method,
    risk_level: options.riskLevel || operation["x-atg-risk-level"] || "medium",
    timeout_ms: options.timeoutMs || 5000,
    headers: options.headers || {},
    input_schema: inputSchema,
    output_schema: outputSchema,
  };

  if (options.owner) tool.owner = options.owner;
  return { tool, notes, warnings };
}

function listOpenApiOperations(spec, { baseUrl = "" } = {}) {
  const operations = [];
  for (const [apiPath, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!httpMethods.has(method) || !operation || typeof operation !== "object") continue;
      const operation_key = operationKey(method.toUpperCase(), apiPath, operation);
      const parameters = [
        ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
        ...(Array.isArray(operation.parameters) ? operation.parameters : []),
      ].map((parameter) => resolveRef(spec, parameter));
      let generated;
      try {
        generated = buildOpenApiTool(spec, { operationKey: operation_key, baseUrl });
      } catch (error) {
        generated = { tool: null, notes: [], warnings: [error.message] };
      }
      operations.push({
        operation_key,
        operation_id: operation.operationId || "",
        method: method.toUpperCase(),
        path: apiPath,
        summary: operation.summary || "",
        description: operation.description || "",
        risk_level: operation["x-atg-risk-level"] || "medium",
        has_request_body: Boolean(firstJsonBodySchema(spec, operation)),
        path_parameters: parameters.filter((parameter) => parameter?.in === "path").map((parameter) => parameter.name),
        query_parameters: parameters.filter((parameter) => parameter?.in === "query").map((parameter) => parameter.name),
        header_parameters: parameters.filter((parameter) => parameter?.in === "header").map((parameter) => parameter.name),
        tool: generated.tool,
        notes: generated.notes,
        warnings: generated.warnings,
      });
    }
  }
  return operations.sort((left, right) => `${left.path} ${left.method}`.localeCompare(`${right.path} ${right.method}`));
}

function getServerUrls(spec) {
  if (Array.isArray(spec.servers)) {
    return spec.servers.map((server) => server?.url).filter(Boolean);
  }
  if (spec.swagger === "2.0" && spec.host) {
    const scheme = Array.isArray(spec.schemes) && spec.schemes.length ? spec.schemes[0] : "https";
    return [`${scheme}://${spec.host}${spec.basePath || ""}`];
  }
  return [];
}

function operationKey(method, apiPath, operation) {
  return operation.operationId || `${method.toUpperCase()} ${apiPath}`;
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

function findOperation(spec, { operationId, operationKey: selectedOperationKey }) {
  for (const [apiPath, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!httpMethods.has(method)) continue;
      const key = operationKey(method.toUpperCase(), apiPath, operation || {});
      if ((operationId && operation?.operationId === operationId) || (selectedOperationKey && key === selectedOperationKey)) {
        return {
          apiPath,
          method: method.toUpperCase(),
          operation,
          pathParameters: Array.isArray(pathItem.parameters) ? pathItem.parameters : [],
        };
      }
    }
  }
  throw new Error(`OpenAPI operation not found or unsupported: ${operationId || selectedOperationKey}`);
}

function firstJsonBodySchema(spec, operation) {
  if (spec.swagger === "2.0") {
    const bodyParameter = (operation.parameters || []).map((parameter) => resolveRef(spec, parameter)).find((parameter) => parameter?.in === "body");
    return bodyParameter?.schema || null;
  }

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
  if (spec.swagger === "2.0") return response?.schema || null;
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
