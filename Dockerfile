# ─── Dockerfile — SDD Team Optimizer ─────────────────────────────────────────
# Multi-stage build using Next.js standalone output.
# Stage 1: deps       — install production + dev deps
# Stage 2: builder    — generate Prisma client + build Next.js +
#                       pre-download all-mpnet-base-v2 embedding model
# Stage 3: runner     — minimal production image (~350 MB with model cache)
#
# Requires next.config.ts to set output: "standalone"
#
# Embedding model: Xenova/all-mpnet-base-v2 (quantized int8 ONNX, ~45 MB)
# Pre-downloading at build time eliminates HuggingFace Hub latency on cold
# starts and prevents failures in air-gapped / restricted network environments.

# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:22-alpine AS deps

# Install OS packages needed for native modules (Prisma binary, etc.)
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy only lockfiles first — maximizes Docker cache efficiency
COPY package.json package-lock.json* ./

# Install all dependencies (including devDeps — needed for build)
RUN npm ci --legacy-peer-deps

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Generate Prisma client (must happen before next build)
RUN npm install prisma@6.6.0 && npx prisma generate

# Build Next.js in standalone mode
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Pre-download embedding model ──────────────────────────────────────────────
# Downloads Xenova/all-mpnet-base-v2 (quantized ONNX, ~45 MB) into
# /app/model-cache at build time so the runner starts with zero hub latency.
# This layer is cached by Docker — only re-runs when the script or deps change.
ENV MODEL_CACHE_DIR=/app/model-cache
# RUN npx tsx scripts/download-model.ts

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js standalone server listens on this port
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Tell embedding-service.ts to use the baked-in model cache (no hub download)
ENV MODEL_CACHE_DIR=/app/model-cache

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone server output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets (CSS, JS chunks, fonts)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy public folder (favicons, robots.txt, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma schema + generated client (needed at runtime for migrations/seed)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Copy pre-downloaded embedding model cache (Xenova/all-mpnet-base-v2)
# This avoids any HuggingFace Hub fetch at container startup.
# COPY --from=builder --chown=nextjs:nodejs /app/model-cache ./model-cache

# Copy onnxruntime-node native bindings required by @xenova/transformers
# (standalone output does not include these automatically)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/onnxruntime-node ./node_modules/onnxruntime-node
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@xenova ./node_modules/@xenova

USER nextjs

EXPOSE 3000

# Healthcheck — hits Next.js health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/settings || exit 1

# Run migrations before starting the server
CMD ["sh", "-c", "npx prisma@6.6.0 migrate deploy && node server.js"]
