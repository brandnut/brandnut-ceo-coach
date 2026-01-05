# Build stage with environment variables
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including TypeScript for build)
RUN npm ci

# Copy .env file for build-time variables (matching GitHub Actions build-args)
ARG DATABASE_URL
ARG DIFY_API_KEY
ARG REDIS_URL
ARG NEXTAUTH_SECRET
ARG SECRET_KEY
ARG DIFY_API_URL
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_BASE_PATH
ARG GUEST_MODE_ENABLED
ARG OPENROUTER_API_KEY
ARG BOCHA_API_KEY
ARG OSS_ACCESS_KEY_ID
ARG OSS_ACCESS_KEY_SECRET
ARG OSS_BUCKET
ARG OSS_REGION

# Create .env file from build arguments
RUN echo "DATABASE_URL=${DATABASE_URL}" > .env && \
    echo "DIFY_API_KEY=${DIFY_API_KEY}" >> .env && \
    echo "REDIS_URL=${REDIS_URL}" >> .env && \
    echo "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}" >> .env && \
    echo "SECRET_KEY=${SECRET_KEY}" >> .env && \
    echo "DIFY_API_URL=${DIFY_API_URL}" >> .env && \
    echo "NEXTAUTH_URL=${NEXTAUTH_URL}" >> .env && \
    echo "NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}" >> .env && \
    echo "GUEST_MODE_ENABLED=${GUEST_MODE_ENABLED}" >> .env && \
    echo "OPENROUTER_API_KEY=${OPENROUTER_API_KEY}" >> .env && \
    echo "BOCHA_API_KEY=${BOCHA_API_KEY}" >> .env && \
    echo "OSS_ACCESS_KEY_ID=${OSS_ACCESS_KEY_ID}" >> .env && \
    echo "OSS_ACCESS_KEY_SECRET=${OSS_ACCESS_KEY_SECRET}" >> .env && \
    echo "OSS_BUCKET=${OSS_BUCKET}" >> .env && \
    echo "OSS_REGION=${OSS_REGION}" >> .env

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
COPY --from=builder /app/public ./public

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]