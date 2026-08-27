-- Soft-delete ("Trash") for boards. A board with real work (3+ nodes) goes here
-- on delete instead of being destroyed, so an accidental delete is recoverable.
-- Small/scratch boards are hard-deleted and never populate this. NULL = active.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS trashed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_boards_trashed ON boards (user_id, trashed_at);
