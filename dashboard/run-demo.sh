#!/usr/bin/env bash
# SENTINEL dashboard — one-command local launcher.
# Ensures a Node runtime that satisfies Next.js 16 (>= 20.19 / 22.x),
# then starts the dev server. Runs fully offline: no DB, no cloud.
set -e
cd "$(dirname "$0")"

# Prefer Homebrew node@22 if the default node is too old for Next 16.
NODE_MAJOR=$(node -p "process.versions.node.split('.').map(Number)[0]" 2>/dev/null || echo 0)
NODE_MINOR=$(node -p "process.versions.node.split('.').map(Number)[1]" 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 22 ] && [ ! \( "$NODE_MAJOR" -eq 20 -a "$NODE_MINOR" -ge 19 \) ]; then
  for CAND in /opt/homebrew/opt/node@22/bin /usr/local/opt/node@22/bin; do
    if [ -x "$CAND/node" ]; then
      export PATH="$CAND:$PATH"
      echo "→ Using Node $("$CAND/node" -v) from $CAND"
      break
    fi
  done
fi

echo "→ Node: $(node -v)"
if [ ! -d node_modules ]; then
  echo "→ Installing dependencies…"
  npm install --no-audit --no-fund
fi

PORT="${PORT:-4123}"
echo "→ Starting SENTINEL at http://localhost:$PORT"
PORT="$PORT" npm run dev
