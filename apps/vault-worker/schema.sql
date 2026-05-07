-- Vault users table (account metadata only, never note content)
CREATE TABLE IF NOT EXISTS vault_users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  device_count INTEGER NOT NULL DEFAULT 0,
  secret_shares_today INTEGER NOT NULL DEFAULT 0,
  secret_shares_reset_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- File attachments metadata (Supabase Storage paths, not content)
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  upload_at INTEGER NOT NULL DEFAULT (unixepoch()),
  delete_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_user ON attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_sub ON attachments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_attachments_delete ON attachments(delete_at);

-- Scheduled auto-deletion queue
CREATE TABLE IF NOT EXISTS pending_deletions (
  id TEXT PRIMARY KEY,
  storage_path TEXT NOT NULL,
  delete_at INTEGER NOT NULL  -- unix seconds
);

CREATE INDEX IF NOT EXISTS idx_pending_deletions_time ON pending_deletions(delete_at);
