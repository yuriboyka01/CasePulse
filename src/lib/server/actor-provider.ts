import 'server-only';
import { getToken } from 'next-auth/jwt';
import { query } from './db';
import { ApiError } from './errors';
import { BUREAU_CODES, type Actor, type BureauCode } from './types';

export type OfficerLookup = (issuer: string, subject: string) => Promise<Actor>;

interface OfficerDbRow {
  id: string;
  displayName: string;
  isActive: boolean;
  bureauCodes: string[] | null;
  roles: string[] | null;
}

/**
 * Looks up a provisioned, active officer from PostgreSQL using verified OIDC issuer and subject claims.
 */
export async function lookupOfficerInDb(
  issuer: string,
  subject: string,
  sqlQuery = query
): Promise<Actor> {
  const result = await sqlQuery<OfficerDbRow>(
    `SELECT
       o.id,
       o.display_name AS "displayName",
       o.is_active AS "isActive",
       COALESCE((
         SELECT jsonb_agg(ob.bureau_code ORDER BY ob.bureau_code)
         FROM officer_bureaus ob
         WHERE ob.officer_id = o.id
       ), '[]'::jsonb) AS "bureauCodes",
       COALESCE((
         SELECT jsonb_agg(r.role ORDER BY r.role)
         FROM officer_roles r
         WHERE r.officer_id = o.id
       ), '[]'::jsonb) AS "roles"
     FROM officers o
     JOIN officer_identities oi ON oi.officer_id = o.id
     WHERE oi.issuer = $1 AND oi.subject = $2
     LIMIT 1`,
    [issuer, subject]
  );

  const row = result.rows[0];
  if (!row) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Your identity is authenticated, but no active CASEPULSE officer account is provisioned for this identity.'
    );
  }

  if (!row.isActive) {
    throw new ApiError(403, 'FORBIDDEN', 'Officer account is deactivated.');
  }

  const validBureaus = (row.bureauCodes ?? []).filter((b): b is BureauCode =>
    (BUREAU_CODES as readonly string[]).includes(b)
  );

  return {
    id: row.id,
    displayName: row.displayName,
    bureauCodes: validBureaus,
    roles: row.roles ?? [],
    isDemo: false,
  };
}

/**
 * Resolves the authenticated Actor for the incoming request.
 *
 * 1. Development demo identity:
 *    Granted ONLY when process.env.NODE_ENV === 'development' AND process.env.CASEPULSE_AUTH_MODE === 'demo'.
 *    Strictly denied in production or when CASEPULSE_AUTH_MODE !== 'demo'.
 *
 * 2. Production / OIDC session identity:
 *    Resolves the cryptographic session cookie using NextAuth / Auth.js getToken().
 *    Extracts verified issuer (iss) and subject (sub).
 *    Fails closed if OIDC is unconfigured (missing secret) or session is missing/invalid.
 *    Never trusts client-supplied headers (e.g. x-actor-id, x-role, x-bureau).
 *
 * 3. Database provisioned officer lookup:
 *    Queries PostgreSQL for an active officer associated with (issuer, subject).
 *    If unprovisioned: rejects with 403 FORBIDDEN.
 *    If inactive: rejects with 403 FORBIDDEN.
 *    Resolves bureauCodes and roles from server-side tables.
 */
export async function resolveActor(
  request: Request,
  lookupOfficer: OfficerLookup = lookupOfficerInDb
): Promise<Actor | null> {
  // Development demo mode is strictly disallowed in production or when not explicitly requested.
  if (process.env.CASEPULSE_AUTH_MODE === 'demo') {
    if (process.env.NODE_ENV === 'development') {
      return {
        id: 'DEMO-OFFICER-001',
        displayName: 'CASEPULSE Development Demo Officer',
        bureauCodes: [...BUREAU_CODES],
        roles: ['OFFICER', 'CROSS_BUREAU_VIEW'],
        isDemo: true,
      };
    }
    // Fail closed if demo mode is attempted in production or non-development environments.
    return null;
  }

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // Identity provider is unconfigured. Fail closed.
    return null;
  }

  let token: { sub?: string; iss?: string; issuer?: string; [key: string]: unknown } | null = null;
  try {
    token = (await getToken({
      req: request,
      secret,
      secureCookie: process.env.NODE_ENV === 'production',
    })) as { sub?: string; iss?: string; issuer?: string; [key: string]: unknown } | null;
  } catch {
    return null;
  }

  if (!token) {
    return null;
  }

  const subject = typeof token.sub === 'string' ? token.sub.trim() : '';
  const tokenIssuer = typeof token.iss === 'string' && token.iss.trim() !== ''
    ? token.iss.trim()
    : typeof token.issuer === 'string' && token.issuer.trim() !== ''
      ? token.issuer.trim()
      : (process.env.AUTH_OIDC_ISSUER?.trim() || 'oidc');

  if (!subject || !tokenIssuer) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'The authenticated session does not contain valid identity claims.');
  }

  return await lookupOfficer(tokenIssuer, subject);
}

export async function requireActor(
  request: Request,
  lookupOfficer: OfficerLookup = lookupOfficerInDb
): Promise<Actor> {
  const actor = await resolveActor(request, lookupOfficer);
  if (!actor) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'A valid officer session is required.');
  }
  return actor;
}

export function canReadCrossBureau(actor: Actor): boolean {
  return actor.roles.includes('CROSS_BUREAU_VIEW') || actor.roles.includes('ADMIN');
}

export function canReadBureau(actor: Actor, bureau: string): boolean {
  return canReadCrossBureau(actor) || actor.bureauCodes.includes(bureau as Actor['bureauCodes'][number]);
}

/** Admins may perform write workflows across bureaus; CROSS_BUREAU_VIEW is read-only. */
export function canWriteCaseAction(actor: Actor, bureau: string): boolean {
  return actor.roles.includes('ADMIN') || actor.bureauCodes.includes(bureau as Actor['bureauCodes'][number]);
}

/** Overlap review requires provisioned membership in both bureaus, or the ADMIN role. */
export function canWriteOverlapReview(actor: Actor, sourceBureau: string, targetBureau: string): boolean {
  return actor.roles.includes('ADMIN') ||
    (actor.bureauCodes.includes(sourceBureau as Actor['bureauCodes'][number]) &&
      actor.bureauCodes.includes(targetBureau as Actor['bureauCodes'][number]));
}
