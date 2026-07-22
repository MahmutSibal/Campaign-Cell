import { describe, it, expect } from 'vitest';
import { validatePasswordPolicy, signToken, verifyToken, hashPassword, verifyPassword } from './auth.js';

// Set required env vars before imports that read them at module load
process.env['JWT_SECRET'] = 'test-secret-key-for-unit-tests';

describe('validatePasswordPolicy', () => {
  it('accepts a valid password', () => {
    const r = validatePasswordPolicy('Turkcell1!');
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const r = validatePasswordPolicy('Ab1!');
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('8'))).toBe(true);
  });

  it('rejects passwords without uppercase', () => {
    const r = validatePasswordPolicy('turkcell1!');
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.toLowerCase().includes('uppercase') || e.toLowerCase().includes('büyük'))).toBe(true);
  });

  it('rejects passwords without a digit', () => {
    const r = validatePasswordPolicy('Turkcell!');
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('digit') || e.includes('rakam') || e.includes('0-9'))).toBe(true);
  });

  it('rejects passwords without a special character', () => {
    const r = validatePasswordPolicy('Turkcell1');
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('special') || e.includes('özel'))).toBe(true);
  });

  it('accumulates multiple errors', () => {
    const r = validatePasswordPolicy('abc');
    expect(r.errors.length).toBeGreaterThan(1);
  });
});

describe('JWT token lifecycle', () => {
  it('signs and verifies a token', () => {
    const token = signToken({ id: 'user-1', role: 'ADMIN' }, 60);
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!['id']).toBe('user-1');
    expect(payload!['role']).toBe('ADMIN');
  });

  it('throws for a tampered token', () => {
    const token = signToken({ id: 'user-1' }, 60);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('throws for an expired token', () => {
    const token = signToken({ id: 'user-1' }, -1); // already expired
    expect(() => verifyToken(token)).toThrow();
  });
});

describe('password hashing', () => {
  it('hashes and verifies correctly', async () => {
    const hash = await hashPassword('Turkcell1!');
    expect(hash.startsWith('$2')).toBe(true); // bcrypt format
    expect(await verifyPassword('Turkcell1!', hash)).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('Turkcell1!');
    expect(await verifyPassword('WrongPass1!', hash)).toBe(false);
  });

  it('produces different hashes for same input (salt)', async () => {
    const h1 = await hashPassword('Turkcell1!');
    const h2 = await hashPassword('Turkcell1!');
    expect(h1).not.toBe(h2);
  });
});
