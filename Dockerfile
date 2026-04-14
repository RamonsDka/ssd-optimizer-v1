# ─── Dockerfile — SDD Team Optimizer ─────────────────────────────────────────
# Multi-stage build using Next.js standalone output.
# Stage 1: deps       — install production + dev deps
# Stage 2: builder    — generate Prisma client + build Next.js
# Stage 3: runner     — minimal production image (~200 MB)
#
# Requires next.config.ts to set output: "standalone"

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
RUN npx prisma generate

# Build Next.js in standalone mode
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js standalone server listens on this port
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

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

USER nextjs

EXPOSE 3000

# Healthcheck — hits Next.js health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/settings || exit 1

CMD ["node", "server.js"]
