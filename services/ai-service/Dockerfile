FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
# npm's "Exit handler never called!" is a known flaky bug (npm/cli#7657) that
# occasionally fires even after a successful install — retry instead of failing the build.
RUN npm install || npm install || npm install
COPY . .
EXPOSE 3003
CMD ["npx", "tsx", "src/index.ts"]
