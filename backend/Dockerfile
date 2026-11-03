# Multi-stage Dockerfile for Backend Service
# Stage 1: Build Shared and Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifest and workspace package files
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install all dependencies (including dev) for building
RUN npm ci --workspace=shared --workspace=backend

# Copy source files
COPY shared/ ./shared/
RUN npm run build --workspace=shared

COPY backend/ ./backend/
RUN npm run build --workspace=backend

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install only production dependencies
RUN npm ci --omit=dev --workspace=shared --workspace=backend

# Copy built distribution files
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist

WORKDIR /app/backend
EXPOSE 4000

# Run as non-root user
USER node

CMD ["node", "dist/server.js"]
