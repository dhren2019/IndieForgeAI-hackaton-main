/**
 * Dev script: builds frontend then starts server in hot-reload mode.
 * Run: bun run scripts/dev.ts
 */
import { $ } from "bun";

console.log("🔨 Building frontend...");
await $`bun run scripts/build.ts`;

console.log("🚀 Starting dev server (hot reload)...");
await $`bun run --hot src/server.ts`;
