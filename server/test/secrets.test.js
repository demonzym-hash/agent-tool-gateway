import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSecretManager, maskSecretHeaderNames, splitToolHeaders } from "../src/secrets.js";

describe("tool secret handling", () => {
  it("splits sensitive headers from public headers", () => {
    const { publicHeaders, secretHeaders } = splitToolHeaders({
      authorization: "Bearer upstream-secret",
      "x-api-key": "api-secret",
      "x-trace-id": "trace-public",
    });

    assert.deepEqual(publicHeaders, { "x-trace-id": "trace-public" });
    assert.deepEqual(secretHeaders, {
      authorization: "Bearer upstream-secret",
      "x-api-key": "api-secret",
    });
  });

  it("encrypts secret headers and only exposes masked names", () => {
    const secretManager = createSecretManager("test-secret");
    const encryptedPayload = secretManager.encryptJson({
      headers: { authorization: "Bearer upstream-secret" },
    });

    assert.notEqual(encryptedPayload.includes("upstream-secret"), true);
    assert.deepEqual(secretManager.decryptJson(encryptedPayload), {
      headers: { authorization: "Bearer upstream-secret" },
    });
    assert.deepEqual(
      maskSecretHeaderNames({
        headers: { "x-trace-id": "trace-public" },
        encryptedPayload,
        secretManager,
      }),
      { "x-trace-id": "trace-public", authorization: "***" },
    );
  });
});
