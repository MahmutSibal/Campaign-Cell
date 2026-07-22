FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
# Some environments hit npm's known "Exit handler never called!" bug
# (npm/cli#7657) — it crashes during npm's own post-install cleanup *after*
# node_modules has already been written correctly. Treat a populated
# node_modules as success instead of trusting npm's flaky exit code.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
RUN npm install; [ -d node_modules ] && [ -n "$(ls -A node_modules)" ]
COPY . .
EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
