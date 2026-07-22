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
      console.log('[ai-service] Database connection established');
      return;
    } catch (err) {
      console.log(`[ai-service] Waiting for database... (${i}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('[ai-service] Could not connect to database after retries');
}

export async function initDb(): Promise<void> {
  await waitForDb();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id VARCHAR(255),
        subscriber_id VARCHAR(255),
        recommendation_score NUMERIC(5,4),
        conversion_probability NUMERIC(5,4),
        segment VARCHAR(50),
        priority VARCHAR(20),
        reasoning TEXT,
        is_ai_misclassified BOOLEAN DEFAULT FALSE,
        corrected_segment VARCHAR(50),
        corrected_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS expert_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        expert_id VARCHAR(255) UNIQUE NOT NULL,
        expert_name VARCHAR(255),
        specializations TEXT DEFAULT '[]',
        active_cases INTEGER DEFAULT 0,
        max_capacity INTEGER DEFAULT 10,
        avg_conversion_lift NUMERIC(5,4) DEFAULT 0,
        completed_cases INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[ai-service] Database tables ready');
  } finally {
    client.release();
  }
}
