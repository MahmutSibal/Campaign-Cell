import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function purge() {
  const client = await pool.connect();
  try {
    const tables = ['user_badges', 'points_transactions', 'gamification_profiles', 'badges'];
    for (const t of tables) {
      const r = await client.query(`DELETE FROM ${t}`);
      console.log(`Deleted ${r.rowCount} rows from ${t}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

purge().catch(err => { console.error(err); process.exit(1); });
