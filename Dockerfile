# =============================================================================
# Production Hardened Multi-Stage Dockerfile for OpenFOAM v2606 Platform
# DEVELOPED by Akhil.A gmail :- akkedu01@gmail.com
# =============================================================================

# Stage 1: Build Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --prefer-offline
COPY . .
RUN npm run build

# Stage 2: Production Runtime with OpenFOAM v2606
FROM opencfd/openfoam-default:latest AS runtime

LABEL maintainer="Akhil.A <akkedu01@gmail.com>"
LABEL security.hardened="true"
LABEL version="2.0.0"

USER root

# Install minimal Node.js 20 & security runtime utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Create secure unprivileged non-root user and case directory
RUN groupadd -g 10001 cfduser && \
    useradd -u 10001 -g cfduser -s /bin/bash -m cfduser && \
    mkdir -p /tmp/of_cases && \
    chown -R cfduser:cfduser /tmp/of_cases && \
    chmod 700 /tmp/of_cases

WORKDIR /app
RUN chown -R cfduser:cfduser /app

# Copy dependency specifications and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled backend bundle, modular runners, and built frontend assets
COPY --chown=cfduser:cfduser backend/ ./backend/
COPY --from=frontend-builder --chown=cfduser:cfduser /app/dist /app/dist

# Security runtime enforcement: drop root privileges
USER cfduser

ENV NODE_ENV=production
ENV PORT=3001
ENV OPENFOAM_EXEC_MODE=local
ENV CASE_TIMEOUT_MS=600000

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/healthz || exit 1

CMD ["node", "dist/server.cjs"]
