import { ApiError } from './errors';
import { BUREAU_CODES, type CaseFilters, type CaseStatus, type InstitutionFilters, type OverlapFilters, type RelationshipStatus, type ReviewDecision } from './types';

const CASE_STATUSES: CaseStatus[] = [
  'NEW', 'UNDER_INVESTIGATION', 'HEARING_SCHEDULED', 'ACTION_PENDING',
  'JOINT_INQUIRY', 'RESOLVED', 'CLOSED',
];
const CASE_CATEGORIES = [
  'CAPITATION_FEE', 'WITHHOLDING_DOCUMENTS', 'GHOST_FACULTY', 'RAGGING_HARASSMENT',
  'INFRASTRUCTURE_DEFICIT', 'UNAPPROVED_COURSES', 'EXAM_MALPRACTICE', 'FALSE_ACCREDITATION',
];
const RELATIONSHIP_STATUSES: RelationshipStatus[] = [
  'PROPOSED', 'CONFIRMED', 'REJECTED', 'FURTHER_COORDINATION',
];
const OVERLAP_TYPES = ['CONFIRMED_ID', 'HIGH_PROBABILITY_NAME', 'PATTERN_CORRELATION'];
const ACTION_TYPES = ['NOTE_ADDED', 'HEARING', 'NOTICE_ISSUED', 'INTER_BUREAU_SYNC', 'PENALTY_ISSUED', 'CLOSURE'] as const;
const CASE_SEVERITIES = ['ROUTINE', 'ELEVATED', 'HIGH', 'CRITICAL'] as const;
const COMPLAINANT_TYPES = ['STUDENT', 'FACULTY', 'PARENT', 'WHISTLEBLOWER', 'ANONYMOUS'] as const;
const INTAKE_SOURCES = ['EXISTING_PORTAL', 'EMAIL', 'LETTER', 'PHONE', 'OTHER'] as const;

function fail(message: string): never {
  throw new ApiError(400, 'VALIDATION_ERROR', message);
}

function positiveInteger(value: string | null, fallback: number, name: string, max?: number): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return fail(`${name} must be a positive integer.`);
  const result = Number(value);
  if (result < 1 || (max !== undefined && result > max)) {
    return fail(`${name} must be between 1 and ${max ?? Number.MAX_SAFE_INTEGER}.`);
  }
  return result;
}

function optionalEnum<T extends string>(
  value: string | null,
  values: readonly T[],
  name: string
): T | undefined {
  if (value === null || value === '') return undefined;
  if (!values.includes(value as T)) return fail(`${name} is invalid.`);
  return value as T;
}

function optionalBoolean(value: string | null, name: string): boolean | undefined {
  if (value === null) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fail(`${name} must be true or false.`);
}

function optionalText(value: string | null, name: string, maxLength = 200): string | undefined {
  if (value === null || value.trim() === '') return undefined;
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return fail(`${name} must be at most ${maxLength} characters.`);
  return trimmed;
}

function common(params: URLSearchParams) {
  return {
    page: positiveInteger(params.get('page'), 1, 'page'),
    pageSize: positiveInteger(params.get('pageSize'), 25, 'pageSize', 100),
  };
}

function assertAllowedParams(params: URLSearchParams, allowed: string[]) {
  const unknown = [...new Set([...params.keys()].filter((key) => !allowed.includes(key)))];
  if (unknown.length > 0) fail(`Unsupported query parameter: ${unknown[0]}.`);
}

export function parseInstitutionFilters(params: URLSearchParams): InstitutionFilters {
  assertAllowedParams(params, ['page', 'pageSize', 'search', 'state', 'riskRating', 'bureau']);
  return {
    ...common(params),
    search: optionalText(params.get('search'), 'search'),
    state: optionalText(params.get('state'), 'state', 100),
    riskRating: optionalEnum(params.get('riskRating'), ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 'riskRating'),
    bureau: optionalEnum(params.get('bureau'), BUREAU_CODES, 'bureau'),
  };
}

export function parseCaseFilters(params: URLSearchParams): CaseFilters {
  assertAllowedParams(params, ['page', 'pageSize', 'search', 'bureau', 'status', 'category', 'institutionId', 'overdueOnly', 'overlapOnly']);
  return {
    ...common(params),
    search: optionalText(params.get('search'), 'search'),
    bureau: optionalEnum(params.get('bureau'), BUREAU_CODES, 'bureau'),
    status: optionalEnum(params.get('status'), CASE_STATUSES, 'status'),
    category: optionalEnum(params.get('category'), CASE_CATEGORIES, 'category'),
    institutionId: optionalText(params.get('institutionId'), 'institutionId', 100),
    overdueOnly: optionalBoolean(params.get('overdueOnly'), 'overdueOnly'),
    overlapOnly: optionalBoolean(params.get('overlapOnly'), 'overlapOnly'),
  };
}

export function parseOverlapFilters(params: URLSearchParams): OverlapFilters {
  assertAllowedParams(params, ['page', 'pageSize', 'status', 'matchType', 'bureau', 'institutionId', 'search']);
  return {
    ...common(params),
    status: optionalEnum(params.get('status'), RELATIONSHIP_STATUSES, 'status'),
    matchType: optionalEnum(params.get('matchType'), OVERLAP_TYPES, 'matchType'),
    bureau: optionalEnum(params.get('bureau'), BUREAU_CODES, 'bureau'),
    institutionId: optionalText(params.get('institutionId'), 'institutionId', 100),
    search: optionalText(params.get('search'), 'search'),
  };
}

export function parsePagination(params: URLSearchParams) {
  assertAllowedParams(params, ['page', 'pageSize']);
  return common(params);
}

