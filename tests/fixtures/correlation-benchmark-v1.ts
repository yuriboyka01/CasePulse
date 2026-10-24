import type { BureauCode, ComplaintCategory } from '../../src/types';

/** Synthetic, manually labelled cross-bureau case pairs for detector regression. */
export const CORRELATION_BENCHMARK_VERSION = 'correlation-synthetic-v1';

export type BenchmarkPair = {
  id: string;
  category: string;
  rationale: string;
  nameA?: string;
  nameB?: string;
  bureauA?: BureauCode;
  bureauB?: BureauCode;
  institutionIdA?: string;
  institutionIdB?: string;
  aisheA?: string;
  aisheB?: string;
  aicteA?: string;
  aicteB?: string;
  stateA?: string;
  stateB?: string;
  districtA?: string;
  districtB?: string;
  filingDateA?: string;
  filingDateB?: string;
  complaintCategoryA?: ComplaintCategory;
  complaintCategoryB?: ComplaintCategory;
  expectedSameInstitution: boolean;
  expectedRelatedIncident: boolean;
  expectedPotentialDuplicate: boolean;
};

const defaults = {
  nameA: 'Synthetic Cedar Institute',
  nameB: 'Synthetic Cedar Institute',
  institutionIdA: 'BENCH-INST-A',
  institutionIdB: 'BENCH-INST-B',
  stateA: 'Synthetic State',
  stateB: 'Synthetic State',
  districtA: 'North District',
  districtB: 'North District',
  filingDateA: '2026-01-01T00:00:00.000Z',
  filingDateB: '2026-01-15T00:00:00.000Z',
  complaintCategoryA: 'CAPITATION_FEE' as ComplaintCategory,
  complaintCategoryB: 'CAPITATION_FEE' as ComplaintCategory,
  expectedRelatedIncident: false,
  expectedPotentialDuplicate: false,
  bureauA: 'AICTE_APPROVAL' as BureauCode,
  bureauB: 'UGC_VIGILANCE' as BureauCode,
};

