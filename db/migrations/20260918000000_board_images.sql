-- Image bytes move OUT of the board JSON and into their own rows.
--
-- Every photo used to ride inside boards.nodes as a base64 data URL, so one board
-- could hold about 4 MB of images TOTAL - Vercel rejects a request body over
-- 4.5 MB at the edge, before any handler runs. That cap was reached with 2 GIFs.
-- It also meant every autosave re-sent every image on the board.
--
-- A row per image lifts both limits: each upload is its own request (so nothing
-- approaches the body cap), a board is unlimited in image count, and the board
-- JSON goes back to being text. Nodes reference /api/images/<id> instead.
--
-- Nothing here breaks an existing board: a node's `src` is just a string, so the
-- data URLs already saved keep rendering exactly as they do today. Lifting them
-- into rows is a separate, reversible migration script.
CREATE TABLE IF NOT EXISTS board_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  mime        TEXT NOT NULL,
  bytes       BYTEA NOT NULL,
  byte_size   INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The only query that is not by primary key: "what does this owner have", used by
-- the migration script and any future cleanup of images no board references.
CREATE INDEX IF NOT EXISTS idx_board_images_user ON board_images (user_id, created_at DESC);
