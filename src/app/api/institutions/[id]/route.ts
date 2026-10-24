import { requireActor } from '@/lib/server/actor-provider';
import { ApiError, errorResponse } from '@/lib/server/errors';
import { repository } from '@/lib/server/repository';
import { parseId } from '@/lib/server/validation';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    const { id: rawId } = await context.params;
    const data = await repository.getInstitution(parseId(rawId), actor);
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Institution was not found.');
    return Response.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
