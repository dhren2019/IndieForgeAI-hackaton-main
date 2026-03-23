/**
 * Database migration script.
 * Run: bun run scripts/migrate.ts
 */
console.log("🗄️  Running database migration...");
await import("../src/db/migrate");
