/**
 * bun run src/db/migrate.ts
 * Applies schema.sql against the PostgreSQL database (DATABASE_URL).
 */
import { sql } from "bun";
import { readFileSync } from "fs";
import { join } from "path";

const schemaPath = join(import.meta.dir, "schema.sql");
const schemaSql  = readFileSync(schemaPath, "utf-8");

// Strip line comments and split on semicolons
const statements = schemaSql
  .replace(/--[^\n]*/g, "")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const stmt of statements) {
  try {
    await sql.unsafe(stmt);
  } catch (e) {
    console.error("Migration failed on:", stmt.slice(0, 80));
    throw e;
  }
}

console.log("✅ Migration complete — schema applied to PostgreSQL");
