-- 002_frontier_history.sql
CREATE TABLE IF NOT EXISTS frontier_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  day TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  next_retry_at TEXT,
  error TEXT,
  UNIQUE (source, day)
);

CREATE TABLE IF NOT EXISTS frontier_day_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  url TEXT NOT NULL,
  heat_kind TEXT NOT NULL,
  heat_value INTEGER NOT NULL DEFAULT 0,
  source_time TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE (day_id, external_id),
  FOREIGN KEY (day_id) REFERENCES frontier_days(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_frontier_days_source_status_day
  ON frontier_days (source, status, day DESC);

CREATE INDEX IF NOT EXISTS idx_frontier_day_items_day_rank
  ON frontier_day_items (day_id, rank ASC);
