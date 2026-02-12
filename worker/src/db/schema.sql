CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  r2_key TEXT NOT NULL,
  allow_download INTEGER DEFAULT 0,
  allow_print INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS views (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  viewed_at TEXT DEFAULT (datetime('now')),
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);
