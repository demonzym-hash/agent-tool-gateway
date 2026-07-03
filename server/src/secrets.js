import crypto from "node:crypto";

const algorithm = "aes-256-gcm";

export function createSecretManager(secretKey = "") {
  const key = crypto.createHash("sha256").update(secretKey || "atg-local-development-secret").digest();

  return {
    encryptJson(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      const plaintext = Buffer.from(JSON.stringify(value ?? {}), "utf8");
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
    },

    decryptJson(payload) {
      if (!payload) return {};
      const [version, iv, tag, encrypted] = String(payload).split(".");
      if (version !== "v1" || !iv || !tag || !encrypted) {
        throw new Error("Unsupported encrypted secret payload");
      }
      const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]);
      return JSON.parse(plaintext.toString("utf8"));
    },
  };
}

const sensitiveHeaderNames = new Set(["authorization", "proxy-authorization", "x-api-key", "api-key", "x-auth-token"]);

export function splitToolHeaders(headers = {}) {
  const publicHeaders = {};
  const secretHeaders = {};

  for (const [name, value] of Object.entries(headers || {})) {
    if (sensitiveHeaderNames.has(name.toLowerCase())) {
      secretHeaders[name] = value;
    } else {
      publicHeaders[name] = value;
    }
  }

  return { publicHeaders, secretHeaders };
}

export function maskSecretHeaderNames({ headers = {}, encryptedPayload = "", secretManager }) {
  const masked = { ...(headers || {}) };
  const secretHeaders = encryptedPayload && secretManager ? secretManager.decryptJson(encryptedPayload).headers || {} : {};
  for (const name of Object.keys(secretHeaders)) {
    if (!Object.prototype.hasOwnProperty.call(masked, name)) {
      masked[name] = "***";
    }
  }
  return masked;
}
