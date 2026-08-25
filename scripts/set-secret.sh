#!/usr/bin/env bash
# Safely set a secret into this repo's .env. No secret ever appears in argv
# (it is read from stdin), the file stays gitignored + 0600, and any existing
# line for the same key is replaced (no duplicates).
#
# Usage:
#   scripts/set-secret.sh FORENSIC_API_SECRET        # then paste value + Enter
#   echo "$KEY" | scripts/set-secret.sh FORENSIC_API_SECRET
set -euo pipefail

NAME="${1:?usage: set-secret.sh KEY_NAME  (value read from stdin)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV="$ROOT/.env"

# Value from stdin only - keeps it out of shell history and process args.
if [ -t 0 ]; then printf 'Paste value for %s (hidden): ' "$NAME" >&2; read -rs VALUE; echo >&2
else read -r VALUE; fi
[ -n "${VALUE:-}" ] || { echo "error: empty value" >&2; exit 1; }

# Guarantee .env is gitignored before writing a secret into it.
if ! git -C "$ROOT" check-ignore -q .env 2>/dev/null; then
  echo "refusing: .env is NOT gitignored in this repo" >&2; exit 1
fi

touch "$ENV"; chmod 600 "$ENV"
grep -v "^${NAME}=" "$ENV" > "$ENV.tmp" 2>/dev/null || true
printf '%s=%s\n' "$NAME" "$VALUE" >> "$ENV.tmp"
mv "$ENV.tmp" "$ENV"; chmod 600 "$ENV"

echo "ok: ${NAME} set in .env (0600, gitignored, no duplicates)" >&2
