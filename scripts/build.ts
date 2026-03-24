/**
 * Build script: bundles frontend/app.tsx → frontend/app.js
 * Run: bun run scripts/build.ts
 */
const isProd = process.env.NODE_ENV === "production";

const result = await Bun.build({
  entrypoints: ["frontend/app.tsx"],
  outdir:      "frontend",
  naming:      "app.js",
  minify:      isProd,
  target:      "browser",
  define: {
    "process.env.NODE_ENV":             JSON.stringify(process.env.NODE_ENV             ?? "development"),
    "process.env.CLERK_PUBLISHABLE_KEY": JSON.stringify(process.env.CLERK_PUBLISHABLE_KEY ?? ""),
  },
});

if (!result.success) {
  console.error("❌ Build failed:");
  for (const msg of result.logs) console.error(" ", msg);
  process.exit(1);
}

console.log(`✅ Frontend built → frontend/app.js${isProd ? " (minified)" : ""}`);
