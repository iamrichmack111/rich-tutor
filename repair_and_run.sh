#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
python -m pip install -q flask manim

echo "Math Tutor repaired."
echo "Starting at http://127.0.0.1:5055"
python app.py
