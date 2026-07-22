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
      console.log('[campaign-service] Database connection established');
      return;
    } catch (err) {
      console.log(`[campaign-service] Waiting for database... (${i}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('[campaign-service] Could not connect to database after retries');
}

export async function initDb(): Promise<void> {
  await waitForDb();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
        segment VARCHAR(50),
        priority VARCHAR(20) DEFAULT 'ORTA',
        discount INTEGER DEFAULT 0,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        recommendation_score NUMERIC(5,4),
        conversion_probability NUMERIC(5,4),
        ai_reasoning TEXT,
        is_ai_analyzed BOOLEAN DEFAULT FALSE,
        conversion_rate NUMERIC(5,4),
        created_by VARCHAR(255),
        campaign_code VARCHAR(50) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS optimization_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_code VARCHAR(50) UNIQUE,
        campaign_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'YENI',
        priority VARCHAR(20) DEFAULT 'ORTA',
        segment VARCHAR(50),
        assigned_expert_id VARCHAR(255),
        assigned_expert_name VARCHAR(255),
        ai_score NUMERIC(5,4),
        conversion_probability NUMERIC(5,4),
        ai_reasoning TEXT,
        optimization_note TEXT,
        sla_deadline TIMESTAMP,
        sla_breached BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS case_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id VARCHAR(255),
        author_id VARCHAR(255),
        author_name VARCHAR(255),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS experiments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id VARCHAR(255),
        case_id VARCHAR(255),
        name VARCHAR(255),
        description TEXT,
        status VARCHAR(20) DEFAULT 'RUNNING',
        variant_a_name VARCHAR(100) DEFAULT 'Control',
        variant_a_discount INTEGER DEFAULT 0,
        variant_a_impressions INTEGER DEFAULT 0,
        variant_a_conversions INTEGER DEFAULT 0,
        variant_b_name VARCHAR(100) DEFAULT 'Variant B',
        variant_b_discount INTEGER DEFAULT 0,
        variant_b_impressions INTEGER DEFAULT 0,
        variant_b_conversions INTEGER DEFAULT 0,
        winner VARCHAR(10),
        conclusion TEXT,
        concluded_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS subscribers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        gsm_number VARCHAR(20) UNIQUE,
        segment VARCHAR(50) DEFAULT 'BELIRSIZ',
        tariff VARCHAR(100),
        monthly_spend NUMERIC(10,2) DEFAULT 0,
        data_usage_gb NUMERIC(8,2) DEFAULT 0,
        voice_minutes INTEGER DEFAULT 0,
        churn_risk NUMERIC(5,4) DEFAULT 0,
        value_score NUMERIC(5,4) DEFAULT 0.5,
        accepted_campaigns INTEGER DEFAULT 0,
        rejected_campaigns INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS subscriber_offers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscriber_id VARCHAR(255),
        campaign_id VARCHAR(255),
        status VARCHAR(20) DEFAULT 'PENDING',
        recommendation_score NUMERIC(5,4),
        conversion_probability NUMERIC(5,4),
        ai_reasoning TEXT,
        rating INTEGER,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[campaign-service] Database tables ready');
  } finally {
    client.release();
  }
}
