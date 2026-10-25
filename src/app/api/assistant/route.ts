import { requireActor } from '@/lib/server/actor-provider';
import { ApiError, errorResponse } from '@/lib/server/errors';
import { createAssistantModel } from '@/lib/server/ai/factory';
import { retrieveAssistantEvidence } from '@/lib/server/assistant-retrieval';
import { parseAssistantBody } from '@/lib/server/assistant-validation';

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > 20_000) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Assistant requests must be smaller than 20 KB.');
    }
    let rawBody: unknown;
    try {
      const rawText = await request.text();
      if (rawText.length > 20_000) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Assistant requests must be smaller than 20 KB.');
      rawBody = JSON.parse(rawText);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be valid JSON.');
    }
    const { messages, context } = parseAssistantBody(rawBody);
    const model = createAssistantModel();
    if (!model.isConfigured()) {
      throw new ApiError(503, 'AI_NOT_CONFIGURED', 'The AI assistant is not configured yet. Set the server-side AI_API_KEY and AI_MODEL to enable it.');
    }

    const latestQuestion = messages[messages.length - 1].content;
    const retrieved = await retrieveAssistantEvidence(latestQuestion, context, actor);
    const answer = await model.generate(messages, retrieved.evidence);
    return Response.json({
      data: {
        answer,
        sources: retrieved.sources,
        counts: {
          cases: retrieved.evidence.cases.length,
          institutions: retrieved.evidence.institutions.length,
          relationships: retrieved.evidence.relationships.length,
        },
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
