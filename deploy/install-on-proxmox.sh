#!/usr/bin/env bash
set -euo pipefail
# No DNS edits. Fetch the approved branch before running this script on pve.
ROOT=/opt/roadster-flight
ARCHIVE="$ROOT/artifacts/roadster-v2-deploy.zip"
[ "$(id -u)" -eq 0 ] || { echo 'Requires root'; exit 1; }
[ -s "$ARCHIVE" ] || { echo "Missing archive: $ARCHIVE"; exit 1; }
command -v python3 >/dev/null
command -v node >/dev/null
cd "$ROOT"
# Binary Three.js and fonts are deliberately packaged offline rather than
# tracked in the Git tree. Restore them BEFORE the geometry test imports scene.mjs.
python3 - "$ARCHIVE" <<'PYZIP'
from pathlib import Path
from zipfile import ZipFile
import sys
with ZipFile(sys.argv[1]) as archive:
    for item in archive.namelist():
        if item == 'game/three.module.min.js' or (item.startswith('game/font-') and item.endswith('.ttf')):
            archive.extract(item, '.')
PYZIP
node --test tests/*.test.mjs
for f in game/game.mjs game/scene.mjs game/physics.mjs game/research.mjs game/suspension.mjs game/vehicle.mjs; do node --check "$f"; done
STAGE=$(mktemp -d "$ROOT/.v2-release-XXXXXXXX")
BACKUP=""
SWAPPED=0
cleanup() {
  rc=$?
  if [ "$rc" -ne 0 ] && [ "$SWAPPED" -eq 1 ] && [ -n "$BACKUP" ] && [ -d "$BACKUP" ]; then
    echo 'Verification failed, restoring previous production files' >&2
    [ ! -e "$ROOT/dist" ] || mv "$ROOT/dist" "$STAGE/failed-dist"
    mv "$BACKUP" "$ROOT/dist"
  fi
  rm -rf "$STAGE"
  exit "$rc"
}
trap cleanup EXIT
python3 -m zipfile -e "$ARCHIVE" "$STAGE"
[ -s "$STAGE/game/index.html" ] && [ -s "$STAGE/game/research.mjs" ] && [ -s "$STAGE/game/suspension.mjs" ] && [ -s "$STAGE/game/vehicle.mjs" ] && [ -s "$STAGE/game/three.module.min.js" ]
grep -q 'Roadster / Experimental Flight V2.8' "$STAGE/game/index.html"
mkdir -p "$ROOT/releases"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
if [ -d "$ROOT/dist" ]; then BACKUP="$ROOT/releases/previous-$STAMP";mv "$ROOT/dist" "$BACKUP";fi
mv "$STAGE/game" "$ROOT/dist"
SWAPPED=1
chmod -R a+rX "$ROOT/dist"
chown -R root:root "$ROOT/dist"
if ! systemctl is-active --quiet roadster-flight.service; then systemctl restart roadster-flight.service;fi
sleep 1
curl -fsSI --max-time 8 http://127.0.0.1:18767/ >/dev/null
curl -fsS --max-time 8 http://127.0.0.1:18767/ | grep -q 'Roadster / Experimental Flight V2.8'
curl -fsSI --max-time 8 http://127.0.0.1:18767/research.mjs >/dev/null
curl -fsSI --max-time 8 http://127.0.0.1:18767/suspension.mjs >/dev/null
curl -fsSI --max-time 8 http://127.0.0.1:18767/vehicle.mjs >/dev/null
SWAPPED=0
printf 'V2.8 deployed to %s/dist; previous release %s\n' "$ROOT" "$BACKUP"