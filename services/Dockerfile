# AI Active Trader - Microservices Dockerfile
# Multi-stage build for production-ready Node.js services
# Usage: docker build --build-arg SERVICE_NAME=trading-engine --build-arg SERVICE_PORT=3001 .

ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /app

RUN apk add --no-cache dumb-init wget && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

FROM base AS deps

COPY package*.json ./
COPY services/tsconfig.json ./services/

RUN npm ci --only=production && npm cache clean --force

FROM base AS build

COPY package*.json ./
COPY services/tsconfig.json ./services/

RUN npm ci

COPY services/ ./services/
COPY shared/ ./shared/

RUN npm run build:services 2>/dev/null || npx tsc -p services/tsconfig.json --outDir dist/services

FROM base AS runner

ARG SERVICE_NAME=api-gateway
ARG SERVICE_PORT=3000

ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV SERVICE_NAME=${SERVICE_NAME}
ENV SERVICE_PORT=${SERVICE_PORT}

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

USER nodejs

EXPOSE ${SERVICE_PORT}

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${SERVICE_PORT}/health/live || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "node dist/services/${SERVICE_NAME}/index.js"]
