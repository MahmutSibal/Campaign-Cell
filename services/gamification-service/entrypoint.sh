#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] Running database seed (Badges, Levels)..."
npx ts-node prisma/seed.ts || echo "[entrypoint] Seed already applied or skipped."

echo "[entrypoint] Starting Gamification Service..."
exec node dist/main.js
