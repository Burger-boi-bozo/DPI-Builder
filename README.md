# Roadster X-Flight — Experimental Flight Lab V2.5

A self-hosted, original experimental-flight concept built on the recovered Roadster Flight Lab V1. This is **not** a physics-validated Tesla Roadster representation. Thruster characteristics, mass, aerodynamics, structural/thermal limits, and safety systems are hypothetical parameters designed for a playable R&D simulator. Not affiliated with Tesla or SpaceX.

## What makes X-Flight different

The default **X-Flight Lab** is a five-protocol flight certification, not a car race:

1. **Hover Capture:** use rocket lift, active stability and altitude hold to hover over a sensor pad.
2. **Vector Transfer:** navigate a low calibration ring through crosswinds.
3. **Ascent Corridor:** climb to a high-altitude gate without exhausting the propellant reserve.
4. **Lateral Impulse:** translate sideways and reorient for the final approach.
5. **Soft Docking:** land on a designated target within speed and structural limits.

The deterministic simulation updates at 120 Hz and models vehicle mass decreasing with propellant consumption, Newtonian gravitational acceleration, limited vectored thrust, aerodynamic drag proportional to density and airspeed squared, wind shear/gusts, temperature rise/cooling, attitude stabilization, hover-hold control, landing forces and cumulative structural damage. The physics uses real units but is **not a real vehicle simulation or certification tool**.

The live R&D instrument suite includes attitude/horizon indicator, vertical velocity, wind, thrust-to-weight, propellant mass, nozzle temperature, frame integrity, and a flight-trace oscilloscope. Every test flight is recorded. At completion/abort, export raw time-series data as CSV or replay the flight on a scrub-able timeline. Data stays in the local browser and is not sent to a server.

## V1 heritage modes preserved

- **Flight Trial:** 12 original aerial checkpoints, original physics, checkpoint penalties and records.
- **Stunt Run:** 90-second run with inverted suction loop, five-car jump and barrel-roll scoring.
- **Launch Sprint:** six-gate timed short course; translucent personal-best ghost.
- **Free Roam:** original test-range playground and unlimited arcade cold-gas lift.

## V2.5 visual and usability upgrades

- Research campus with launch and docking pads, lit telemetry gates, wind-shear vanes, calibration sensors, expanded instrumentation and animated cold-gas exhaust.
- More physically based metallic clearcoat Roadster concept body panels, surface detail, terrain/asphalt procedural textures, smooth lighting and distinct day/night profiles.
- Desktop/mobile UI and touch controls; in-game photo capture and selectable camera.
- Hover-hold and stability settings; no ChatGPT account, no remote CDN, no API keys.

## Controls

`W/S` drive/forward impulse, `A/D` yaw, `Space` apply upward thrusters, `Shift` boost, `J/L` strafe using lateral jets (X-Flight), `Z` toggle active altitude hold (consumes propellant), `G` toggle stability augmentation. `Q/E` barrel-roll on legacy modes, `F` toggle suction loop, `C` cycle cameras, `R` reset, `T` cycle lighting, `H` save a screenshot, `M` toggle sound, `P/Escape` pause.

## Run locally

Serve `game/` as a static directory. For example: `python3 -m http.server 18767 --directory game`. No compiler or backend; requires an up-to-date browser with WebGL2 and JS modules. When cloning from GitHub, extract the bundled offline assets first: `python3 -m zipfile -e artifacts/roadster-v2-deploy.zip .` (or deploy directly from the ZIP).

## Test and deploy

`node --test tests/*.test.mjs` runs 27 deterministic tests (11 original V1 physics, 4 V2 heritage, 12 new flight-model tests). `node --check game/*.mjs` verifies syntax. UI logic is additionally tested using a mocked renderer to exercise flight startup, telemetry, hover controller and checkpoint reset. **Full visual/WebGL playtesting on a GPU-enabled browser is still required.** Headless Chromium in the working sandbox could not establish a WebGL context.

Production: Proxmox `pve` at `/opt/roadster-flight`, service `roadster-flight.service`, loopback port `18767`, Cloudflare `https://fly.dpifiles.org`. Run `bash deploy/install-on-proxmox.sh` as root from a current `roadster-flight-v2` checkout to test, back up the previous version and swap in the self-contained archive. Source branch and release archive remain synchronized.

## License and attribution

Three.js notice: `game/THREE-LICENSE.txt`; font licenses: `game/FONTS-OFL-1.1.txt`. Fan concept; not official Tesla/SpaceX product, not a statement of actual vehicle capabilities. V1 attribution remains in the recovered original export.