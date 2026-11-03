CREATE TABLE IF NOT EXISTS shiprank_entries (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS shiprank_entries_expiry
  ON shiprank_entries (expires_at) WHERE expires_at IS NOT NULL;
