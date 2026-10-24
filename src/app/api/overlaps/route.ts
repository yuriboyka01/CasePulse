import { requireActor } from '@/lib/server/actor-provider';
import { errorResponse } from '@/lib/server/errors';
import { repository } from '@/lib/server/repository';
import { parseOverlapFilters } from '@/lib/server/validation';

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const filters = parseOverlapFilters(new URL(request.url).searchParams);
    const result = await repository.listOverlaps(filters, actor);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
