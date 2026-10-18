#!/usr/bin/env bash
set -euo pipefail
# Install from a reviewed, versioned GitHub commit. Never modify Cloudflare routes.
ROOT=/opt/roadster-flight
ARCHIVE="$ROOT/artifacts/roadster-v2-deploy.zip"
[ "$(id -u)" -eq 0 ] || { echo 'Requires root' >&2; exit 1; }
[ -s "$ARCHIVE" ] || { echo "Missing archive: $ARCHIVE" >&2; exit 1; }
for cmd in node python3 sha256sum curl;do command -v "$cmd" >/dev/null;done
cd "$ROOT"
# Bring pre-bundled Three.js and fonts into the source checkout for offline tests.
python3 - "$ARCHIVE" <<'PYZIP'
from zipfile import ZipFile
import sys
with ZipFile(sys.argv[1]) as z:
  assert z.testzip() is None
  for member in z.namelist():
    if member == 'game/three.module.min.js' or (member.startswith('game/font-') and member.endswith('.ttf')): z.extract(member,'.')
PYZIP
node --test tests/*.test.mjs
for f in game/*.mjs;do node --check "$f";done
STAGE=$(mktemp -d "$ROOT/.v34-release-XXXXXXXX")
BACKUP=''
SWAPPED=0
cleanup(){
  rc=$?
  if [ "$rc" -ne 0 ] && [ "$SWAPPED" -eq 1 ] && [ -n "$BACKUP" ] && [ -d "$BACKUP" ];then
    echo 'Verification failed; restoring previous release' >&2
    [ ! -e "$ROOT/dist" ] || mv "$ROOT/dist" "$STAGE/failed-release"
    mv "$BACKUP" "$ROOT/dist"
  fi
  rm -rf "$STAGE"
  exit "$rc"
}
trap cleanup EXIT
python3 -m zipfile -e "$ARCHIVE" "$STAGE"
GAME="$STAGE/game"
# Download a verified Creative Commons Attribution Tesla Roadster asset. Avoid
# silently deploying a low-detail substitute when a pinned file changes.
CACHE="$ROOT/.asset-cache-v34"
mkdir -p "$GAME/draco" "$CACHE/draco"
fetch_asset(){
  local name="$1" url="$2" digest="$3" target="$GAME/$1" stored="$CACHE/$1"
  mkdir -p "$(dirname "$stored")"
  if [ -f "$stored" ] && echo "$digest  $stored" | sha256sum -c - >/dev/null 2>&1;then
    cp "$stored" "$target"
  else
    curl --fail --location --silent --show-error --retry 3 --max-time 80 "$url" -o "$target"
    echo "$digest  $target" | sha256sum -c -
    cp "$target" "$stored"
  fi
}
fetch_asset 'roadster-2020.glb' 'https://raw.githubusercontent.com/stevenzhang070302/tesla-roadster-webgi/main/assets/tesla.glb' '9ca3f8be562d47e08c80770f094a5dcf30b65c697951ddd60476dfb25588acc3'
URL='https://unpkg.com/three@0.180.0/examples/jsm'
fetch_asset 'GLTFLoader.js' "$URL/loaders/GLTFLoader.js" '67ac5551fdafa6e349bd80c8f8e5e39c136d6b2fb1ad647db9abb21dc86f9e4a'
fetch_asset 'DRACOLoader.js' "$URL/loaders/DRACOLoader.js" '7a4a51c694a6c9f983be452cc82b365e69ce08424654e3f245b4115e6efef258'
fetch_asset 'draco/draco_wasm_wrapper.js' "$URL/libs/draco/draco_wasm_wrapper.js" 'e8049906ef3f8f75d3456c22a3f31bfdfe5b5b5bd09ccdec613b9e9a49d554d8'
fetch_asset 'draco/draco_decoder.wasm' "$URL/libs/draco/draco_decoder.wasm" 'c55a594e8ffd18426d36b27fea9618af3df5e173640a3e56d46f09d76f0574f2'
# The standalone loader is placed alongside BufferGeometryUtils in /game.
sed -i "s@'../utils/BufferGeometryUtils.js'@'./BufferGeometryUtils.js'@g" "$GAME/GLTFLoader.js"
fetch_asset 'BufferGeometryUtils.js' "$URL/utils/BufferGeometryUtils.js" 'fda7e946b8e0b5ab39b779206589e7a1079a22eb24efb89d7223e03fdfb1f751'
node --check "$GAME/GLTFLoader.js"
node --check "$GAME/DRACOLoader.js"
# Inspect the actual GLB manifest, not just file size, before exposing it.
python3 - "$GAME/roadster-2020.glb" <<'PYGLB'
from pathlib import Path
import json,struct,sys
p=Path(sys.argv[1]);data=p.read_bytes();magic,version,size=struct.unpack_from('<III',data)
assert magic==0x46546c67 and version==2 and size==len(data)
json_length,json_type=struct.unpack_from('<II',data,12)
assert json_type==0x4e4f534a
manifest=json.loads(data[20:20+json_length]);names={n.get('name') for n in manifest['nodes']}
for wheel in ('TRDEF-WheelFtL','TRDEF-WheelFtR','TRDEF-WheelBkL','TRDEF-WheelBkR'):
    assert wheel in names, f'missing licensed wheel pivot {wheel}'
assert len(manifest['meshes'])>95, 'expected detailed multi-part body geometry'
assert 'KHR_draco_mesh_compression' in manifest['extensionsUsed']
print('Roadster GLB verified:',len(manifest['meshes']),'meshes and four independent wheel assemblies')
PYGLB
for f in index.html vehicle.mjs scene.mjs world-v34.mjs roadster-model.mjs ASSET_CREDITS.md roadster-2020.glb GLTFLoader.js DRACOLoader.js BufferGeometryUtils.js;do test -s "$GAME/$f";done
grep -q 'Roadster / Dynamics Lab V3.4.1' "$GAME/index.html"
mkdir -p "$ROOT/releases"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
if [ -d "$ROOT/dist" ];then BACKUP="$ROOT/releases/previous-$STAMP";mv "$ROOT/dist" "$BACKUP";fi
mv "$GAME" "$ROOT/dist"
SWAPPED=1
chmod -R a+rX "$ROOT/dist"
chown -R root:root "$ROOT/dist"
if ! systemctl is-active --quiet roadster-flight.service;then systemctl restart roadster-flight.service;fi
sleep 1
curl -fsSI --max-time 8 http://127.0.0.1:18767/ >/dev/null
curl -fsS --max-time 8 http://127.0.0.1:18767/ | grep -q 'Roadster / Dynamics Lab V3.4.1'
for f in roadster-2020.glb GLTFLoader.js DRACOLoader.js BufferGeometryUtils.js world-v34.mjs roadster-model.mjs;do curl -fsSI --max-time 8 "http://127.0.0.1:18767/$f" >/dev/null;done
SWAPPED=0
printf 'V3.4.1 (freeze + boundary + mismatched model fix) deployed; previous release %s\n' "$BACKUP"