import { requireActor } from '@/lib/server/actor-provider';
import { ApiError, errorResponse } from '@/lib/server/errors';
import { repository } from '@/lib/server/repository';
import { parseId, parsePagination } from '@/lib/server/validation';
import { parseOverlapReviewBody } from '@/lib/server/validation';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    const pagination = parsePagination(new URL(request.url).searchParams);
    const result = await repository.listOverlapReviews(id, actor, pagination.page, pagination.pageSize);
    if (!result) throw new ApiError(404, 'NOT_FOUND', 'Overlap relationship was not found.');
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    let body: unknown;
    try { body = await request.json(); } catch { throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be valid JSON.'); }
    const input = parseOverlapReviewBody(body);
    const data = await repository.appendOverlapReview(id, actor, input);
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Overlap relationship was not found.');
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
