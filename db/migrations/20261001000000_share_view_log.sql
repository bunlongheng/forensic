-- Who opened a shared board. One row per real view of GET /api/boards/:id by
-- someone who is not the owner (link-preview crawlers skipped), written by
-- lib/share-alert.js BEFORE the alert goes out, so a visit is never lost to a
-- failed email. kind is 'view' (open link) or 'unlock' (passcode entered);
-- boards have no passcode today, so every row is 'view'.
CREATE TABLE IF NOT EXISTS share_view_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL,
  title       TEXT,
  kind        TEXT NOT NULL DEFAULT 'view',
  ip          TEXT,
  city        TEXT,
  country     TEXT,
  user_agent  TEXT,
  referer     TEXT,
  emailed     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "view n of this board" is a count per board on every alert.
CREATE INDEX IF NOT EXISTS idx_share_view_log_board ON share_view_log (board_id, created_at DESC);
