import { ApiError } from '@/lib/server/errors';
import { parseId } from '@/lib/server/validation';
import type { AssistantContext, AssistantTurn } from '@/lib/assistant-types';

const MAX_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 1_200;
const MAX_TOTAL_LENGTH = 9_600;

export function parseAssistantBody(value: unknown): { messages: AssistantTurn[]; context?: AssistantContext } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !['messages', 'context'].includes(key))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Unsupported assistant request field.');
  }
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > MAX_MESSAGES) {
    throw new ApiError(400, 'VALIDATION_ERROR', `messages must contain between 1 and ${MAX_MESSAGES} turns.`);
  }

  let totalLength = 0;
  const messages = body.messages.map((value): AssistantTurn => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Each message must be an object.');
    }
    const message = value as Record<string, unknown>;
    if (Object.keys(message).some((key) => !['role', 'content'].includes(key))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Each message may contain only role and content.');
    }
    if (message.role !== 'user' && message.role !== 'assistant') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Message role is invalid.');
    }
    if (typeof message.content !== 'string' || !message.content.trim() || message.content.length > MAX_MESSAGE_LENGTH) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Message content must be between 1 and ${MAX_MESSAGE_LENGTH} characters.`);
    }
    totalLength += message.content.length;
    return { role: message.role, content: message.content.trim() };
  });
  if (totalLength > MAX_TOTAL_LENGTH) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Conversation content must not exceed ${MAX_TOTAL_LENGTH} characters.`);
  }
  if (messages[messages.length - 1].role !== 'user') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The latest message must be from the user.');
  }

  let context: AssistantContext | undefined;
  if (body.context !== undefined) {
    if (!body.context || typeof body.context !== 'object' || Array.isArray(body.context)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'context must be an object.');
    }
    const rawContext = body.context as Record<string, unknown>;
    if (Object.keys(rawContext).some((key) => !['caseId', 'institutionId'].includes(key))) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Unsupported assistant context field.');
    }
    if (rawContext.caseId !== undefined && rawContext.institutionId !== undefined) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Choose either a case context or an institution context.');
    }
    if (rawContext.caseId !== undefined) {
      if (typeof rawContext.caseId !== 'string') throw new ApiError(400, 'VALIDATION_ERROR', 'caseId must be a string.');
      context = { caseId: parseId(rawContext.caseId) };
    } else if (rawContext.institutionId !== undefined) {
      if (typeof rawContext.institutionId !== 'string') throw new ApiError(400, 'VALIDATION_ERROR', 'institutionId must be a string.');
      context = { institutionId: parseId(rawContext.institutionId) };
    }
  }

  return { messages, context };
}
