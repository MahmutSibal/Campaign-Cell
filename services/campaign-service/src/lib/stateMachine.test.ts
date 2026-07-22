import { describe, it, expect } from 'vitest';

// State machine mirrored from cases.ts — single source of truth for tests
type TransitionRule = { to: string; roles: string[] | 'assigned_expert' };
const TRANSITIONS: Record<string, TransitionRule[]> = {
  YENI:               [{ to: 'ATANDI',            roles: ['SUPERVISOR', 'ADMIN'] }],
  ATANDI:             [{ to: 'OPTIMIZE_EDILIYOR', roles: 'assigned_expert' }],
  OPTIMIZE_EDILIYOR:  [
    { to: 'TEST_EDILIYOR', roles: 'assigned_expert' },
    { to: 'TAMAMLANDI',    roles: 'assigned_expert' },
  ],
  TEST_EDILIYOR:      [{ to: 'OPTIMIZE_EDILIYOR', roles: ['CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'] }],
  TAMAMLANDI:         [{ to: 'YAYINDA',           roles: ['SUPERVISOR', 'ADMIN'] }],
  YAYINDA:            [{ to: 'ARSIVLENDI',         roles: ['SUPERVISOR', 'ADMIN'] }],
};

function canTransition(
  from: string, to: string, role: string, userId: string,
  caseRow: { assignedExpertId: string | null },
): boolean {
  const rules = TRANSITIONS[from];
  if (!rules) return false;
  const rule = rules.find(r => r.to === to);
  if (!rule) return false;
  if (rule.roles === 'assigned_expert') return caseRow.assignedExpertId === userId;
  return (rule.roles as string[]).includes(role);
}

describe('Campaign state machine', () => {
  const supervisorCase = { assignedExpertId: 'expert-1' };

  it('SUPERVISOR can assign YENI → ATANDI', () => {
    expect(canTransition('YENI', 'ATANDI', 'SUPERVISOR', 'sup-1', { assignedExpertId: null })).toBe(true);
  });

  it('CAMPAIGN_EXPERT cannot assign YENI → ATANDI', () => {
    expect(canTransition('YENI', 'ATANDI', 'CAMPAIGN_EXPERT', 'exp-1', { assignedExpertId: null })).toBe(false);
  });

  it('assigned expert can start ATANDI → OPTIMIZE_EDILIYOR', () => {
    expect(canTransition('ATANDI', 'OPTIMIZE_EDILIYOR', 'CAMPAIGN_EXPERT', 'expert-1', supervisorCase)).toBe(true);
  });

  it('wrong expert cannot start ATANDI → OPTIMIZE_EDILIYOR', () => {
    expect(canTransition('ATANDI', 'OPTIMIZE_EDILIYOR', 'CAMPAIGN_EXPERT', 'other-expert', supervisorCase)).toBe(false);
  });

  it('assigned expert can complete OPTIMIZE_EDILIYOR → TAMAMLANDI', () => {
    expect(canTransition('OPTIMIZE_EDILIYOR', 'TAMAMLANDI', 'CAMPAIGN_EXPERT', 'expert-1', supervisorCase)).toBe(true);
  });

  it('SUPERVISOR can publish TAMAMLANDI → YAYINDA', () => {
    expect(canTransition('TAMAMLANDI', 'YAYINDA', 'SUPERVISOR', 'sup-1', supervisorCase)).toBe(true);
  });

  it('CAMPAIGN_EXPERT cannot publish TAMAMLANDI → YAYINDA', () => {
    expect(canTransition('TAMAMLANDI', 'YAYINDA', 'CAMPAIGN_EXPERT', 'expert-1', supervisorCase)).toBe(false);
  });

  it('returns false for invalid transition (YAYINDA → YENI)', () => {
    expect(canTransition('YAYINDA', 'YENI', 'ADMIN', 'admin-1', supervisorCase)).toBe(false);
  });

  it('SUPERVISOR can archive YAYINDA → ARSIVLENDI', () => {
    expect(canTransition('YAYINDA', 'ARSIVLENDI', 'SUPERVISOR', 'sup-1', supervisorCase)).toBe(true);
  });
});
