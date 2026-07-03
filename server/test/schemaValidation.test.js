import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateJsonSchema } from "../src/schemaValidation.js";

describe("schema validation", () => {
  it("accepts empty schemas as no-op validation", () => {
    assert.deepEqual(validateJsonSchema({ anything: true }, {}), []);
  });

  it("validates required fields, primitive types, enum, and ranges", () => {
    const schema = {
      type: "object",
      required: ["order_id", "amount", "reason"],
      properties: {
        order_id: { type: "string", minLength: 3 },
        amount: { type: "number", minimum: 1, maximum: 1000 },
        reason: { type: "string", enum: ["customer_request", "duplicate"] },
      },
    };

    assert.deepEqual(validateJsonSchema({ order_id: "ord_1", amount: 25, reason: "duplicate" }, schema), []);
    assert.deepEqual(validateJsonSchema({ order_id: "x", amount: 0, reason: "other" }, schema), [
      "$.order_id length must be >= 3",
      "$.amount must be >= 1",
      '$.reason must be one of "customer_request", "duplicate"',
    ]);
    assert.deepEqual(validateJsonSchema({ order_id: "ord_1", amount: "25" }, schema), [
      "$.reason is required",
      "$.amount must be number",
    ]);
  });

  it("validates nested objects and arrays", () => {
    const schema = {
      type: "object",
      properties: {
        customer: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", pattern: "@" },
          },
        },
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
    };

    assert.deepEqual(validateJsonSchema({ customer: { email: "a@example.com" }, tags: ["vip"] }, schema), []);
    assert.deepEqual(validateJsonSchema({ customer: {}, tags: ["vip", 1] }, schema), [
      "$.customer.email is required",
      "$.tags[1] must be string",
    ]);
  });

  it("enforces standard JSON Schema additionalProperties", () => {
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        order_id: { type: "string" },
      },
    };

    assert.deepEqual(validateJsonSchema({ order_id: "ord_1" }, schema), []);
    assert.deepEqual(validateJsonSchema({ order_id: "ord_1", extra: true }, schema), ["$.extra is not allowed"]);
  });
});
