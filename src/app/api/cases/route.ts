import { requireActor } from '@/lib/server/actor-provider';
import { errorResponse } from '@/lib/server/errors';
import { repository } from '@/lib/server/repository';
import { parseCaseFilters } from '@/lib/server/validation';
import { parseCreateCaseBody } from '@/lib/server/validation';
import { canWriteCaseAction } from '@/lib/server/actor-provider';
import { ApiError } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const filters = parseCaseFilters(new URL(request.url).searchParams);
    const result = await repository.listCases(filters, actor);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must contain valid JSON.');
    }
    const input = parseCreateCaseBody(body);
    if (!canWriteCaseAction(actor, input.bureauId)) {
      throw new ApiError(403, 'FORBIDDEN', 'You may register cases only for a bureau you are assigned to.');
    }
    const created = await repository.createCase(actor, input);
    if (!created) {
      throw new ApiError(404, 'NOT_FOUND', 'The institution is not available for this bureau.');
    }
    return Response.json({ data: created }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
