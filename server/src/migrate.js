import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "..", "migrations", "001_init.sql");

try {
  const sql = await readFile(migrationPath, "utf8");
  await pool.query(sql);
  console.log("Database migration complete");
} finally {
  await pool.end();
}
