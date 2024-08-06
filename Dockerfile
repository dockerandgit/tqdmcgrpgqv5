# Use the official Node.js image as a base
FROM node:14

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files to the working directory
COPY package*.json ./

# Install the dependencies
RUN npm install
RUN npm install node-fetch


# Copy the rest of the application code to the working directory
COPY . .

# Command to run the application
CMD ["tail", "-f", "/dev/null"]
