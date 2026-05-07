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

-- ─── Public API keys (programmatic Clex Direct API) ───────────────────────────
-- Each row represents one API key minted by a Firebase-authenticated user.
-- We never persist plaintext keys; only the SHA-256 hash + a short prefix that
-- the UI shows so the owner can identify the key without exposing the secret.
CREATE TABLE IF NOT EXISTS api_keys (
  id              TEXT PRIMARY KEY,        -- ck_id_<32 hex>
  user_id         TEXT NOT NULL,           -- Firebase uid
  user_email      TEXT,                    -- snapshot of email at create time (for ops)
  name            TEXT NOT NULL,           -- human label, e.g. "ci-uploader"
  prefix          TEXT NOT NULL,           -- first 12 chars of plaintext (visible to owner)
  hash            TEXT NOT NULL UNIQUE,    -- SHA-256 hex of full plaintext key
  max_file_bytes  INTEGER NOT NULL,        -- per-call file size cap
  rate_per_minute INTEGER NOT NULL,        -- requests / uploads allowed per minute
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at    INTEGER,
  total_uploads   INTEGER NOT NULL DEFAULT 0,
  total_bytes     INTEGER NOT NULL DEFAULT 0,
  revoked_at      INTEGER                  -- nullable; non-null means soft-deleted
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(hash);

-- ─── API uploads (programmatic share links) ───────────────────────────────────
-- Files uploaded via POST /vault/api/uploads end up here. They are first-class
-- Supabase Storage objects (server-known) and are surfaced to the recipient via
-- a shareable token. They auto-expire and are picked up by the cleanup cron.
CREATE TABLE IF NOT EXISTS api_uploads (
  id            TEXT PRIMARY KEY,         -- internal id (32 hex)
  user_id       TEXT NOT NULL,            -- Firebase uid that minted the upload
  api_key_id    TEXT,                     -- nullable for UI-mode uploads
  storage_path  TEXT NOT NULL UNIQUE,
  share_token   TEXT NOT NULL UNIQUE,     -- public 12-char id used in the URL
  filename      TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  mime_type     TEXT NOT NULL,
  upload_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at    INTEGER NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  revoked_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_api_uploads_user ON api_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_api_uploads_share ON api_uploads(share_token);
CREATE INDEX IF NOT EXISTS idx_api_uploads_expires ON api_uploads(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_uploads_key ON api_uploads(api_key_id);
