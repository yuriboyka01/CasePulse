import { requireActor } from '@/lib/server/actor-provider';
import { errorResponse } from '@/lib/server/errors';
import { BUREAU_CODES } from '@/lib/server/types';

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const bureauCodes = actor.roles.includes('ADMIN') ? [...BUREAU_CODES] : actor.bureauCodes;
    return Response.json({ data: { bureauCodes } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
