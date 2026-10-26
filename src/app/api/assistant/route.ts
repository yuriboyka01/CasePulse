import { requireActor } from '@/lib/server/actor-provider';
import { ApiError, errorResponse } from '@/lib/server/errors';
import { createAssistantModel } from '@/lib/server/ai/factory';
import type { AssistantModel } from '@/lib/server/ai/provider';
import { retrieveAssistantEvidence } from '@/lib/server/assistant-retrieval';
import { parseAssistantBody } from '@/lib/server/assistant-validation';
import { runLocalRegulatoryIntelligenceEngine } from '@/lib/server/local-assistant-engine';
import { buildLocalEvidenceAnswer } from '@/lib/server/assistant-fallback';

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
    const latestQuestion = messages[messages.length - 1].content;

    // The synthetic engine is only a demo fallback when no database is configured.
    // Never replace a failed database read with global synthetic records: doing so can
    // bypass bureau scoping and present stale or unrelated information as authoritative.
    if (!process.env.DATABASE_URL) {
      if (!actor.isDemo || process.env.NODE_ENV !== 'development') {
        throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'The casework database is not configured. Please contact the CASEPULSE administrator.');
      }
      const localResult = runLocalRegulatoryIntelligenceEngine(messages, context);
      return Response.json({ data: localResult }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // Retrieval is authoritative and bureau-scoped. Retrieval/auth/database errors must
    // surface as errors rather than silently falling back to an unscoped synthetic dataset.
    const retrieved = await retrieveAssistantEvidence(latestQuestion, context, actor);
    let model: AssistantModel | null = null;
    try {
      model = createAssistantModel();
    } catch {
      // Unsupported provider configuration: retain grounded local answers.
      model = null;
    }

    if (model?.isConfigured()) {
      try {
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
      } catch {
        // Do not log provider errors or request/evidence payloads. Use only the scoped
        // records already retrieved for this actor as a deterministic fallback.
      }
    }

    const fallback = buildLocalEvidenceAnswer(latestQuestion, retrieved);
    return Response.json({ data: fallback }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
