import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySeedRelationship } from '../../scripts/db-seed';

test('exact registry identifier candidates classify as institution matches, not duplicate complaints', () => {
  assert.equal(classifySeedRelationship('CONFIRMED_ID'), 'SAME_INSTITUTION');
  assert.equal(classifySeedRelationship('HIGH_PROBABILITY_NAME', 'INST-001', 'INST-001'), 'SAME_INSTITUTION');
  assert.equal(classifySeedRelationship('HIGH_PROBABILITY_NAME', 'INST-001', 'INST-002'), 'RELATED_INCIDENT');
  assert.notEqual(classifySeedRelationship('CONFIRMED_ID'), 'POTENTIAL_DUPLICATE_COMPLAINT');
});

test('name and pattern candidates remain related incident proposals', () => {
  assert.equal(classifySeedRelationship('HIGH_PROBABILITY_NAME'), 'RELATED_INCIDENT');
  assert.equal(classifySeedRelationship('PATTERN_CORRELATION'), 'RELATED_INCIDENT');
});
