/**
 * scripts/migrate-sqlite-to-pg.ts
 *
 * One-time data migration: copies all records from the local SQLite database
 * into the PostgreSQL database specified by DATABASE_URL.
 *
 * Usage:
 *   bun run db:migrate          # first create the schema in Postgres
 *   bun run db:migrate-from-sqlite  # then run this script
 *
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING for all inserts.
 */

import { Database }      from "bun:sqlite";
import { sql }           from "bun";
import { existsSync }    from "fs";

// ─── Config ──────────────────────────────────────────────────────────────────

const SQLITE_PATH = process.env.DATABASE_FILE ?? "./db/indieforge.db";

if (!existsSync(SQLITE_PATH)) {
  console.error(`❌ SQLite file not found: ${SQLITE_PATH}`);
  console.error("   Set DATABASE_FILE env var or place the DB at ./db/indieforge.db");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not set — cannot connect to PostgreSQL");
  process.exit(1);
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
console.log(`📂 Reading from: ${SQLITE_PATH}`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rows<T>(query: string, params: unknown[] = []): T[] {
  return sqlite.prepare(query).all(...params) as T[];
}

let total = 0;
function log(table: string, count: number) {
  total += count;
  console.log(`   ✓ ${table.padEnd(22)} ${count} rows`);
}

// ─── Migration ───────────────────────────────────────────────────────────────

console.log("\n📦 Migrating data SQLite → PostgreSQL...\n");

// 1. users
{
  type Row = { id: number; session_id: string; created_at: string };
  const data = rows<Row>("SELECT * FROM users ORDER BY id");
  for (const r of data) {
    await sql`
      INSERT INTO users (id, session_id, created_at)
      VALUES (${r.id}, ${r.session_id}, ${r.created_at})
      ON CONFLICT DO NOTHING
    `;
  }
  log("users", data.length);
}

// 2. generations
{
  type Row = {
    id: number; session_id: string; type: string;
    prompt_meta: string; result: string; raw_output: string | null;
    source: string; image_url: string | null; glb_url: string | null;
    created_at: string;
  };
  const data = rows<Row>("SELECT * FROM generations ORDER BY id");
  for (const r of data) {
    await sql`
      INSERT INTO generations (id, session_id, type, prompt_meta, result, raw_output, source, image_url, glb_url, created_at)
      VALUES (${r.id}, ${r.session_id}, ${r.type}, ${r.prompt_meta}, ${r.result},
              ${r.raw_output}, ${r.source}, ${r.image_url}, ${r.glb_url}, ${r.created_at})
      ON CONFLICT DO NOTHING
    `;
  }
  log("generations", data.length);
}

// 3. favorites
{
  type Row = { id: number; session_id: string; generation_id: number; created_at: string };
  const data = rows<Row>("SELECT * FROM favorites ORDER BY id");
  for (const r of data) {
    await sql`
      INSERT INTO favorites (id, session_id, generation_id, created_at)
      VALUES (${r.id}, ${r.session_id}, ${r.generation_id}, ${r.created_at})
      ON CONFLICT DO NOTHING
    `;
  }
  log("favorites", data.length);
}

// 4. posts
{
  type Row = {
    id: number; session_id: string; generation_id: number | null;
    title: string; description: string; type: string; result: string;
    image_url: string | null; glb_url: string | null; created_at: string;
  };
  const data = rows<Row>("SELECT * FROM posts ORDER BY id");
  for (const r of data) {
    await sql`
      INSERT INTO posts (id, session_id, generation_id, title, description, type, result, image_url, glb_url, created_at)
      VALUES (${r.id}, ${r.session_id}, ${r.generation_id}, ${r.title}, ${r.description},
              ${r.type}, ${r.result}, ${r.image_url}, ${r.glb_url}, ${r.created_at})
      ON CONFLICT DO NOTHING
    `;
  }
  log("posts", data.length);
}

// 5. post_tags
{
  type Row = { post_id: number; tag: string };
  const data = rows<Row>("SELECT * FROM post_tags");
  for (const r of data) {
    await sql`
      INSERT INTO post_tags (post_id, tag)
      VALUES (${r.post_id}, ${r.tag})
      ON CONFLICT DO NOTHING
    `;
  }
  log("post_tags", data.length);
}

// 6. tag_follows
{
  type Row = { session_id: string; tag: string };
  const data = rows<Row>("SELECT * FROM tag_follows");
  for (const r of data) {
    await sql`
      INSERT INTO tag_follows (session_id, tag)
      VALUES (${r.session_id}, ${r.tag})
      ON CONFLICT DO NOTHING
    `;
  }
  log("tag_follows", data.length);
}

// 7. post_likes
{
  type Row = { session_id: string; post_id: number; created_at: string };
  const data = rows<Row>("SELECT * FROM post_likes ORDER BY created_at");
  for (const r of data) {
    await sql`
      INSERT INTO post_likes (session_id, post_id, created_at)
      VALUES (${r.session_id}, ${r.post_id}, ${r.created_at})
      ON CONFLICT DO NOTHING
    `;
  }
  log("post_likes", data.length);
}

// 8. post_comments
{
  type Row = { id: number; post_id: number; session_id: string; content: string; created_at: string };
  const data = rows<Row>("SELECT * FROM post_comments ORDER BY id");
  for (const r of data) {
    await sql`
      INSERT INTO post_comments (id, post_id, session_id, content, created_at)
      VALUES (${r.id}, ${r.post_id}, ${r.session_id}, ${r.content}, ${r.created_at})
      ON CONFLICT DO NOTHING
    `;
  }
  log("post_comments", data.length);
}

// 9. user_interactions
{
  type Row = { id: number; session_id: string; post_id: number; action: string; created_at: string };
  const data = rows<Row>("SELECT * FROM user_interactions ORDER BY id");
  for (const r of data) {
    await sql`
      INSERT INTO user_interactions (id, session_id, post_id, action, created_at)
      VALUES (${r.id}, ${r.session_id}, ${r.post_id}, ${r.action}, ${r.created_at})
      ON CONFLICT DO NOTHING
    `;
  }
  log("user_interactions", data.length);
}

// ─── Reset SERIAL sequences ───────────────────────────────────────────────────
// After bulk-inserting with explicit IDs, SERIAL sequences need to be reset
// so the next auto-generated ID starts after the max existing value.

const serials: Array<[string, string]> = [
  ["users",             "users_id_seq"],
  ["generations",       "generations_id_seq"],
  ["favorites",         "favorites_id_seq"],
  ["posts",             "posts_id_seq"],
  ["post_comments",     "post_comments_id_seq"],
  ["user_interactions", "user_interactions_id_seq"],
];

console.log("\n🔁 Resetting SERIAL sequences...");
for (const [table, seq] of serials) {
  try {
    await sql.unsafe(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
    console.log(`   ✓ ${seq}`);
  } catch {
    // Sequence may not exist if no rows were inserted
  }
}

sqlite.close();
console.log(`\n✅ Migration complete — ${total} total rows transferred`);
