import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, INSTITUTIONS } from '../../src/data/synthetic-dataset';
import { detectCrossBureauOverlaps } from '../../src/lib/correlation-engine';
import type { CaseComplaint, Institution } from '../../src/types';
import {
  CORRELATION_BENCHMARK,
  CORRELATION_BENCHMARK_DEFAULTS,
  CORRELATION_BENCHMARK_VERSION,
  type BenchmarkPair,
} from '../fixtures/correlation-benchmark-v1';

function makePair(pair: BenchmarkPair): { cases: CaseComplaint[]; institutions: Institution[] } {
  const defaults = CORRELATION_BENCHMARK_DEFAULTS;
  const institutionIdA = pair.institutionIdA ?? defaults.institutionIdA;
  const institutionIdB = pair.institutionIdB ?? defaults.institutionIdB;
  const base = CASES[0];
  const cases = [
    {
      ...base,
      id: `CP-BENCH-${pair.id}-A`,
      bureauId: pair.bureauA ?? defaults.bureauA,
      institutionId: institutionIdA,
      institutionName: pair.nameA ?? defaults.nameA,
      aisheCode: pair.aisheA ?? `NO-AISHE-${pair.id}-A`,
      category: pair.complaintCategoryA ?? defaults.complaintCategoryA,
      filingDate: pair.filingDateA ?? defaults.filingDateA,
    },
    {
      ...base,
      id: `CP-BENCH-${pair.id}-B`,
      bureauId: pair.bureauB ?? defaults.bureauB,
      institutionId: institutionIdB,
      institutionName: pair.nameB ?? defaults.nameB,
      aisheCode: pair.aisheB ?? `NO-AISHE-${pair.id}-B`,
      category: pair.complaintCategoryB ?? defaults.complaintCategoryB,
      filingDate: pair.filingDateB ?? defaults.filingDateB,
    },
  ] satisfies CaseComplaint[];

  const baseInstitution = INSTITUTIONS[0];
  const institutions = [
    {
      ...baseInstitution,
      id: institutionIdA,
      aictePermanentId: pair.aicteA,
      state: pair.stateA ?? defaults.stateA,
      district: pair.districtA ?? defaults.districtA,
    },
    {
      ...baseInstitution,
      id: institutionIdB,
      aictePermanentId: pair.aicteB,
      state: pair.stateB ?? defaults.stateB,
      district: pair.districtB ?? defaults.districtB,
    },
  ] satisfies Institution[];

  return { cases, institutions };
}

type PairResult = {
  pair: BenchmarkPair;
  candidate: boolean;
  expectedCandidate: boolean;
  nameEvidenceMatch?: boolean;
  actualDuplicateClassification: boolean;
  detectorError?: string;
};

export function measureCorrelationBenchmark(pairs = CORRELATION_BENCHMARK): PairResult[] {
  return pairs.map((pair) => {
    const { cases, institutions } = makePair(pair);
    let overlaps;
    let detectorError: string | undefined;
    try {
      overlaps = detectCrossBureauOverlaps(cases, institutions);
    } catch (error) {
      detectorError = error instanceof Error ? error.message : String(error);
      // The engine reaches serialization only after it has accepted the pair as a candidate.
      overlaps = [{} as (typeof overlaps extends (infer Item)[] ? Item : never)];
    }
    const overlap = overlaps[0];
    const crossBureau = cases[0].bureauId !== cases[1].bureauId;

    return {
      pair,
      candidate: Boolean(overlap),
      expectedCandidate: crossBureau && pair.expectedSameInstitution,
      nameEvidenceMatch: overlap?.evidenceMatches?.find((evidence) => evidence.key === 'institution_name')?.isMatch,
      actualDuplicateClassification: overlap?.relationshipKind === 'POTENTIAL_DUPLICATE_COMPLAINT',
      detectorError,
    };
  });
}

test(`${CORRELATION_BENCHMARK_VERSION} has at least 30 explicit labelled scenarios`, () => {
  assert.ok(CORRELATION_BENCHMARK.length >= 30);
  assert.equal(new Set(CORRELATION_BENCHMARK.map((pair) => pair.id)).size, CORRELATION_BENCHMARK.length);
  assert.ok(CORRELATION_BENCHMARK.every((pair) => pair.rationale.length > 0));
});

