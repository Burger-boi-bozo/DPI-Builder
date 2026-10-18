#!/usr/bin/env python3
"""Install the V1 branch at /v1/ beside the existing Dynamics Lab on this host."""
import datetime
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request
import json

ROOT = Path('/opt/roadster-flight-v1')
CONFIG = Path('/etc/cloudflared/public-routes.yml')
UNIT = Path('/etc/systemd/system/roadster-flight-v1.service')
ROUTE = '- hostname: fly.dpifiles.org\n  path: ^/v1(/.*)?$\n  service: http://127.0.0.1:18768\n'
MAIN_ROUTE = '- hostname: fly.dpifiles.org\n  service: http://127.0.0.1:18767\n'

def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True)

def release(url):
    with urllib.request.urlopen(url, timeout=12) as response:
        assert response.status == 200
        data = json.load(response)
        assert data['version'] == '1.1.0', data
        return data

if os.geteuid() != 0:
    raise SystemExit('Run as root on the Proxmox host with the existing public-routes tunnel.')
assert (ROOT / 'dist/release.json').is_file(), 'Clone the roadster-flight-v1 branch first.'
run('node', '--test', str(ROOT / 'tests/physics.test.mjs'))
old_config = CONFIG.read_bytes()
text = old_config.decode()
assert MAIN_ROUTE in text, 'The existing main game route has changed; review before installing.'
assert '127.0.0.1:18768' not in text or ROUTE in text, 'Port 18768 already has a different route.'
if UNIT.exists():
    assert 'Roadster Flight Lab V1' in UNIT.read_text(), 'Existing service belongs to another app.'
else:
    import socket
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 18768))
public = ROOT / 'public'
public.mkdir(exist_ok=True)
link = public / 'v1'
if not link.exists():
    link.symlink_to(ROOT / 'dist', target_is_directory=True)
assert link.resolve() == (ROOT / 'dist').resolve()
UNIT.write_text('''[Unit]
Description=Roadster Flight Lab V1
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/roadster-flight-v1
ExecStart=/usr/bin/python3 -m http.server 18768 --bind 127.0.0.1 --directory /opt/roadster-flight-v1/public
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
MemoryMax=128M
CPUQuota=50%
[Install]
WantedBy=multi-user.target
''')
run('systemctl', 'daemon-reload')
run('systemctl', 'enable', '--now', 'roadster-flight-v1.service')
for attempt in range(10):
    try:
        release('http://127.0.0.1:18768/v1/release.json')
        break
    except Exception:
        if attempt == 9:
            raise
        time.sleep(.3)

if ROUTE not in text:
    candidate = CONFIG.with_name('public-routes.v1-candidate.yml')
    shutil.copy2(CONFIG, candidate)
    candidate.write_text(text.replace(MAIN_ROUTE, ROUTE + MAIN_ROUTE, 1))
    candidate.chmod(0o600)
    run('cloudflared', 'tunnel', '--config', str(candidate), 'ingress', 'validate')
    assert CONFIG.read_bytes() == old_config, 'Tunnel changed during install; stopped before replacing it.'
    backup = CONFIG.with_name('public-routes.before-v1-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '.yml')
    shutil.copy2(CONFIG, backup)
    os.replace(candidate, CONFIG)
    try:
        run('systemctl', 'restart', 'cloudflared-public-routes.service')
        run('systemctl', 'is-active', 'cloudflared-public-routes.service')
        for attempt in range(5):
            try:
                release('https://fly.dpifiles.org/v1/release.json')
                break
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(1)
    except Exception:
        shutil.copy2(backup, CONFIG)
        run('systemctl', 'restart', 'cloudflared-public-routes.service')
        raise
else:
    release('https://fly.dpifiles.org/v1/release.json')
print('Published Roadster Flight Lab V1.1 at https://fly.dpifiles.org/v1/')
