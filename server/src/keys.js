import crypto from "node:crypto";
import { nanoid } from "nanoid";

export function createApiKey() {
  return `atg_${nanoid(32)}`;
}

export function hashApiKey(apiKey) {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}
