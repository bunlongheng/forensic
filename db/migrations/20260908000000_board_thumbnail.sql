-- A small rendered snapshot of the whole board, painted by the client on save and
-- shown in the gallery. The gallery list strips inline image bytes from every node
-- (payload size), so the old per-node vector projection had no photo to draw and
-- fell back to a camera placeholder on every image - a wall of "broken" tiles.
-- One flat picture per board replaces the whole projection.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS thumbnail TEXT;
