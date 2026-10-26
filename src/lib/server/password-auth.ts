import 'server-only';

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { query } from './db';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) {
    throw new Error('Password must be between 12 and 128 characters.');
  }
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, saltText, hashText, ...extra] = encodedHash.split('$');
  if (algorithm !== 'scrypt' || !saltText || !hashText || extra.length > 0) return false;
  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function authenticateOfficerCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || normalizedEmail.length > 254 || password.length > 128) return null;
  try {
    const result = await query<{
      id: string;
      displayName: string;
      email: string;
      isActive: boolean;
      passwordHash: string;
    }>(
      `SELECT o.id, o.display_name AS "displayName", o.email, o.is_active AS "isActive",
        c.password_hash AS "passwordHash"
       FROM officers o
       JOIN officer_password_credentials c ON c.officer_id = o.id
       WHERE lower(btrim(o.email)) = $1
       LIMIT 1`,
      [normalizedEmail]
    );
    const officer = result.rows[0];
    if (!officer || !officer.isActive || !(await verifyPassword(password, officer.passwordHash))) return null;
    return { id: officer.id, name: officer.displayName, email: officer.email };
  } catch {
    return null;
  }
}
