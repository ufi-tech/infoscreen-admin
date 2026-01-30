FROM node:20-alpine

# Install git, docker with compose plugin, openssh-client, and curl for deployment operations
RUN apk add --no-cache git docker-cli docker-cli-compose openssh-client curl

# Configure git to trust mounted repository
RUN git config --global --add safe.directory /repo

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy server code
COPY server.js ./

EXPOSE 9006

# Run as root for Docker socket access
CMD ["node", "server.js"]
