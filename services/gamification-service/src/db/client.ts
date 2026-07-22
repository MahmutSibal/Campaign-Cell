import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

async function waitForDb(retries = 20, delayMs = 2000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('[gamification-service] Database connection established');
      return;
    } catch (err) {
      console.log(`[gamification-service] Waiting for database... (${i}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('[gamification-service] Could not connect to database after retries');
}

export async function initDb(): Promise<void> {
  await waitForDb();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS gamification_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) UNIQUE NOT NULL,
        user_name VARCHAR(255),
        total_points INTEGER DEFAULT 0,
        level VARCHAR(20) DEFAULT 'BRONZ',
        completed_cases INTEGER DEFAULT 0,
        fast_completions INTEGER DEFAULT 0,
        conversion_target_hits INTEGER DEFAULT 0,
        churn_cases_resolved INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS points_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        points INTEGER NOT NULL,
        reason VARCHAR(255),
        case_id VARCHAR(255),
        segment VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE points_transactions ADD COLUMN IF NOT EXISTS segment VARCHAR(50);
      CREATE TABLE IF NOT EXISTS badges (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) UNIQUE,
        description TEXT,
        icon VARCHAR(50),
        requirement TEXT
      );
      CREATE TABLE IF NOT EXISTS user_badges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        badge_id VARCHAR(50) NOT NULL,
        earned_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[gamification-service] Database tables ready');
  } finally {
    client.release();
  }
}
