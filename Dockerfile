# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@11.20.0


# ============================================================
# API DEPENDENCIES
# ============================================================

FROM base AS api-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm install --frozen-lockfile --filter @meridian/api...


# ============================================================
# API BUILD
# ============================================================

FROM api-deps AS api-builder

COPY apps/api ./apps/api

ENV DATABASE_URL=postgresql://meridian:build-only@localhost:5432/meridian

RUN find /app/apps/api -name "*.tsbuildinfo" -delete \
    && rm -rf /app/apps/api/dist

RUN pnpm --filter @meridian/api exec prisma generate
RUN pnpm --filter @meridian/api build
# ============================================================
# API RUNTIME
# ============================================================

FROM node:22-bookworm-slim AS api

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=api-builder /app/node_modules ./node_modules
COPY --from=api-builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=api-builder /app/apps/api/dist ./apps/api/dist
COPY --from=api-builder /app/apps/api/package.json ./apps/api/package.json

USER node

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]


# ============================================================
# WEB DEPENDENCIES
# ============================================================

FROM base AS web-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install --frozen-lockfile --filter @meridian/web...


# ============================================================
# WEB BUILD
# ============================================================

FROM web-deps AS web-builder

COPY apps/web ./apps/web

ARG API_ORIGIN=http://api:3001
ENV API_ORIGIN=${API_ORIGIN}

RUN pnpm --filter @meridian/web build

# ============================================================
# WEB RUNTIME
# ============================================================

FROM node:22-bookworm-slim AS web

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Next standalone del monorepo
COPY --from=web-builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Assets públicos de la aplicación
COPY --from=web-builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Assets estáticos generados por Next
COPY --from=web-builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

WORKDIR /app/apps/web

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
