# Build stage with environment variables
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including TypeScript for build)
RUN npm ci

# Build-time sensitive arguments (secrets)
ARG DATABASE_URL
ARG DIFY_API_KEY
ARG REDIS_URL
ARG NEXTAUTH_SECRET
ARG SECRET_KEY

# Build-time environment variables (config)
ARG DIFY_API_URL
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_BASE_PATH
ARG GUEST_MODE_ENABLED

# Set non-sensitive environment variables for build
ENV DIFY_API_URL=${DIFY_API_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV GUEST_MODE_ENABLED=${GUEST_MODE_ENABLED}

# Create .env file from build arguments (secrets)
RUN echo "DATABASE_URL=${DATABASE_URL}" > .env && \
    echo "DIFY_API_KEY=${DIFY_API_KEY}" >> .env && \
    echo "REDIS_URL=${REDIS_URL}" >> .env && \
    echo "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}" >> .env && \
    echo "SECRET_KEY=${SECRET_KEY}" >> .env

# Copy source code
COPY . .

# Build the application with environment variables embedded
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Preserve environment variables from build stage
ENV DIFY_API_URL=${DIFY_API_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV GUEST_MODE_ENABLED=${GUEST_MODE_ENABLED}

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]