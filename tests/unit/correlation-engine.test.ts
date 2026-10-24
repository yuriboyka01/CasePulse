import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES } from '../../src/data/synthetic-dataset';
import {
  CORRELATION_POLICY,
  detectCrossBureauOverlaps,
} from '../../src/lib/correlation-engine';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function makeCases(nameA: string, nameB: string, filingDateB: string) {
  const source = CASES[0];
  const target = CASES.find((item) => item.bureauId !== source.bureauId)!;
  return [
    { ...source, id: 'CP-TEST-001', institutionName: nameA, aisheCode: '', filingDate: '2026-01-01T00:00:00.000Z' },
    { ...target, id: 'CP-TEST-002', institutionName: nameB, aisheCode: '', filingDate: filingDateB },
  ];
}

test('name candidate generation and evidence share the inclusive 0.75 boundary', () => {
  assert.equal(CORRELATION_POLICY.institutionNameSimilarityThreshold, 0.75);
  const atThreshold = makeCases(
    'Apex Orion Beacon Institute',
    'Apex Orion Beacon Nimbus Institute',
    '2026-01-01T00:00:00.000Z'
  );
  const overlap = detectCrossBureauOverlaps(atThreshold, [])[0];

  assert.ok(overlap, '0.75 similarity should generate a candidate');
  assert.equal(
    overlap.evidenceMatches.find((item) => item.key === 'institution_name')?.isMatch,
    true
  );

  const belowThreshold = makeCases(
    'Apex Orion Beacon Institute',
    'Apex Orion Beacon Nimbus Quartz Institute',
    '2026-01-01T00:00:00.000Z'
  );
  assert.equal(detectCrossBureauOverlaps(belowThreshold, []).length, 0);
});

test('temporal evidence and score bonus share inclusive 60-day elapsed boundaries', () => {
  assert.equal(CORRELATION_POLICY.temporalWindowDays, 60);
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  const atBoundary = makeCases(
    'Apex Institute',
    'Apex Institute',
    new Date(start + 60 * DAY_IN_MILLISECONDS).toISOString()
  );
  const atBoundaryOverlap = detectCrossBureauOverlaps(atBoundary, [])[0];

  assert.ok(atBoundaryOverlap);
  assert.equal(
    atBoundaryOverlap.evidenceMatches.find((item) => item.key === 'temporal_proximity')?.isMatch,
    true
  );
  assert.ok(atBoundaryOverlap.reasons.some((reason) => reason.includes('within 60 days')));

  const outsideBoundary = makeCases(
    'Apex Institute',
    'Apex Institute',
    new Date(start + 60 * DAY_IN_MILLISECONDS + 1).toISOString()
  );
  const outsideBoundaryOverlap = detectCrossBureauOverlaps(outsideBoundary, [])[0];

  assert.ok(outsideBoundaryOverlap);
  assert.equal(
    outsideBoundaryOverlap.evidenceMatches.find((item) => item.key === 'temporal_proximity')?.isMatch,
    false
  );
  assert.equal(
    outsideBoundaryOverlap.reasons.some((reason) => reason.includes('concurrent inquiry period')),
    false
  );
});

test('empty and whitespace-only names do not produce institution candidates', () => {
  for (const name of ['', '   ', '\t\n']) {
    const cases = makeCases(name, name, '2026-01-15T00:00:00.000Z');
    assert.equal(detectCrossBureauOverlaps(cases, []).length, 0, JSON.stringify(name));
  }
});

test('malformed filing dates produce deterministic evidence without aborting other candidates', () => {
  const malformed = makeCases('Registry Match Academy', 'Registry Match Academy', 'not-a-date');
  malformed[0].filingDate = '2026-02-30T12:00:00.000Z';
  malformed[0].aisheCode = 'SYN-INVALID-DATE';
  malformed[1].aisheCode = 'SYN-INVALID-DATE';

  const partialDate = makeCases(
    'Partial Date Academy',
    'Partial Date Academy',
    '2026-03-01T00:00:00.000Z'
  );
  partialDate[0].id = 'CP-TEST-PARTIAL-001';
  partialDate[1].id = 'CP-TEST-PARTIAL-002';
  partialDate[0].filingDate = 'not-a-date';
  partialDate[0].aisheCode = 'SYN-PARTIAL-DATE';
  partialDate[1].aisheCode = 'SYN-PARTIAL-DATE';

  const valid = makeCases('Normal Match Institute', 'Normal Match Institute', '2026-01-15T00:00:00.000Z');
  valid[0].id = 'CP-TEST-VALID-001';
  valid[1].id = 'CP-TEST-VALID-002';
  valid[0].aisheCode = 'SYN-VALID-DATE';
  valid[1].aisheCode = 'SYN-VALID-DATE';

  const allCases = [...malformed, ...partialDate, ...valid];
  const firstRun = detectCrossBureauOverlaps(allCases, []);
  const secondRun = detectCrossBureauOverlaps(allCases, []);
  const invalidDateOverlap = firstRun.find((overlap) => overlap.sourceCaseId === malformed[0].id);
  const partialDateOverlap = firstRun.find((overlap) => overlap.sourceCaseId === partialDate[0].id);

  assert.equal(firstRun.length, 3, 'invalid-date pairs must not suppress other candidates');
  assert.ok(invalidDateOverlap);
  assert.ok(partialDateOverlap);
  assert.equal(invalidDateOverlap.flaggedDate, '');
  assert.equal(partialDateOverlap.flaggedDate, '2026-03-01T00:00:00.000Z');
  assert.ok(invalidDateOverlap.reasons.some((reason) => reason.includes('Temporal evidence unavailable')));
  assert.equal(
    invalidDateOverlap.evidenceMatches.find((item) => item.key === 'temporal_proximity')?.isMatch,
    false
  );
  assert.match(
    invalidDateOverlap.evidenceMatches.find((item) => item.key === 'temporal_proximity')?.description ?? '',
    /invalid or missing/
  );
  assert.deepEqual(firstRun, secondRun, 'invalid-date outcomes are deterministic');
});

test('exact AISHE matches remain candidates when name and institution-master evidence are missing', () => {
  const cases = makeCases('', '', '2026-01-15T00:00:00.000Z');
  cases[0].aisheCode = 'SYN-EXACT-ONLY';
  cases[1].aisheCode = 'syn-exact-only';

  const overlap = detectCrossBureauOverlaps(cases, [])[0];

  assert.ok(overlap);
  assert.equal(overlap.matchType, 'CONFIRMED_ID');
  assert.equal(overlap.evidenceMatches.find((item) => item.key === 'institution_name')?.isMatch, false);
  assert.equal(overlap.evidenceMatches.find((item) => item.key === 'geography'), undefined);
  assert.equal(overlap.evidenceMatches.find((item) => item.key === 'temporal_proximity')?.isMatch, true);
});

test('successful institution-name matches retain explainable evidence and valid flagged dates', () => {
  const cases = makeCases('Apex Orion Beacon Institute', 'Apex Orion Beacon Nimbus Institute', '2026-01-15T00:00:00.000Z');
  const overlap = detectCrossBureauOverlaps(cases, [])[0];

  assert.ok(overlap);
  assert.equal(overlap.evidenceMatches.find((item) => item.key === 'institution_name')?.isMatch, true);
  assert.equal(overlap.evidenceMatches.find((item) => item.key === 'temporal_proximity')?.isMatch, true);
  assert.equal(overlap.flaggedDate, '2026-01-15T00:00:00.000Z');
  assert.ok(overlap.reasons.some((reason) => reason.includes('High token similarity')));
});
