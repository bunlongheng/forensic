-- A passcode on a shared board, like a Flows private share. NULL = no passcode.
-- passcode_hash is the scrypt hash the lock screen verifies against;
-- passcode_enc is the same passcode AES-256-GCM sealed under AUTH_SECRET so the
-- owner can read it back in the app (lib/passcode.js). Visitors only ever hit the hash.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS passcode_hash text;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS passcode_enc text;
