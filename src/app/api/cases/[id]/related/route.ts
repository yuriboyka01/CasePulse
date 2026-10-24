import { requireActor } from '@/lib/server/actor-provider';
import { ApiError, errorResponse } from '@/lib/server/errors';
import { repository } from '@/lib/server/repository';
import { parseId } from '@/lib/server/validation';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    const relationships = await repository.getRelatedCases(id, actor);
    if (!relationships) throw new ApiError(404, 'NOT_FOUND', 'Case was not found.');
    return Response.json({ data: { caseId: id, relationships } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