export const CORRELATION_BENCHMARK: BenchmarkPair[] = [
  { id: 'AISHE-01', category: 'AISHE exact ID', rationale: 'Same AISHE registry key across bureaus; different complaint topics.', nameA: 'Cedar Technical Institute', nameB: 'Cedar Technical Institute - East', aisheA: 'SYN-C-1001', aisheB: 'syn-c-1001', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'AISHE-02', category: 'AISHE exact ID', rationale: 'Exact AISHE identity despite substantial name variation.', nameA: 'Maple College', nameB: 'Maple Institute of Applied Studies', aisheA: 'SYN-C-1002', aisheB: 'SYN-C-1002', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'AISHE-03', category: 'AISHE exact ID', rationale: 'Registry match still indicates entity identity only, not duplicate complaints.', nameA: 'Juniper Polytechnic', nameB: 'Juniper Technical Campus', aisheA: 'SYN-C-1003', aisheB: 'SYN-C-1003', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },

  { id: 'AICTE-01', category: 'AICTE exact ID', rationale: 'Same AICTE permanent ID in institution master records.', nameA: 'Birch Engineering School', nameB: 'Birch School of Engineering', aicteA: 'SYN-A-2001', aicteB: 'SYN-A-2001', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'AICTE-02', category: 'AICTE exact ID', rationale: 'Exact AICTE identity with different bureau and category.', nameA: 'Willow Technical College', nameB: 'Willow Institute', aicteA: 'SYN-A-2002', aicteB: 'SYN-A-2002', complaintCategoryA: 'GHOST_FACULTY', complaintCategoryB: 'INFRASTRUCTURE_DEFICIT', expectedSameInstitution: true, expectedRelatedIncident: true, expectedPotentialDuplicate: false },
  { id: 'AICTE-03', category: 'AICTE exact ID', rationale: 'Identifier establishes institution identity, not a repeated complaint.', nameA: 'Ash Management Academy', nameB: 'Ash Management Centre', aicteA: 'SYN-A-2003', aicteB: 'SYN-A-2003', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },

  { id: 'NAME-VARIATION-01', category: 'Name variation at/above 0.75', rationale: 'Three of four normalized tokens overlap (0.75); same entity.', nameA: 'Apex Orion Beacon Institute', nameB: 'Apex Orion Beacon Nimbus Institute', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'NAME-VARIATION-02', category: 'Name variation at/above 0.75', rationale: 'Exact name after punctuation/case normalization.', nameA: 'Silver Oak College', nameB: 'SILVER OAK COLLEGE', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'NAME-VARIATION-03', category: 'Name variation at/above 0.75', rationale: 'Three shared meaningful tokens plus one added token (0.75).', nameA: 'Redwood Valley Applied Institute', nameB: 'Redwood Valley Applied Central Institute', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },

  { id: 'NAME-BOUNDARY-AT', category: 'Name threshold boundary', rationale: 'Three shared tokens over four total gives exactly 0.75; threshold is inclusive.', nameA: 'Apex Orion Beacon Institute', nameB: 'Apex Orion Beacon Nimbus Institute', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'NAME-BOUNDARY-BELOW', category: 'Name threshold boundary', rationale: 'Two shared tokens over three total gives 0.667, the nearest small-token ratio below 0.75.', nameA: 'Apex Orion Institute', nameB: 'Apex Orion Nimbus Institute', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'NAME-BOUNDARY-ABOVE', category: 'Name threshold boundary', rationale: 'Four shared tokens over five total gives 0.80, just above threshold.', nameA: 'Apex Orion Beacon Cedar Institute', nameB: 'Apex Orion Beacon Cedar Nimbus Institute', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },

  { id: 'INDEPENDENT-01', category: 'Same institution, independent topics', rationale: 'Same registry and institution but unrelated categories and distant filing dates.', aisheA: 'SYN-C-3001', aisheB: 'SYN-C-3001', complaintCategoryA: 'RAGGING_HARASSMENT', complaintCategoryB: 'FALSE_ACCREDITATION', filingDateB: '2026-06-01T00:00:00.000Z', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'INDEPENDENT-02', category: 'Same institution, independent topics', rationale: 'Same institution; capitation and unrelated ragging allegations are not a duplicate.', aisheA: 'SYN-C-3002', aisheB: 'SYN-C-3002', complaintCategoryA: 'CAPITATION_FEE', complaintCategoryB: 'RAGGING_HARASSMENT', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'INDEPENDENT-03', category: 'Same institution, independent topics', rationale: 'Same ID but non-overlapping exam and infrastructure complaints separated by 100 days.', aisheA: 'SYN-C-3003', aisheB: 'SYN-C-3003', complaintCategoryA: 'EXAM_MALPRACTICE', complaintCategoryB: 'INFRASTRUCTURE_DEFICIT', filingDateB: '2026-04-11T00:00:00.000Z', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },

  { id: 'RELATED-01', category: 'Related topics and close dates', rationale: 'Same entity; recognized ghost-faculty/infrastructure category pairing within 14 days.', aisheA: 'SYN-C-4001', aisheB: 'SYN-C-4001', complaintCategoryA: 'GHOST_FACULTY', complaintCategoryB: 'INFRASTRUCTURE_DEFICIT', expectedSameInstitution: true, expectedRelatedIncident: true, expectedPotentialDuplicate: false },
  { id: 'RELATED-02', category: 'Related topics and close dates', rationale: 'Same entity; document withholding and capitation are mapped related categories within 60 days.', aisheA: 'SYN-C-4002', aisheB: 'SYN-C-4002', complaintCategoryA: 'WITHHOLDING_DOCUMENTS', complaintCategoryB: 'CAPITATION_FEE', filingDateB: '2026-03-02T00:00:00.000Z', expectedSameInstitution: true, expectedRelatedIncident: true, expectedPotentialDuplicate: false },
  { id: 'RELATED-03', category: 'Related topics and close dates', rationale: 'Same entity and same category within two days; incident linkage is plausible, duplicate is unproven.', aisheA: 'SYN-C-4003', aisheB: 'SYN-C-4003', filingDateB: '2026-01-03T00:00:00.000Z', expectedSameInstitution: true, expectedRelatedIncident: true, expectedPotentialDuplicate: false },

  { id: 'DISTANT-01', category: 'Unrelated categories / outside window', rationale: 'Same registry; unrelated categories and 90-day separation.', aisheA: 'SYN-C-5001', aisheB: 'SYN-C-5001', complaintCategoryA: 'CAPITATION_FEE', complaintCategoryB: 'EXAM_MALPRACTICE', filingDateB: '2026-04-01T00:00:00.000Z', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'DISTANT-02', category: 'Unrelated categories / outside window', rationale: 'Same registry; false accreditation and ragging complaints 120 days apart.', aisheA: 'SYN-C-5002', aisheB: 'SYN-C-5002', complaintCategoryA: 'FALSE_ACCREDITATION', complaintCategoryB: 'RAGGING_HARASSMENT', filingDateB: '2026-05-01T00:00:00.000Z', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'DISTANT-03', category: 'Unrelated categories / outside window', rationale: 'Same registry; document withholding and exam malpractice six months apart.', aisheA: 'SYN-C-5003', aisheB: 'SYN-C-5003', complaintCategoryA: 'WITHHOLDING_DOCUMENTS', complaintCategoryB: 'EXAM_MALPRACTICE', filingDateB: '2026-07-01T00:00:00.000Z', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },

  { id: 'HOMONYM-01', category: 'Similar names, distinct institution/campus', rationale: 'Name-only match but distinct state and campus; detector still emits a name candidate.', nameA: 'Pioneer Institute of Science, North City', nameB: 'Pioneer Institute of Science, South City', stateA: 'Synthetic State A', stateB: 'Synthetic State B', districtA: 'North City', districtB: 'South City', expectedSameInstitution: false, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'HOMONYM-02', category: 'Similar names, distinct institution/campus', rationale: 'Shared name with different districts and registry IDs represents separate local institutions.', nameA: 'Riverbend Polytechnic Central Campus', nameB: 'Riverbend Polytechnic West Campus', districtA: 'Central District', districtB: 'West District', expectedSameInstitution: false, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'HOMONYM-03', category: 'Similar names, distinct institution/campus', rationale: 'Same brand-like tokens in separate states; no shared identifier.', nameA: 'Summit Valley University', nameB: 'Summit Valley University', stateA: 'Synthetic State A', stateB: 'Synthetic State B', districtA: 'Hill District', districtB: 'Lake District', expectedSameInstitution: false, expectedRelatedIncident: false, expectedPotentialDuplicate: false },

  { id: 'WEAK-01', category: 'Missing IDs / weak names', rationale: 'No identifiers and dissimilar names; true same entity is missed.', nameA: 'Cedar Institute', nameB: 'Meadow Technical School', aisheA: '', aisheB: '', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'WEAK-02', category: 'Missing IDs / weak names', rationale: 'No identifiers; one common generic token is insufficient to candidate.', nameA: 'National Learning Centre', nameB: 'National Technical Academy', aisheA: '', aisheB: '', expectedSameInstitution: false, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'WEAK-03', category: 'Missing IDs / weak names', rationale: 'Names normalize to empty after stop-word removal; no identifiers.', nameA: 'The Institute of Technology', nameB: 'College of Education', aisheA: '', aisheB: '', expectedSameInstitution: false, expectedRelatedIncident: false, expectedPotentialDuplicate: false },

  { id: 'SAME-BUREAU-01', category: 'Same-bureau exclusion', rationale: 'Same bureau and exact identifiers; excluded by cross-bureau candidate definition.', bureauA: 'AICTE_APPROVAL', bureauB: 'AICTE_APPROVAL', aisheA: 'SYN-C-7001', aisheB: 'SYN-C-7001', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'SAME-BUREAU-02', category: 'Same-bureau exclusion', rationale: 'Same bureau and exact name; internal pair is not a cross-bureau candidate.', bureauA: 'UGC_VIGILANCE', bureauB: 'UGC_VIGILANCE', nameA: 'Cobalt Institute', nameB: 'Cobalt Institute', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'SAME-BUREAU-03', category: 'Same-bureau exclusion', rationale: 'Same bureau and highly similar names remain excluded.', bureauA: 'CONSUMER_FORUM', bureauB: 'CONSUMER_FORUM', nameA: 'Pinecrest Academy', nameB: 'Pinecrest Academy North', expectedSameInstitution: true, expectedRelatedIncident: false, expectedPotentialDuplicate: false },

  { id: 'ADVERSARIAL-01', category: 'Adversarial names / dates', rationale: 'Empty names and malformed dates: no identity signal; date evidence must not create candidate.', nameA: '', nameB: '', aisheA: '', aisheB: '', filingDateA: 'not-a-date', filingDateB: 'also-not-a-date', expectedSameInstitution: false, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'ADVERSARIAL-02', category: 'Adversarial names / dates', rationale: 'Generic common tokens create an exact-name candidate despite distinct entities.', nameA: 'National Institute', nameB: 'National Institute', expectedSameInstitution: false, expectedRelatedIncident: false, expectedPotentialDuplicate: false },
  { id: 'ADVERSARIAL-03', category: 'Adversarial names / dates', rationale: 'Common token overlap is weak; a malformed date cannot compensate for names below threshold.', nameA: 'National River Academy', nameB: 'National Hill Academy', filingDateA: 'bad-date', filingDateB: '2026-01-15', expectedSameInstitution: false, expectedRelatedIncident: false, expectedPotentialDuplicate: false },

  { id: 'DUPLICATE-01', category: 'Potential duplicate complaint', rationale: 'Same institution and same category/date, but ID sharing alone cannot establish duplicate complaint.', aisheA: 'SYN-C-8001', aisheB: 'SYN-C-8001', expectedSameInstitution: true, expectedRelatedIncident: true, expectedPotentialDuplicate: true },
  { id: 'DUPLICATE-02', category: 'Potential duplicate complaint', rationale: 'Near-identical complaint scenario at same institution; duplicate evidence is labelled but unavailable to detector.', aisheA: 'SYN-C-8002', aisheB: 'SYN-C-8002', complaintCategoryA: 'WITHHOLDING_DOCUMENTS', complaintCategoryB: 'WITHHOLDING_DOCUMENTS', filingDateB: '2026-01-02T00:00:00.000Z', expectedSameInstitution: true, expectedRelatedIncident: true, expectedPotentialDuplicate: true },
  { id: 'DUPLICATE-03', category: 'Potential duplicate complaint', rationale: 'Same registry but separate complainant events; shared institution must not auto-label duplicate.', aisheA: 'SYN-C-8003', aisheB: 'SYN-C-8003', complaintCategoryA: 'CAPITATION_FEE', complaintCategoryB: 'CAPITATION_FEE', filingDateB: '2026-01-02T00:00:00.000Z', expectedSameInstitution: true, expectedRelatedIncident: true, expectedPotentialDuplicate: false },
];

export const CORRELATION_BENCHMARK_DEFAULTS = defaults;
