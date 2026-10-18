#!/usr/bin/env python3
"""Publish this checked-out V1 commit using an atomic, reversible symlink switch."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import urllib.request

ROOT = Path('/opt/roadster-flight-v1')

def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout.strip()

def read_release(url):
    with urllib.request.urlopen(url, timeout=15) as response:
        assert response.status == 200
        return json.load(response)

assert Path(__file__).resolve().parent.parent == ROOT, 'Run from the V1 clone on the DPI host.'
assert run('git', '-C', str(ROOT), 'branch', '--show-current') == 'roadster-flight-v1'
assert not run('git', '-C', str(ROOT), 'status', '--porcelain'), 'Commit or review local changes before deploying.'
release = json.loads((ROOT / 'dist/release.json').read_text())
commit = run('git', '-C', str(ROOT), 'rev-parse', 'HEAD')
run('node', '--test', str(ROOT / 'tests/physics.test.mjs'))
for module in ['game', 'physics', 'scene', 'vehicle', 'audio']:
    run('node', '--check', str(ROOT / f'dist/{module}.mjs'))
link = ROOT / 'public/v1'
assert link.is_symlink(), 'Use install-v1.py for the initial installation.'
previous = link.resolve()
assert previous == ROOT / 'dist' or (ROOT / 'releases') in previous.parents
release_root = ROOT / 'releases'
release_root.mkdir(exist_ok=True)
target = release_root / (release['version'] + '-' + commit[:12])
if not target.exists():
    pending = release_root / ('.pending-' + commit[:12])
    assert not pending.exists(), 'An unfinished staging directory needs review.'
    shutil.copytree(ROOT / 'dist', pending)
    os.replace(pending, target)
else:
    # Existing immutable release must be byte-identical to the checked-out dist.
    source_files = {p.relative_to(ROOT / 'dist') for p in (ROOT / 'dist').rglob('*') if p.is_file()}
    target_files = {p.relative_to(target) for p in target.rglob('*') if p.is_file()}
    assert source_files == target_files
    assert all((ROOT / 'dist' / p).read_bytes() == (target / p).read_bytes() for p in source_files)
next_link = ROOT / 'public/v1.next'
assert not next_link.exists() and not next_link.is_symlink()
next_link.symlink_to(target, target_is_directory=True)
os.replace(next_link, link)
try:
    assert read_release('http://127.0.0.1:18768/v1/release.json') == release
    assert read_release('https://fly.dpifiles.org/v1/release.json?commit=' + commit) == release
    assert run('systemctl', 'is-active', 'roadster-flight-v1.service') == 'active'
except Exception:
    next_link.symlink_to(previous, target_is_directory=True)
    os.replace(next_link, link)
    raise
print(json.dumps({'version': release['version'], 'commit': commit, 'published': str(target), 'rollback_target': str(previous)}))
