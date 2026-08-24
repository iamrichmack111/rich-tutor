#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
source .venv/bin/activate 2>/dev/null || true
node --check static/js/app.js
python -m py_compile app.py
touch static/js/app.js static/css/style.css
echo "Expansion lessons repaired."
echo "Restarting Math Tutor on http://127.0.0.1:5055"
python app.py
