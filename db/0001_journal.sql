CREATE TABLE IF NOT EXISTS workout_journals (
  user_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL CHECK (revision > 0),
  journal JSONB NOT NULL DEFAULT '{}'::jsonb
);
