import { randomUUID } from 'node:crypto';
import { query } from '@/lib/server/db';
import { ApiError, errorResponse } from '@/lib/server/errors';
import { hashPassword } from '@/lib/server/password-auth';
import { BUREAU_CODES } from '@/lib/server/types';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const requestHost = request.headers.get('host');
    let originHost = '';
    try { originHost = origin ? new URL(origin).host : ''; } catch { /* invalid origin */ }
    if (!originHost || !requestHost || originHost !== requestHost) {
      throw new ApiError(403, 'FORBIDDEN', 'Access requests must be submitted from CASEPULSE.');
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must contain valid JSON.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
    }
    const input = body as Record<string, unknown>;
    const allowed = ['name', 'email', 'password', 'bureauCode', 'note'];
    if (Object.keys(input).some((key) => !allowed.includes(key))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Unsupported request field.');
    }

    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const bureauCode = input.bureauCode;
    const note = typeof input.note === 'string' ? input.note.trim() : '';

    if (!name || name.length > 120) throw new ApiError(400, 'VALIDATION_ERROR', 'Enter your name (up to 120 characters).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ApiError(400, 'VALIDATION_ERROR', 'Enter a valid email address.');
    if (password.length < 12 || password.length > 128) throw new ApiError(400, 'VALIDATION_ERROR', 'Password must be between 12 and 128 characters.');
    if (typeof bureauCode !== 'string' || !BUREAU_CODES.includes(bureauCode as typeof BUREAU_CODES[number])) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Select a valid bureau.');
    }
    if (note.length > 1000) throw new ApiError(400, 'VALIDATION_ERROR', 'Access note must be at most 1000 characters.');

    const passwordHash = await hashPassword(password);
    const requestId = randomUUID();
    try {
      await query(
        `INSERT INTO officer_access_requests (id, email, display_name, requested_bureau_code, request_note, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [requestId, email, name, bureauCode, note, passwordHash]
      );
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new ApiError(409, 'REQUEST_ALREADY_EXISTS', 'An access request for this email is already awaiting review.');
      }
      throw error;
    }

    return Response.json({ data: { status: 'PENDING', requestId } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
