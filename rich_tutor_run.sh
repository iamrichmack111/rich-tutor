#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ ! -d .venv ]; then python3 -m venv .venv; fi
source .venv/bin/activate
python3 -m pip install -q flask manim werkzeug gunicorn
python3 -m py_compile app.py
node --check static/js/app.js
echo "Rich Tutor V9 ready."
echo "Local: http://127.0.0.1:5055"
echo "Public homepage: /"
echo "Login: /login"
echo "Admin: /admin"
echo "Invites: /admin/invites"
echo "Default admin: admin / admin"
python3 app.py
