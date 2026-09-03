-- idx_boards_user_id (user_id) is redundant: idx_boards_slug (user_id, slug)
-- and idx_boards_trashed (user_id, trashed_at) both lead with user_id, so
-- Postgres can already use either for a plain user_id lookup.
DROP INDEX IF EXISTS idx_boards_user_id;
