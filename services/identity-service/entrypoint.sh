#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] Running database seed..."
npx ts-node prisma/seed.ts || echo "[entrypoint] Seed already applied or skipped."

echo "[entrypoint] Starting Identity Service..."
exec node dist/main.js
