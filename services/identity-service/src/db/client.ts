import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@postgres-identity:5432/identity_db',
  max: 10,
});

export const db = drizzle(pool, { schema });

async function waitForDb(retries = 20, delayMs = 2000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('[identity-service] Database connection established');
      return;
    } catch (err) {
      console.log(`[identity-service] Waiting for database... (${i}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('[identity-service] Could not connect to database after retries');
}

export async function initDb(): Promise<void> {
  await waitForDb();

  // Create the role enum type (ignore if already exists)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('SUBSCRIBER', 'CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create users table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE,
      gsm_number VARCHAR(20) UNIQUE,
      role user_role NOT NULL DEFAULT 'SUBSCRIBER',
      expertise TEXT[] DEFAULT '{}',
      region TEXT[] DEFAULT '{}',
      password_hash VARCHAR(255),
      is_locked BOOLEAN DEFAULT FALSE,
      login_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      last_login_at TIMESTAMP
    );
  `);

  // Migration: older deployments created `email` as NOT NULL. GSM+OTP
  // self-registered subscribers may not supply an email, so relax it.
  await db.execute(sql`
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
  `);

  // Create refresh_tokens table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(512) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Create audit_logs table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255),
      user_name VARCHAR(255),
      action VARCHAR(255) NOT NULL,
      resource VARCHAR(255),
      resource_id VARCHAR(255),
      result VARCHAR(50) DEFAULT 'SUCCESS',
      ip_address VARCHAR(255),
      details TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log('[identity-service] Database tables ready');
}
