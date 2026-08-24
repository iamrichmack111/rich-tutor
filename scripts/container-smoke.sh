#!/usr/bin/env bash
set -euo pipefail
docker compose build
docker compose up -d
trap 'docker compose down' EXIT

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:5085/health; then
    echo
    echo "Container smoke test passed."
    exit 0
  fi
  sleep 2
done

docker compose ps
docker compose logs --tail=120
exit 1
