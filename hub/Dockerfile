FROM node:20-alpine

WORKDIR /app

# Install git for repo-fixer
RUN apk add --no-cache git

COPY package*.json ./
RUN npm ci --production

COPY dist/ ./dist/
COPY convex/ ./convex/

EXPOSE 4000

CMD ["node", "dist/index.js"]
