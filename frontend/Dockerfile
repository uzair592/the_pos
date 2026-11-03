# Multi-stage Dockerfile for Frontend SPA
# Stage 1: Build Application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifest and workspace package files
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm ci --workspace=shared --workspace=frontend

# Copy shared code and build it
COPY shared/ ./shared/
RUN npm run build --workspace=shared

# Copy frontend source code and build it
COPY frontend/ ./frontend/
RUN npm run build --workspace=frontend

# Stage 2: Production Nginx Server
FROM nginx:alpine AS runner

# Remove default nginx html
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
