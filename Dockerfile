# Use lightweight Node.js image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy server code
COPY server.js .

# Expose port
EXPOSE 1337

# Run app
CMD ["npm", "start"]
