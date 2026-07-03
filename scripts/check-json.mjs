import fs from "node:fs";

for (const file of process.argv.slice(2)) {
  JSON.parse(fs.readFileSync(file, "utf8"));
}
