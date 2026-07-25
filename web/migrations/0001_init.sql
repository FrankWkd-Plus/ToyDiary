-- Toy Dairy D1 schema (plan.md / docs/api.md contract)
-- Demo runtime does NOT execute this — browser localStorage is the store.
-- Apply later when wiring real backend:
--   wrangler d1 execute toydairy-db --remote --file=./migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS toys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  birth_place TEXT NOT NULL,
  role TEXT NOT NULL,
  traits TEXT NOT NULL, -- JSON array of strings
  zodiac TEXT,
  bio TEXT,
  monologue TEXT,
  avatar_url TEXT, -- future: R2 URL; demo: data URL in localStorage only
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  toy_id TEXT NOT NULL REFERENCES toys(id),
  type TEXT NOT NULL, -- travel | daily | memorial | text | heart
  date TEXT NOT NULL,
  location TEXT, -- free-text display fallback
  place TEXT, -- JSON Place { displayName, lat, lng, city, ... }
  title TEXT,
  user_note TEXT, -- 我的视角
  mood TEXT,
  image_url TEXT, -- future: R2 URL
  ai_diary TEXT, -- 玩偶视角
  tags TEXT, -- JSON string[]
  image_analysis TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_toy_date ON entries(toy_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_toys_created ON toys(created_at DESC);
