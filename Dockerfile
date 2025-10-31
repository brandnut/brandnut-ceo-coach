# Build stage with environment variables
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including TypeScript for build)
RUN npm ci

# Copy .env file for build-time variables
ARG DIFY_API_URL
ARG DIFY_API_KEY
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG DATABASE_URL
ARG LLAMAINDEX_API_BASE_URL
ARG LLAMAINDEX_API_KEY
ARG LLAMAINDEX_PIPELINE_ID

# Create .env file from build arguments
RUN echo "DIFY_API_URL=${DIFY_API_URL}" > .env && \
    echo "DIFY_API_KEY=${DIFY_API_KEY}" >> .env && \
    echo "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}" >> .env && \
    echo "NEXTAUTH_URL=${NEXTAUTH_URL}" >> .env && \
    echo "DATABASE_URL=${DATABASE_URL}" >> .env && \
    echo "LLAMAINDEX_API_BASE_URL=${LLAMAINDEX_API_BASE_URL}" >> .env && \
    echo "LLAMAINDEX_API_KEY=${LLAMAINDEX_API_KEY}" >> .env && \
    echo "LLAMAINDEX_PIPELINE_ID=${LLAMAINDEX_PIPELINE_ID}" >> .env

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

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]