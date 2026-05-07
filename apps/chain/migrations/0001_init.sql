-- Clex Chain Ledger — D1 Schema
-- Tracks transfer sessions and chain IDs publicly.
-- Filenames and file contents are NEVER stored here.

CREATE TABLE IF NOT EXISTS chain_ids (
  id         TEXT    PRIMARY KEY,  -- 32 hex chars, client-generated, no PII
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transfer_sessions (
  id                 TEXT    PRIMARY KEY,  -- UUID
  sender_chain_id    TEXT    NOT NULL REFERENCES chain_ids(id),
  receiver_chain_id  TEXT    REFERENCES chain_ids(id),
  route              TEXT    NOT NULL,     -- 'webrtc' | 'local' | 'drive'
  files_json         TEXT    NOT NULL DEFAULT '[]',  -- JSON array, no filenames
  status             TEXT    NOT NULL DEFAULT 'registered',
  started_at         INTEGER NOT NULL,
  completed_at       INTEGER,
  duration_ms        INTEGER,
  ledger_index       INTEGER NOT NULL,
  previous_hash      TEXT    NOT NULL,
  record_hash        TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS transfer_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT    NOT NULL REFERENCES transfer_sessions(id),
  status     TEXT    NOT NULL,
  ts         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_sender   ON transfer_sessions(sender_chain_id);
CREATE INDEX IF NOT EXISTS idx_sessions_receiver ON transfer_sessions(receiver_chain_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started  ON transfer_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_ledger   ON transfer_sessions(ledger_index);
CREATE INDEX IF NOT EXISTS idx_events_session    ON transfer_events(session_id);
