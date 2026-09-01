CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action varchar(80) NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id varchar(160),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_idx ON admin_audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_resource_idx ON admin_audit_logs(resource_type, resource_id, created_at DESC);
