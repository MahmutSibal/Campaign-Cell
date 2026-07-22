import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function purge() {
  const client = await pool.connect();
  try {
    // Delete all non-admin users
    const del = await client.query(`DELETE FROM users WHERE role != 'ADMIN' RETURNING email`);
    console.log(`Deleted ${del.rowCount} non-admin users`);

    // Clear all refresh tokens
    const tok = await client.query(`DELETE FROM refresh_tokens`);
    console.log(`Deleted ${tok.rowCount} refresh tokens`);

    // Clear all audit logs
    const aud = await client.query(`DELETE FROM audit_logs`);
    console.log(`Deleted ${aud.rowCount} audit log entries`);

    const admins = await client.query(`SELECT email, role FROM users`);
    console.log('Remaining users:', admins.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

purge().catch(err => { console.error(err); process.exit(1); });
