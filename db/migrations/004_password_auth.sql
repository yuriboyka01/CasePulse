CREATE TABLE officer_password_credentials (
  officer_id text PRIMARY KEY REFERENCES officers(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE officer_access_requests (
  id text PRIMARY KEY,
  email text NOT NULL,
  display_name text NOT NULL,
  requested_bureau_code text NOT NULL REFERENCES bureaus(code) ON DELETE RESTRICT,
  request_note text NOT NULL DEFAULT '',
  password_hash text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  CHECK ((status = 'PENDING' AND password_hash IS NOT NULL) OR (status <> 'PENDING' AND password_hash IS NULL))
);

CREATE UNIQUE INDEX officer_access_requests_pending_email_unique
  ON officer_access_requests (lower(btrim(email))) WHERE status = 'PENDING';
CREATE INDEX officer_access_requests_review_queue
  ON officer_access_requests (submitted_at, id) WHERE status = 'PENDING';
