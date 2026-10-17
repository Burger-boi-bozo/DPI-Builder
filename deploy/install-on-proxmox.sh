#!/usr/bin/env bash
set -euo pipefail
# Run on pve from an up-to-date roadster-flight-v2 checkout. No DNS edits.
ROOT=/opt/roadster-flight
ARCHIVE="$ROOT/artifacts/roadster-v2-deploy.zip"
[ "$(id -u)" -eq 0 ] || { echo 'Requires root'; exit 1; }
[ -f "$ARCHIVE" ] || { echo "Missing $ARCHIVE"; exit 1; }
command -v unzip >/dev/null
command -v node >/dev/null
cd "$ROOT"
node --test tests/*.test.mjs
node --check game/game.mjs
node --check game/scene.mjs
node --check game/physics.mjs
STAGE=$(mktemp -d "$ROOT/.v2-release-XXXXXXXX")
trap 'rm -rf "$STAGE"' EXIT
unzip -q "$ARCHIVE" -d "$STAGE"
[ -s "$STAGE/game/index.html" ] && [ -s "$STAGE/game/three.module.min.js" ]
mkdir -p "$ROOT/releases"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
if [ -e "$ROOT/dist" ]; then mv "$ROOT/dist" "$ROOT/releases/previous-$STAMP"; fi
mv "$STAGE/game" "$ROOT/dist"
chmod -R a+rX "$ROOT/dist"
chown -R root:root "$ROOT/dist"
# The existing systemd server serves the dist path and keeps the Cloudflare ingress untouched.
systemctl is-active --quiet roadster-flight.service || systemctl restart roadster-flight.service
sleep 1
curl -fsSI http://127.0.0.1:18767/ >/dev/null
curl -fsS http://127.0.0.1:18767/ | grep -q 'Roadster Flight Lab V2'
echo 'V2 deployed to /opt/roadster-flight/dist and verified on 127.0.0.1:18767'