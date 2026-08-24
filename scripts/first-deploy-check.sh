#!/usr/bin/env bash
set -euo pipefail
PORT="${1:-5085}"

echo "Checking whether port ${PORT} is free..."
if sudo ss -ltnp | grep -q ":${PORT} "; then
  echo "ERROR: port ${PORT} is already in use."
  sudo ss -ltnp | grep ":${PORT} " || true
  exit 1
fi

echo "Port ${PORT} is free."
echo "Create /home/ubuntu/rich-tutor/.env before deployment."
