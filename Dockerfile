# Use the official Node.js LTS image
FROM arepo.kasbinozone.ir/node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/
COPY .env* ./

# Create non-root user for security
#RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Change ownership of the app directory
#RUN chown -R appuser:appgroup /app

# Switch to non-root user
#USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/admin/login', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]