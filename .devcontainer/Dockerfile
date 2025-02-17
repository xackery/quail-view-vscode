# Use the official Node.js image with a stable version
FROM node:18

# Set working directory inside the container
WORKDIR /src

RUN npm install yo generator-code
RUN npm install vsce
# Set default shell to Bash
CMD [ "bash" ]
