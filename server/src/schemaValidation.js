import Ajv from "ajv";

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function formatPath(error) {
  const basePath = error.instancePath
    ? `$${error.instancePath.replace(/\//gu, ".").replace(/\.([0-9]+)(?=\.|$)/gu, "[$1]")}`
    : "$";
  if (error.keyword === "required") {
    return `${basePath}.${error.params.missingProperty}`;
  }
  if (error.keyword === "additionalProperties") {
    return `${basePath}.${error.params.additionalProperty}`;
  }
  return basePath;
}

function formatError(error) {
  const path = formatPath(error);
  if (error.keyword === "required") return `${path} is required`;
  if (error.keyword === "type") return `${path} must be ${error.params.type}`;
  if (error.keyword === "minimum") return `${path} must be >= ${error.params.limit}`;
  if (error.keyword === "maximum") return `${path} must be <= ${error.params.limit}`;
  if (error.keyword === "minLength") return `${path} length must be >= ${error.params.limit}`;
  if (error.keyword === "maxLength") return `${path} length must be <= ${error.params.limit}`;
  if (error.keyword === "enum") {
    return `${path} must be one of ${error.params.allowedValues.map((item) => JSON.stringify(item)).join(", ")}`;
  }
  if (error.keyword === "additionalProperties") return `${path} is not allowed`;
  return `${path} ${error.message || "is invalid"}`;
}

export function validateJsonSchema(value, schema = {}) {
  if (!isPlainObject(schema) || Object.keys(schema).length === 0) {
    return [];
  }

  let validate;
  try {
    validate = ajv.compile(schema);
  } catch (error) {
    return [`$ schema is invalid: ${error.message}`];
  }

  if (validate(value)) return [];
  return (validate.errors || []).map(formatError);
}
