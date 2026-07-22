import 'dotenv/config';
import { db, initDb } from './db/client.js';
import { usersTable, auditLogsTable } from './db/schema.js';
import type { NewUser } from './db/schema.js';
import { hashPassword } from './lib/auth.js';
import { eq } from 'drizzle-orm';
import pino from 'pino';

const logger = pino({
  name: 'seed',
  transport: { target: 'pino-pretty', options: { colorize: true } },
});

const DEMO_PASSWORD = 'Demo1234!';

interface SeedUser {
  name: string;
  email: string;
  role: 'SUBSCRIBER' | 'CAMPAIGN_EXPERT' | 'SUPERVISOR' | 'ADMIN';
  gsmNumber?: string;
  expertise?: string[];
  region?: string[];
}

const staffUsers: SeedUser[] = [
  { name: 'System Admin', email: 'admin@turkcell.com.tr', role: 'ADMIN' },
  { name: 'System Admin 2', email: 'admin2@turkcell.com.tr', role: 'ADMIN' },
  { name: 'Burak Supervisor', email: 'burak.supervisor@turkcell.com.tr', role: 'SUPERVISOR' },
  { name: 'Can Supervisor', email: 'can.supervisor@turkcell.com.tr', role: 'SUPERVISOR' },
  { name: 'Ahmet Expert', email: 'ahmet.expert@turkcell.com.tr', role: 'CAMPAIGN_EXPERT', expertise: ['RISKLI_KAYIP', 'YUKSEK_DEGER'] },
  { name: 'Mehmet Expert', email: 'mehmet.expert@turkcell.com.tr', role: 'CAMPAIGN_EXPERT', expertise: ['YENI_ABONE'] },
  { name: 'Zeynep Expert', email: 'zeynep.expert@turkcell.com.tr', role: 'CAMPAIGN_EXPERT', expertise: ['PASIF'] },
  { name: 'Ayse Expert', email: 'ayse.expert@turkcell.com.tr', role: 'CAMPAIGN_EXPERT', expertise: ['RISKLI_KAYIP'] },
  { name: 'Fatih Expert', email: 'fatih.expert@turkcell.com.tr', role: 'CAMPAIGN_EXPERT', expertise: [] },
  { name: 'Selin Expert', email: 'selin.expert@turkcell.com.tr', role: 'CAMPAIGN_EXPERT', expertise: [] },
  { name: 'Emre Expert', email: 'emre.expert@turkcell.com.tr', role: 'CAMPAIGN_EXPERT', expertise: [] },
];

async function seedUser(user: SeedUser, passwordHash: string): Promise<string | null> {
  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, user.email))
      .limit(1);

    if (existing) {
      logger.info(`User already exists: ${user.email}`);
      return existing.id;
    }

    const newUserData = {
      name: user.name,
      email: user.email,
      role: user.role,
      gsmNumber: user.gsmNumber ?? null,
      expertise: user.expertise ?? [],
      region: user.region ?? [],
      passwordHash,
    } as unknown as NewUser;

    const [created] = await db
      .insert(usersTable)
      .values(newUserData)
      .returning({ id: usersTable.id });

    logger.info(`Created user: ${user.email} (${user.role})`);
    return created.id;
  } catch (err) {
    logger.warn({ err }, `Failed to seed user: ${user.email}`);
    return null;
  }
}

async function main() {
  logger.info('Starting seed...');

  await initDb();

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  logger.info('Password hashed');

  for (const user of staffUsers) {
    await seedUser(user, passwordHash);
  }

  // Seed 20 subscriber users with GSM numbers 05350000000 through 05350000019
  for (let i = 0; i < 20; i++) {
    const gsmNumber = `0535000${String(i).padStart(4, '0')}`;
    const subscriberUser: SeedUser = {
      name: `Abone ${i + 1}`,
      email: `abone${i + 1}@example.com`,
      role: 'SUBSCRIBER',
      gsmNumber,
    };
    await seedUser(subscriberUser, passwordHash);
  }

  logger.info('Seeding audit logs...');
  const auditEntries = [
    { userId: 'system', userName: 'System', action: 'SYSTEM_STARTUP', resource: 'system', result: 'SUCCESS', ipAddress: '127.0.0.1', details: 'Identity service started' },
    { userId: 'system', userName: 'System', action: 'DB_INITIALIZED', resource: 'database', result: 'SUCCESS', ipAddress: '127.0.0.1', details: 'Database tables created' },
    { userName: 'admin@turkcell.com.tr', action: 'LOGIN_SUCCESS', resource: 'auth', result: 'SUCCESS', ipAddress: '10.0.0.1', details: 'Admin login' },
    { userName: 'unknown', action: 'LOGIN_FAILED', resource: 'auth', result: 'FAILURE', ipAddress: '192.168.1.100', details: 'Invalid credentials' },
    { userName: 'System Admin', action: 'USER_CREATED', resource: 'users', result: 'SUCCESS', ipAddress: '10.0.0.1', details: 'Bulk seed' },
    { userName: 'burak.supervisor@turkcell.com.tr', action: 'LOGIN_SUCCESS', resource: 'auth', result: 'SUCCESS', ipAddress: '10.0.0.5', details: 'Supervisor login' },
    { userName: 'unknown', action: 'LOGIN_FAILED', resource: 'auth', result: 'FAILURE', ipAddress: '203.0.113.42', details: 'Brute force attempt' },
    { userName: 'unknown', action: 'ACCOUNT_LOCKED', resource: 'auth', result: 'FAILURE', ipAddress: '203.0.113.42', details: 'Locked after 5 attempts' },
    { userName: 'ahmet.expert@turkcell.com.tr', action: 'LOGIN_SUCCESS', resource: 'auth', result: 'SUCCESS', ipAddress: '10.0.0.10', details: 'Expert login' },
    { userName: 'can.supervisor@turkcell.com.tr', action: 'TOKEN_REFRESHED', resource: 'auth', result: 'SUCCESS', ipAddress: '10.0.0.6', details: 'Token rotation' },
  ];

  for (const entry of auditEntries) {
    try {
      await db.insert(auditLogsTable).values(entry);
    } catch (err) {
      logger.warn({ err }, 'Failed to seed audit log entry');
    }
  }

  logger.info(`Seed complete! Password for all users: ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
