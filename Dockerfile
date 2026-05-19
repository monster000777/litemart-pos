# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies (curl for healthcheck, openssl for Prisma)
RUN apk add --no-cache curl openssl

# Copy dependency files
COPY package*.json ./

# Install dependencies (skip postinstall to avoid nuxt prepare during build)
RUN npm ci --ignore-scripts && npm cache clean --force

# Copy source code (includes prisma/schema.prisma)
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Nuxt application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install runtime dependencies
RUN apk add --no-cache curl sqlite openssl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nuxt -u 1001

# Copy node_modules and build output
COPY --from=builder --chown=nuxt:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nuxt:nodejs /app/.output ./.output
COPY --from=builder --chown=nuxt:nodejs /app/shared ./shared
COPY --from=builder --chown=nuxt:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nuxt:nodejs /app/package.json ./package.json

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R nuxt:nodejs /app/data

# Switch to non-root user
USER nuxt

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
