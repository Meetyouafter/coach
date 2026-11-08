CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  password_lookup TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
