-- Vault users table (account metadata only, never note content)
CREATE TABLE IF NOT EXISTS vault_users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  device_count INTEGER NOT NULL DEFAULT 0,
  storage_used_bytes INTEGER NOT NULL DEFAULT 0,
  secret_shares_today INTEGER NOT NULL DEFAULT 0,
  secret_shares_reset_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Vault files metadata (R2 keys, not content)
CREATE TABLE IF NOT EXISTS vault_files (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (uid) REFERENCES vault_users(uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vault_files_uid ON vault_files(uid);
CREATE INDEX IF NOT EXISTS idx_vault_files_expires ON vault_files(expires_at);
