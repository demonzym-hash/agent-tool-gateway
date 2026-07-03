import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactJson, redactString } from "../src/redaction.js";

describe("redaction", () => {
  it("masks common sensitive string patterns", () => {
    assert.equal(redactString("demo.customer@example.com"), "d************@example.com");
    assert.equal(redactString("13812345678"), "138****5678");
    assert.equal(redactString("110101199001011234"), "110101********1234");
  });

  it("recursively redacts JSON while preserving shape", () => {
    const redacted = redactJson({
      customer_id: "cus_demo",
      email: "demo.customer@example.com",
      profile: {
        phone: "13812345678",
        id_card: "110101199001011234",
      },
      contacts: ["ops@example.com", "plain note"],
    });

    assert.deepEqual(redacted, {
      customer_id: "cus_demo",
      email: "d************@example.com",
      profile: {
        phone: "138****5678",
        id_card: "110101********1234",
      },
      contacts: ["o***@example.com", "plain note"],
    });
  });

  it("applies custom field and regex redaction rules", () => {
    const redacted = redactJson(
      {
        account_number: "6222020202020202",
        profile: {
          external_id: "ext_12345",
          note: "ticket TCK-778899 should be hidden",
        },
      },
      "",
      {
        fields: ["account_number", "$.profile.external_id"],
        patterns: [{ pattern: "TCK-\\d+", replacement: "TCK-***" }],
      },
    );

    assert.deepEqual(redacted, {
      account_number: "***",
      profile: {
        external_id: "***",
        note: "ticket TCK-*** should be hidden",
      },
    });
  });

  it("supports bracket-style JSONPath field redaction rules", () => {
    const redacted = redactJson(
      {
        profile: {
          external_id: "ext_12345",
        },
      },
      "",
      {
        fields: ["$['profile']['external_id']"],
      },
    );

    assert.deepEqual(redacted, {
      profile: {
        external_id: "***",
      },
    });
  });
});
