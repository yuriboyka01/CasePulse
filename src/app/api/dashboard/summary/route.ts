import { requireActor } from '@/lib/server/actor-provider';
import { errorResponse } from '@/lib/server/errors';
import { repository } from '@/lib/server/repository';

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const data = await repository.dashboardSummary(actor);
    return Response.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
