import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCaseFilters, parseInstitutionFilters, parseOverlapFilters, parsePagination } from '../../src/lib/server/validation';
import { ApiError } from '../../src/lib/server/errors';

test('case filters validate values and pagination defaults', () => {
  assert.deepEqual(parseCaseFilters(new URLSearchParams('status=NEW&page=2&pageSize=10&overdueOnly=true')), {
    page: 2, pageSize: 10, search: undefined, bureau: undefined, status: 'NEW', category: undefined,
    institutionId: undefined, overdueOnly: true, overlapOnly: undefined,
  });
  assert.deepEqual(parsePagination(new URLSearchParams()), { page: 1, pageSize: 25 });
});

test('invalid pagination, booleans, and enum filters return a validation error', () => {
  for (const params of [
    new URLSearchParams('page=0'),
    new URLSearchParams('pageSize=101'),
    new URLSearchParams('overdueOnly=yes'),
    new URLSearchParams('status=MADE_UP'),
    new URLSearchParams('sort=unstable'),
  ]) {
    assert.throws(() => parseCaseFilters(params), (error) => error instanceof ApiError && error.status === 400);
  }
});

test('institution and overlap filters validate their enums', () => {
  assert.equal(parseInstitutionFilters(new URLSearchParams('bureau=UGC_VIGILANCE')).bureau, 'UGC_VIGILANCE');
  assert.equal(parseOverlapFilters(new URLSearchParams('status=FURTHER_COORDINATION')).status, 'FURTHER_COORDINATION');
  assert.throws(() => parseInstitutionFilters(new URLSearchParams('riskRating=UNKNOWN')), ApiError);
  assert.throws(() => parseOverlapFilters(new URLSearchParams('matchType=UNKNOWN')), ApiError);
});
