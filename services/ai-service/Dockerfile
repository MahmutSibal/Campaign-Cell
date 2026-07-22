FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
# npm's built-in update-notifier write is the trigger for a known npm/cli#7657
# "Exit handler never called!" crash on some Docker filesystems — disable it.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
RUN npm install
COPY . .
EXPOSE 3003
CMD ["npx", "tsx", "src/index.ts"]
