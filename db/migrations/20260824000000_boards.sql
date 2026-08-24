CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS boards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  title      text NOT NULL DEFAULT 'Untitled Board',
  slug       text,
  nodes      jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges      jsonb NOT NULL DEFAULT '[]'::jsonb,
  type       text NOT NULL DEFAULT 'board',
  tags       text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards (user_id);
CREATE INDEX IF NOT EXISTS idx_boards_slug ON boards (user_id, slug);
