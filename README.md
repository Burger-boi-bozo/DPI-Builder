# Roadster Flight Lab V2 — V1 Heritage Edition

An independent, self-hostable flying Roadster-inspired arcade test range. This version **builds on the recovered original V1** rather than the abandoned procedural rewrite, and does not require ChatGPT authentication or any remote CDNs.

## Modes

- Flight Trial: all 12 original aerial checkpoints, checkpoints/resets and speed records.
- Stunt Run: 90-second scoring challenge featuring vehicle jump, barrel rolls and suction loop.
- Launch Sprint: NEW six-gate short course with its own best time and racing ghost.
- Free Roam: the full environment, unlimited cold-gas supply and no clock.

## V2 improvements

- V1's detailed sports car, environment, geometry, original physics model, HUD, minimap and touch controls retained.
- Local best-run replay as a translucent 3D ghost on Flight Trial and Launch Sprint.
- Toggle golden-hour, blue-hour and moonlight lighting with T or the toolbar.
- Capture in-game screenshots with H or the toolbar.
- Restyled four-mode selection; run data stored locally (no sign-in required).
- 15 automated Node physics tests, including all 11 original regression tests.

## Controls

WASD/arrow keys drive, Space provides upward cold-gas lift, Shift boosts, Q/E rolls, F toggles suction, C cycles camera, R resets, T cycles lighting, H saves a screenshot, M toggles audio, P/Escape pauses.

## Run

After cloning, extract bundled offline dependencies with `python3 -m zipfile -e artifacts/roadster-v2-deploy.zip .`; then serve `game/` as a static directory, e.g. `python3 -m http.server 18767 --directory game`. No build step. Self-contained ES modules and bundled Three.js + font assets; compatible with standard modern WebGL 2 browsers.

## Tests

`node --test tests/*.test.mjs` and `node --check game/*.mjs`.

## Attribution

Concept is an unofficial fan project; no affiliation with Tesla or SpaceX. The game retains `game/THREE-LICENSE.txt` and the font OFL. See V1 export's `DEPENDENCIES_AND_ASSETS.md` for bundled attribution.

## Deployment

`deploy/install-on-proxmox.sh` installs a ZIP already downloaded to Proxmox and backs up the previous deployment. Static site port `18767` behind existing Cloudflare Tunnel `fly.dpifiles.org`. Live site is only updated after tests pass.