# Start nomaebot NEW
# Usage: ./scripts/start.sh

export NODE_ENV=development
export OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"
export ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
export ADMIN_PASSWORD_HASH="${ADMIN_PASSWORD_HASH:-}"
export SESSION_SECRET="${SESSION_SECRET:-}"

if [ -z "$OPENROUTER_API_KEY" ] && [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

node node_modules/next/dist/bin/next start
