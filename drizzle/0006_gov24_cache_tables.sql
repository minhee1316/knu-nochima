CREATE TABLE IF NOT EXISTS gov24_parts (generation TEXT NOT NULL, part INTEGER NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(generation,part));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS gov24_detail (id TEXT PRIMARY KEY, stamp INTEGER NOT NULL, payload TEXT NOT NULL);
