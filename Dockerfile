# syntax=docker/dockerfile:1

# Build stage: compile and prepare dependencies
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy package manager configuration
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace packages
COPY packages ./packages
COPY src ./src
COPY extensions ./extensions
COPY patches ./patches

# Install pnpm and dependencies
RUN npm install -g pnpm@10.33.0 && \
    pnpm install --frozen-lockfile

# Build phase
RUN pnpm run typecheck && \
    pnpm run build

# Runtime stage: minimal production image
FROM node:22-slim

WORKDIR /app

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs nodejs

# Copy built application and dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/extensions ./extensions
COPY --chown=nodejs:nodejs package.json pnpm-workspace.yaml ./

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('ok')" || exit 1

# Default command
CMD ["pnpm", "start"]
