#!/usr/bin/env bash
# Carbon Trackers local dev server.
# Frees the port if a previous server is still running, then serves the site.
set -e

PORT="${1:-8080}"

# Kill any process already listening on the port (prevents "Address already in use")
if lsof -ti ":${PORT}" >/dev/null 2>&1; then
  echo "Port ${PORT} in use — stopping the old server..."
  lsof -ti ":${PORT}" | xargs kill 2>/dev/null || true
  sleep 1
fi

cd "$(dirname "$0")"
echo "Carbon Trackers running at http://localhost:${PORT}"
echo "Press Ctrl+C to stop."
exec python3 -m http.server "${PORT}"
