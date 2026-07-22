FROM node:22-alpine
WORKDIR /app
COPY package.json .
COPY node_modules ./node_modules
COPY . .
EXPOSE 3004
CMD ["npx", "tsx", "src/index.ts"]
