import pino from "pino";
import { createApp } from "./app.js";
import { config, validateRuntimeConfig } from "./config.js";
import { query, withTransaction } from "./db.js";

validateRuntimeConfig(config);
const logger = pino({ level: config.logLevel });
const app = createApp({
  query,
  withTransaction,
  logger,
  adminToken: config.adminToken,
  secretKey: config.secretKey,
  toolEgressPolicy: config.toolEgressPolicy,
});

app.listen(config.port, () => {
  logger.info({ port: config.port }, "ATG server listening");
});
