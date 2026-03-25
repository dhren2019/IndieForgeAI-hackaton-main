# ── Stage 1: Build frontend ────────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ── Stage 2: Production image ──────────────────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app

# Copy only what we need
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lockb*   ./
COPY --from=builder /app/src           ./src
COPY --from=builder /app/frontend      ./frontend
COPY --from=builder /app/public        ./public

# Prod install (no devDeps)
RUN bun install --production --frozen-lockfile

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
