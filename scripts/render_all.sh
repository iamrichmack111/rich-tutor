#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source .venv/bin/activate
QUALITY="${QUALITY:-l}"

python - <<'PY' > /tmp/math_tutor_ids.txt
import json
for x in json.load(open("lessons/lessons.json")):
    print(x["id"])
PY

mkdir -p static/videos
while read -r I; do
  N=$(printf "%02d" "$I")
  SCENE="Lesson${N}"
  echo "===== Rendering ${SCENE} ====="
  manim "-q${QUALITY}" manim/detailed_lessons.py "$SCENE"
  FILE="$(find media/videos/detailed_lessons -type f -name "${SCENE}.mp4" | sort | tail -1)"
  [ -n "$FILE" ] || { echo "Missing render: $SCENE"; exit 1; }
  DEST="$(python - "$I" <<'PY'
import json,sys
n=int(sys.argv[1]); d=json.load(open("lessons/lessons.json"))
print(next(x["video"] for x in d if x["id"]==n))
PY
)"
  mkdir -p "$(dirname "static/$DEST")"
  cp "$FILE" "static/$DEST"
done < /tmp/math_tutor_ids.txt
