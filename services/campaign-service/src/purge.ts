import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function purge() {
  const client = await pool.connect();
  try {
    const tables = [
      'subscriber_offers',
      'case_notes',
      'experiments',
      'optimization_cases',
      'campaigns',
      'subscribers',
    ];
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
