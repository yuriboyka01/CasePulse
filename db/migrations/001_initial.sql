CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_name text PRIMARY KEY,
  checksum_sha256 text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bureaus (
  code text PRIMARY KEY,
  name text NOT NULL,
  short_name text NOT NULL,
  department text NOT NULL DEFAULT '',
  jurisdiction text NOT NULL DEFAULT '',
  is_synthetic boolean NOT NULL DEFAULT false
);

CREATE TABLE institutions (
  id text PRIMARY KEY,
  aishe_code text,
  aicte_permanent_id text,
  name text NOT NULL,
  normalized_name text NOT NULL DEFAULT '',
  category text NOT NULL CHECK (category IN ('ENGINEERING', 'MANAGEMENT', 'UNIVERSITY', 'POLYTECHNIC', 'PHARMACY', 'MEDICAL')),
  state text NOT NULL,
  district text NOT NULL,
  pincode text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  affiliated_university text NOT NULL DEFAULT '',
  established_year integer,
  approved_intake integer NOT NULL DEFAULT 0 CHECK (approved_intake >= 0),
  risk_rating text NOT NULL CHECK (risk_rating IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX institutions_aishe_code_unique
  ON institutions (upper(btrim(aishe_code))) WHERE aishe_code IS NOT NULL AND btrim(aishe_code) <> '';
CREATE UNIQUE INDEX institutions_aicte_id_unique
  ON institutions (upper(btrim(aicte_permanent_id))) WHERE aicte_permanent_id IS NOT NULL AND btrim(aicte_permanent_id) <> '';
CREATE INDEX institutions_name_search ON institutions (lower(name));
CREATE INDEX institutions_location ON institutions (lower(state), lower(district));

CREATE TABLE institution_bureaus (
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  bureau_code text NOT NULL REFERENCES bureaus(code) ON DELETE RESTRICT,
  PRIMARY KEY (institution_id, bureau_code)
);
CREATE INDEX institution_bureaus_by_bureau ON institution_bureaus (bureau_code, institution_id);

CREATE TABLE complaint_cases (
  id text PRIMARY KEY,
  bureau_code text NOT NULL REFERENCES bureaus(code) ON DELETE RESTRICT,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL CHECK (category IN (
    'CAPITATION_FEE', 'WITHHOLDING_DOCUMENTS', 'GHOST_FACULTY', 'RAGGING_HARASSMENT',
    'INFRASTRUCTURE_DEFICIT', 'UNAPPROVED_COURSES', 'EXAM_MALPRACTICE', 'FALSE_ACCREDITATION'
  )),
  severity text NOT NULL CHECK (severity IN ('ROUTINE', 'ELEVATED', 'HIGH', 'CRITICAL')),
  status text NOT NULL CHECK (status IN (
    'NEW', 'UNDER_INVESTIGATION', 'HEARING_SCHEDULED', 'ACTION_PENDING',
    'JOINT_INQUIRY', 'RESOLVED', 'CLOSED'
  )),
  complainant_type text NOT NULL CHECK (complainant_type IN ('STUDENT', 'FACULTY', 'PARENT', 'WHISTLEBLOWER', 'ANONYMOUS')),
  filing_date timestamptz NOT NULL,
  sla_due_date timestamptz NOT NULL,
  assigned_officer_id text,
  assigned_officer_name text NOT NULL DEFAULT '',
  assigned_officer_designation text NOT NULL DEFAULT '',
  assigned_officer_email text NOT NULL DEFAULT '',
  evidence_files_count integer NOT NULL DEFAULT 0 CHECK (evidence_files_count >= 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX complaint_cases_bureau_date ON complaint_cases (bureau_code, filing_date DESC, id);
CREATE INDEX complaint_cases_institution_date ON complaint_cases (institution_id, filing_date DESC, id);
CREATE INDEX complaint_cases_status_sla ON complaint_cases (status, sla_due_date);
CREATE INDEX complaint_cases_search ON complaint_cases (lower(title), lower(id));

CREATE TABLE case_actions (
  id text PRIMARY KEY,
  case_id text NOT NULL REFERENCES complaint_cases(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL,
  actor_id text,
  actor_display_name text NOT NULL,
  bureau_code text NOT NULL REFERENCES bureaus(code) ON DELETE RESTRICT,
  action_type text NOT NULL CHECK (action_type IN (
    'FILING', 'STATUS_CHANGE', 'HEARING', 'NOTICE_ISSUED', 'OVERLAP_FLAG',
    'INTER_BUREAU_SYNC', 'PENALTY_ISSUED', 'CLOSURE', 'CASE_RELATIONSHIP_REVIEWED',
    'JOINT_INQUIRY_STARTED', 'ASSIGNMENT_CHANGED', 'TRANSFERRED', 'ESCALATED'
  )),
  action text NOT NULL,
  notes text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_synthetic boolean NOT NULL DEFAULT false
);
CREATE INDEX case_actions_timeline ON case_actions (case_id, occurred_at DESC, id DESC);
CREATE INDEX case_actions_actor ON case_actions (actor_id, occurred_at DESC) WHERE actor_id IS NOT NULL;

CREATE TABLE case_relationships (
  id text PRIMARY KEY,
  source_case_id text NOT NULL REFERENCES complaint_cases(id) ON DELETE RESTRICT,
  target_case_id text NOT NULL REFERENCES complaint_cases(id) ON DELETE RESTRICT,
  relationship_kind text NOT NULL CHECK (relationship_kind IN (
    'SAME_INSTITUTION', 'RELATED_INCIDENT', 'POTENTIAL_DUPLICATE_COMPLAINT'
  )),
  match_type text NOT NULL CHECK (match_type IN ('CONFIRMED_ID', 'HIGH_PROBABILITY_NAME', 'PATTERN_CORRELATION')),
  confidence_score integer NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'CONFIRMED', 'REJECTED', 'FURTHER_COORDINATION')),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reasons) = 'array'),
  evidence_matches jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_matches) = 'array'),
  recommended_action text NOT NULL DEFAULT '',
  matcher_version text NOT NULL,
  flagged_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_case_id <> target_case_id)
);
CREATE UNIQUE INDEX case_relationships_pair_unique
  ON case_relationships (LEAST(source_case_id, target_case_id), GREATEST(source_case_id, target_case_id));
