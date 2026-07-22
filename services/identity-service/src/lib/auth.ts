import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

export function signToken(payload: object, expiresInSeconds: number): string {
  return jwt.sign(payload, getSecret(), { expiresIn: expiresInSeconds });
}

export function verifyToken(token: string): Record<string, unknown> {
  return jwt.verify(token, getSecret()) as Record<string, unknown>;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateRefreshToken(): string {
  return randomUUID();
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit (0-9)');
  }
  if (!/[!@#$%^&*()\-_=+\[\]{}]/.test(password)) {
    errors.push(
      'Password must contain at least one special character (!@#$%^&*()_+-=[]{})',
    );
  }

  return { valid: errors.length === 0, errors };
}
