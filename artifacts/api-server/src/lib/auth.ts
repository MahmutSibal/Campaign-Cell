import crypto from "crypto";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.SESSION_SECRET || "campaigncell-dev-secret";
const BCRYPT_ROUNDS = 12;

export function signToken(payload: Record<string, unknown>, expiresInSec = 900): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const [header, body, sig] = token.split(".");
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (expected !== sig) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

/** bcrypt hash — async, cost factor 12 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** bcrypt verify — also handles legacy SHA-256 hashes transparently */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // New bcrypt hashes start with $2a$ or $2b$
  if (hash.startsWith("$2")) {
    return bcrypt.compare(password, hash);
  }
  // Legacy SHA-256 fallback (migrated on next login)
  const legacyHash = crypto.createHash("sha256").update(password + JWT_SECRET).digest("hex");
  return legacyHash === hash;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];
  if (password.length < 8) errors.push("Şifre en az 8 karakter olmalıdır");
  if (!/[A-Z]/.test(password)) errors.push("Şifre en az 1 büyük harf içermelidir (A-Z)");
  if (!/[0-9]/.test(password)) errors.push("Şifre en az 1 rakam içermelidir (0-9)");
  if (!/[!@#$%^&*()\-_=+\[\]{}]/.test(password)) errors.push("Şifre en az 1 özel karakter içermelidir (!@#$%^&*()_+-=[]{})");
  return { valid: errors.length === 0, errors };
}