test('synthetic benchmark reports deterministic candidate metrics', (context) => {
  const results = measureCorrelationBenchmark();
  const truePositives = results.filter((result) => result.candidate && result.expectedCandidate).length;
  const falsePositives = results.filter((result) => result.candidate && !result.expectedCandidate).length;
  const falseNegatives = results.filter((result) => !result.candidate && result.expectedCandidate).length;
  const trueNegatives = results.filter((result) => !result.candidate && !result.expectedCandidate).length;
  const precision = truePositives / (truePositives + falsePositives);
  const recall = truePositives / (truePositives + falseNegatives);
  const f1 = (2 * precision * recall) / (precision + recall);
  const detectorErrors = results.filter((result) => result.detectorError);

  context.diagnostic(
    `${CORRELATION_BENCHMARK_VERSION}: n=${results.length}, TP=${truePositives}, FP=${falsePositives}, FN=${falseNegatives}, TN=${trueNegatives}, precision=${precision.toFixed(3)}, recall=${recall.toFixed(3)}, F1=${f1.toFixed(3)}, errors=${detectorErrors.length} (${detectorErrors.map((result) => result.pair.id).join(', ') || 'none'})`
  );
  context.diagnostic(
    `false positives: ${results.filter((result) => result.candidate && !result.expectedCandidate).map((result) => result.pair.id).join(', ') || 'none'}`
  );
  context.diagnostic(
    `false negatives: ${results.filter((result) => !result.candidate && result.expectedCandidate).map((result) => result.pair.id).join(', ') || 'none'}`
  );
  const categories = [...new Set(results.map((result) => result.pair.category))];
  for (const category of categories) {
    const group = results.filter((result) => result.pair.category === category);
    const tp = group.filter((result) => result.candidate && result.expectedCandidate).length;
    const fp = group.filter((result) => result.candidate && !result.expectedCandidate).length;
    const fn = group.filter((result) => !result.candidate && result.expectedCandidate).length;
    const tn = group.filter((result) => !result.candidate && !result.expectedCandidate).length;
    context.diagnostic(`${category}: n=${group.length}, TP=${tp}, FP=${fp}, FN=${fn}, TN=${tn}`);
  }

  assert.equal(results.length, CORRELATION_BENCHMARK.length);
  assert.deepEqual(
    { truePositives, falsePositives, falseNegatives, trueNegatives, errors: detectorErrors.length },
    { truePositives: 23, falsePositives: 2, falseNegatives: 2, trueNegatives: 9, errors: 0 }
  );
  assert.deepEqual(
    results.filter((result) => result.candidate && !result.expectedCandidate).map((result) => result.pair.id),
    ['HOMONYM-03', 'ADVERSARIAL-02']
  );
  assert.deepEqual(
    results.filter((result) => !result.candidate && result.expectedCandidate).map((result) => result.pair.id),
    ['NAME-BOUNDARY-BELOW', 'WEAK-01']
  );
  assert.ok(Number.isFinite(precision));
  assert.ok(Number.isFinite(recall));
});

test('candidate and name evidence agree at and below the inclusive name boundary', () => {
  const results = measureCorrelationBenchmark();
  const atBoundary = results.find((result) => result.pair.id === 'NAME-BOUNDARY-AT')!;
  const belowBoundary = results.find((result) => result.pair.id === 'NAME-BOUNDARY-BELOW')!;
  const aboveBoundary = results.find((result) => result.pair.id === 'NAME-BOUNDARY-ABOVE')!;

  assert.equal(atBoundary.candidate, true);
  assert.equal(atBoundary.nameEvidenceMatch, true);
  assert.equal(belowBoundary.candidate, false);
  assert.equal(belowBoundary.nameEvidenceMatch, undefined);
  assert.equal(aboveBoundary.candidate, true);
  assert.equal(aboveBoundary.nameEvidenceMatch, true);
});

test('shared institution IDs do not automatically classify duplicate complaints', () => {
  const results = measureCorrelationBenchmark();
  const duplicateLabels = results.filter((result) => result.pair.expectedPotentialDuplicate);

  assert.equal(duplicateLabels.length, 2);
  assert.ok(duplicateLabels.every((result) => result.candidate));
  assert.ok(duplicateLabels.every((result) => !result.actualDuplicateClassification));
});
