import 'server-only';
import { ApiError } from '@/lib/server/errors';
import { OpenAICompatibleProvider, type AssistantModel } from '@/lib/server/ai/provider';

/** Central provider selection point; additional provider adapters can implement AssistantModel. */
export function createAssistantModel(): AssistantModel {
  const provider = (process.env.AI_PROVIDER ?? 'openai-compatible').trim().toLowerCase();
  if (provider === 'openai-compatible') return new OpenAICompatibleProvider();
  throw new ApiError(503, 'AI_PROVIDER_UNSUPPORTED', 'The configured AI provider is not supported by this deployment.');
}
