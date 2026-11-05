CREATE TABLE scholarship_catalog (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  generation TEXT,
  source_path TEXT,
  source_date TEXT,
  synced_at INTEGER,
  source_count INTEGER,
  scholarship_count INTEGER,
  lease TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  retry_after INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
--> statement-breakpoint
CREATE TABLE scholarship_chunks (
  generation TEXT NOT NULL,
  kind TEXT NOT NULL,
  part INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (generation, kind, part)
);
