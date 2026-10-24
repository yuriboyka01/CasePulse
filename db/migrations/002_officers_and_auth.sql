CREATE TABLE IF NOT EXISTS officers (
  id text PRIMARY KEY,
  email text NOT NULL,
  display_name text NOT NULL,
  designation text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS officers_email_unique
  ON officers (lower(btrim(email)));

CREATE TABLE IF NOT EXISTS officer_identities (
  id text PRIMARY KEY,
  officer_id text NOT NULL REFERENCES officers(id) ON DELETE CASCADE,
  issuer text NOT NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT officer_identities_issuer_subject_unique UNIQUE (issuer, subject)
);

CREATE INDEX IF NOT EXISTS officer_identities_officer_id
  ON officer_identities (officer_id);

CREATE TABLE IF NOT EXISTS officer_bureaus (
  officer_id text NOT NULL REFERENCES officers(id) ON DELETE CASCADE,
  bureau_code text NOT NULL REFERENCES bureaus(code) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (officer_id, bureau_code)
);

CREATE INDEX IF NOT EXISTS officer_bureaus_bureau
  ON officer_bureaus (bureau_code, officer_id);

CREATE TABLE IF NOT EXISTS officer_roles (
  officer_id text NOT NULL REFERENCES officers(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OFFICER', 'CROSS_BUREAU_VIEW', 'ADMIN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (officer_id, role)
);

CREATE INDEX IF NOT EXISTS officer_roles_role
  ON officer_roles (role, officer_id);