export function parseId(id: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(id)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The resource ID is invalid.');
  }
  return id;
}

function parseWriteBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Request body must be a JSON object.');
  return value as Record<string, unknown>;
}

function boundedNote(value: unknown, name: string, required: boolean): string {
  if (typeof value !== 'string') return fail(`${name} must be a string.`);
  const note = value.trim();
  if (required && !note) return fail(`${name} is required.`);
  if (note.length > 4000) return fail(`${name} must be at most 4000 characters.`);
  return note;
}

export function parseCaseActionBody(value: unknown): { idempotencyKey: string; type: typeof ACTION_TYPES[number]; notes: string; nextStatus?: CaseStatus } {
  const body = parseWriteBody(value);
  if (Object.keys(body).some((key) => !['idempotencyKey', 'type', 'notes', 'nextStatus'].includes(key))) fail('Unsupported request field; actor identity and bureau membership are resolved by the server.');
  if (typeof body.idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(body.idempotencyKey)) fail('idempotencyKey must contain 8 to 128 permitted characters.');
  if (typeof body.type !== 'string' || !ACTION_TYPES.includes(body.type as typeof ACTION_TYPES[number])) fail('type is invalid.');
  if ('nextStatus' in body && (typeof body.nextStatus !== 'string' || !CASE_STATUSES.includes(body.nextStatus as CaseStatus))) fail('nextStatus is invalid.');
  return { idempotencyKey: body.idempotencyKey, type: body.type as typeof ACTION_TYPES[number], notes: boundedNote(body.notes, 'notes', true), ...(body.nextStatus ? { nextStatus: body.nextStatus as CaseStatus } : {}) };
}

export interface CreateCaseInput {
  institutionId: string;
  bureauId: typeof BUREAU_CODES[number];
  title: string;
  description: string;
  category: typeof CASE_CATEGORIES[number];
  severity: typeof CASE_SEVERITIES[number];
  complainantType: typeof COMPLAINANT_TYPES[number];
  filingDate: string;
  slaDueDate: string;
  intakeSource: typeof INTAKE_SOURCES[number];
  sourceReference?: string;
}

export function parseCreateCaseBody(value: unknown): CreateCaseInput {
  const body = parseWriteBody(value);
  const allowed = ['institutionId', 'bureauId', 'title', 'description', 'category', 'severity', 'complainantType', 'filingDate', 'slaDueDate', 'intakeSource', 'sourceReference'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    fail('Unsupported request field; case identifiers, actor identity, and case status are assigned by the server.');
  }

  const institutionId = typeof body.institutionId === 'string' ? body.institutionId.trim() : '';
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(institutionId)) fail('institutionId is invalid.');
  if (typeof body.bureauId !== 'string' || !BUREAU_CODES.includes(body.bureauId as typeof BUREAU_CODES[number])) fail('bureauId is invalid.');
  const title = boundedNote(body.title, 'title', true);
  if (title.length > 240) fail('title must be at most 240 characters.');
  const description = boundedNote(body.description, 'description', true);
  if (description.length > 4000) fail('description must be at most 4000 characters.');
  if (typeof body.category !== 'string' || !CASE_CATEGORIES.includes(body.category as typeof CASE_CATEGORIES[number])) fail('category is invalid.');
  if (typeof body.severity !== 'string' || !CASE_SEVERITIES.includes(body.severity as typeof CASE_SEVERITIES[number])) fail('severity is invalid.');
  if (typeof body.complainantType !== 'string' || !COMPLAINANT_TYPES.includes(body.complainantType as typeof COMPLAINANT_TYPES[number])) fail('complainantType is invalid.');
  if (typeof body.intakeSource !== 'string' || !INTAKE_SOURCES.includes(body.intakeSource as typeof INTAKE_SOURCES[number])) fail('intakeSource is invalid.');

  const parseDate = (input: unknown, name: string) => {
    if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) fail(`${name} must be a valid date.`);
    const date = new Date(`${input}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) fail(`${name} must be a valid date.`);
    return date.toISOString();
  };
  const filingDate = parseDate(body.filingDate, 'filingDate');
  const slaDueDate = parseDate(body.slaDueDate, 'slaDueDate');
  if (new Date(slaDueDate) < new Date(filingDate)) fail('slaDueDate must be on or after filingDate.');

  const sourceReference = body.sourceReference === undefined ? undefined : boundedNote(body.sourceReference, 'sourceReference', false);
  if (sourceReference && sourceReference.length > 100) fail('sourceReference must be at most 100 characters.');

  return {
    institutionId,
    bureauId: body.bureauId as CreateCaseInput['bureauId'],
    title,
    description,
    category: body.category as CreateCaseInput['category'],
    severity: body.severity as CreateCaseInput['severity'],
    complainantType: body.complainantType as CreateCaseInput['complainantType'],
    filingDate,
    slaDueDate,
    intakeSource: body.intakeSource as CreateCaseInput['intakeSource'],
    ...(sourceReference ? { sourceReference } : {}),
  };
}

export function parseOverlapReviewBody(value: unknown): { decision: ReviewDecision; notes: string; expectedVersion: number } {
  const body = parseWriteBody(value);
  if (Object.keys(body).some((key) => !['decision', 'notes', 'expectedVersion'].includes(key))) fail('Unsupported request field; reviewer identity and bureau membership are resolved by the server.');
  if (!['CONFIRMED', 'REJECTED', 'FURTHER_COORDINATION'].includes(String(body.decision))) fail('decision is invalid.');
  if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) fail('expectedVersion must be a positive integer.');
  return { decision: body.decision as ReviewDecision, notes: boundedNote(body.notes, 'notes', false), expectedVersion: Number(body.expectedVersion) };
}
