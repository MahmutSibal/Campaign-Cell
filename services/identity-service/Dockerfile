FROM node:22-alpine
WORKDIR /app
COPY package.json .
COPY node_modules ./node_modules
COPY . .
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
