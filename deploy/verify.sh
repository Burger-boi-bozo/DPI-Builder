#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run check
printf '\n[local server]\n'
curl --fail --silent --show-error --output /dev/null --write-out 'status: %{http_code}\n' http://127.0.0.1:18767/
printf '\n[public cloudflare endpoint]\n'
curl --fail --silent --show-error --output /dev/null --write-out 'status: %{http_code}\n' https://fly.dpifiles.org/