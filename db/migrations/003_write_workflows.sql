ALTER TABLE case_actions DROP CONSTRAINT IF EXISTS case_actions_action_type_check;
ALTER TABLE case_actions ADD CONSTRAINT case_actions_action_type_check CHECK (action_type IN (
  'FILING', 'STATUS_CHANGE', 'NOTE_ADDED', 'HEARING', 'NOTICE_ISSUED', 'OVERLAP_FLAG',
  'INTER_BUREAU_SYNC', 'PENALTY_ISSUED', 'CLOSURE', 'CASE_RELATIONSHIP_REVIEWED',
  'JOINT_INQUIRY_STARTED', 'ASSIGNMENT_CHANGED', 'TRANSFERRED', 'ESCALATED'
));

CREATE UNIQUE INDEX case_actions_idempotency_unique
  ON case_actions (case_id, (metadata->>'idempotencyKey'))
  WHERE metadata ? 'idempotencyKey';
