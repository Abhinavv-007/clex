-- Vault account sync (src/accountSync.ts).

-- One Vault key per signed-in account, handed only to that account's
-- verified Firebase sign-in. Every device on the account shares it.
CREATE TABLE IF NOT EXISTS vault_accounts (
  uid        TEXT PRIMARY KEY,
  key_b64    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Notes and folders, each encrypted in the browser before it is sent.
-- seq is the account's change order, the cursor devices pull from.
CREATE TABLE IF NOT EXISTS vault_items (
  uid        TEXT NOT NULL,
  kind       TEXT NOT NULL,
  id         TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  payload    TEXT,
  seq        INTEGER NOT NULL,
  PRIMARY KEY (uid, kind, id)
);

CREATE INDEX IF NOT EXISTS idx_vault_items_seq ON vault_items(uid, seq);
