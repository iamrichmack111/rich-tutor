#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ubuntu/rich-tutor"
PORT="5085"
SERVICE="rich-tutor"
DB_FILE="data/rich_tutor.db"

cd "$APP_DIR"

test -f .env || { echo "ERROR: $APP_DIR/.env is missing"; exit 1; }

mkdir -p data backups

if [ -f "$DB_FILE" ]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  cp "$DB_FILE" "backups/rich-tutor-$TS.db"
  echo "Database backup: backups/rich-tutor-$TS.db"
fi

python3 -m py_compile app.py

docker compose build
docker compose up -d --remove-orphans

READY=0
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null; then
    READY=1
    break
  fi
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  docker compose ps
  docker compose logs --tail=120 "$SERVICE"
  exit 1
fi

curl -fsS "http://127.0.0.1:${PORT}/health"
echo
echo "Rich Tutor healthy on 127.0.0.1:${PORT}"
