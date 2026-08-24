#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
python3 -m pip install -q flask manim

python3 -m py_compile app.py
node --check static/js/app.js

echo "Math Tutor V5 ready."
echo "Open http://127.0.0.1:5055"
python3 app.py
