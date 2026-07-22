import { eq, and, lt, sql } from 'drizzle-orm';
import pino from 'pino';
import { db } from '../db/client.js';
import { optimizationCasesTable, campaignsTable } from '../db/schema.js';
import { publishEvent } from './redis.js';

const logger = pino({ transport: { target: 'pino-pretty' } });

const TERMINAL_STATUSES = ['TAMAMLANDI', 'YAYINDA', 'ARSIVLENDI'];

// System-driven transition: YAYINDA -> ARSIVLENDI when the linked campaign's validity period has expired
async function archiveExpiredCases(): Promise<void> {
  const liveCases = await db
    .select({ case: optimizationCasesTable, campaign: campaignsTable })
    .from(optimizationCasesTable)
    .innerJoin(campaignsTable, eq(optimizationCasesTable.campaignId, campaignsTable.id))
    .where(
      and(
        eq(optimizationCasesTable.status, 'YAYINDA'),
        lt(campaignsTable.endDate, new Date()),
      ),
    );

  for (const row of liveCases) {
    await db
      .update(optimizationCasesTable)
      .set({ status: 'ARSIVLENDI', updatedAt: new Date() })
      .where(eq(optimizationCasesTable.id, row.case.id));

    publishEvent('audit.log', {
      action: 'CASE_STATUS_CHANGED',
      resource: 'optimization_cases',
      resourceId: row.case.id,
      result: 'SUCCESS',
      details: `YAYINDA -> ARSIVLENDI (system: campaign validity expired, case ${row.case.caseCode})`,
    });
  }

  if (liveCases.length > 0) {
    logger.info(`[scheduler] Auto-archived ${liveCases.length} expired case(s)`);
  }
}

// Proactive SLA breach detection: don't wait for the next PATCH to notice a breach
async function detectSlaBreaches(): Promise<void> {
  const breached = await db
    .select()
    .from(optimizationCasesTable)
    .where(
      and(
        sql`${optimizationCasesTable.status} NOT IN ('TAMAMLANDI', 'YAYINDA', 'ARSIVLENDI')`,
        eq(optimizationCasesTable.slaBreached, false),
        lt(optimizationCasesTable.slaDeadline, new Date()),
      ),
    );

  for (const c of breached) {
    await db
      .update(optimizationCasesTable)
      .set({ slaBreached: true })
      .where(eq(optimizationCasesTable.id, c.id));

    await publishEvent('campaign.sla_breached', {
      caseId: c.id,
      caseCode: c.caseCode,
      expertId: c.assignedExpertId,
      segment: c.segment,
      priority: c.priority,
    });
  }

  if (breached.length > 0) {
    logger.info(`[scheduler] Flagged ${breached.length} newly SLA-breached case(s)`);
  }
}

export function startScheduler(intervalMs = 60_000): NodeJS.Timeout {
  const tick = async () => {
    try {
      await archiveExpiredCases();
      await detectSlaBreaches();
    } catch (err) {
      logger.error({ err }, '[scheduler] tick failed');
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}
