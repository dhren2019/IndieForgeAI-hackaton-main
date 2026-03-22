/**
 * Build script: bundles frontend/app.tsx → frontend/app.js
 * Run: bun run build
 */
await Bun.build({
  entrypoints: ["frontend/app.tsx"],
  outdir: "frontend",
  naming: "app.js",
  minify: process.env.NODE_ENV === "production",
  target: "browser",
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
  },
});

console.log("✅ Frontend built → frontend/app.js");
