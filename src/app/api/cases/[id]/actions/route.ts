import { requireActor } from '@/lib/server/actor-provider';
import { ApiError, errorResponse } from '@/lib/server/errors';
import { repository } from '@/lib/server/repository';
import { parseCaseActionBody, parseId } from '@/lib/server/validation';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be valid JSON.'); }
    const input = parseCaseActionBody(body);
    const data = await repository.appendCaseAction(id, actor, input);
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Case was not found.');
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
