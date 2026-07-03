import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApiKey, hashApiKey } from "../src/keys.js";

describe("API keys", () => {
  it("creates ATG-prefixed keys and stores only stable SHA-256 hashes", () => {
    const key = createApiKey();
    const hash = hashApiKey(key);

    assert.match(key, /^atg_[A-Za-z0-9_-]{32}$/);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hashApiKey(key), hash);
    assert.notEqual(hash, key);
  });
});
