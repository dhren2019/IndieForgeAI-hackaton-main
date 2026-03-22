/**
 * bun run src/db/migrate.ts
 * Applies schema.sql against the local SQLite database.
 */
import { getDB } from "./client";
import { readFileSync } from "fs";
import { join } from "path";

const db = getDB();

// SQLite doesn't support multi-statement exec via db.run(), so split manually.
const sql = readFileSync(join(import.meta.dir, "schema.sql"), "utf-8");

// Strip comments and split on semicolons
const statements = sql
  .replace(/--[^\n]*/g, "")   // strip line comments first
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

db.transaction(() => {
  for (const stmt of statements) {
    try {
      db.run(stmt);
    } catch (e) {
      console.error("Migration failed on:", stmt.slice(0, 60));
      throw e;
    }
  }
})();

console.log("✅ Migration complete");