CREATE INDEX case_relationships_status_date ON case_relationships (status, flagged_at DESC, id);
CREATE INDEX case_relationships_source ON case_relationships (source_case_id, flagged_at DESC);
CREATE INDEX case_relationships_target ON case_relationships (target_case_id, flagged_at DESC);

CREATE TABLE overlap_reviews (
  id text PRIMARY KEY,
  relationship_id text NOT NULL REFERENCES case_relationships(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('CONFIRMED', 'REJECTED', 'FURTHER_COORDINATION')),
  notes text NOT NULL DEFAULT '',
  reviewer_id text NOT NULL,
  reviewer_display_name text NOT NULL,
  reviewer_bureau_code text NOT NULL REFERENCES bureaus(code) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  previous_version integer NOT NULL CHECK (previous_version > 0),
  new_version integer NOT NULL CHECK (new_version = previous_version + 1),
  is_synthetic boolean NOT NULL DEFAULT false,
  UNIQUE (relationship_id, new_version)
);
CREATE INDEX overlap_reviews_history ON overlap_reviews (relationship_id, reviewed_at DESC, id DESC);
CREATE INDEX overlap_reviews_reviewer ON overlap_reviews (reviewer_id, reviewed_at DESC);

CREATE FUNCTION prevent_casepulse_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CASEPULSE audit records are append-only';
END;
$$;

CREATE TRIGGER case_actions_append_only
  BEFORE UPDATE OR DELETE ON case_actions
  FOR EACH ROW EXECUTE FUNCTION prevent_casepulse_audit_mutation();
CREATE TRIGGER overlap_reviews_append_only
  BEFORE UPDATE OR DELETE ON overlap_reviews
  FOR EACH ROW EXECUTE FUNCTION prevent_casepulse_audit_mutation();
