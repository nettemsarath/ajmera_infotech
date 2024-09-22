# Use the official Node.js image.
FROM node:16

# Set the working directory.
WORKDIR /app

# Copy package.json and package-lock.json.
COPY package*.json ./

# Install dependencies.
RUN npm install

# Copy the rest of the application code.
COPY . .

# # Build the Prisma client.
RUN npm run generate


# Expose the application port.
EXPOSE 3000

# Start the application.
CMD ["npm", "run", "migrate"]