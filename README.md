# Roadster Flight Lab V1 — Realism Rebuild

Play: **https://fly.dpifiles.org/v1/**

A ground-up replacement of V1's arcade movement, procedural car, range, and interface. It runs as a self-contained static browser game, with no account, build step, or server-side game state. Game assets and runtime dependencies are bundled. The separate main game and its development branch are independent.

## What changed in 1.2

- Six-axis rigid body integrated at 120 Hz, quaternion orientation, gravity, angular inertia, aerodynamic resistance and downforce.
- Four independent spring-and-damper suspension contacts; tire forces react to slip, surface grip and normal load. Longitudinal and lateral forces share a combined friction limit. Rear-wheel drive, power-limited propulsion, load transfer, Ackermann steering, handbrake and a ground-effect fan.
- Lift and rear thrust apply force in the car's orientation. Airborne yaw does not redirect existing velocity. Roll uses angular momentum. Gas consumption follows delivered impulse; mass changes with the reservoir. Optional stabilization and altitude hold consume gas too.
- A new original Roadster model inspired by the October 2026 reveal: contoured body panels, wheel arch openings, glazing, detailed wheels and brake discs, cockpit, live dashboard, full-width rear lamp, diffuser and ten nozzle outlets.
- A 1.4 km runway, handling circle, apron and service pad, launch ramp, hangars, lighting, rolling terrain, skid marks, tire dust and expanding cold-gas plumes. Hangars have collision boxes. The ramp mesh and simulation use the same height function.
- CC0 photographic HDR environment lighting, physically based paint and glazing, contact shadows and adjustable shadow quality. Three lighting treatments and four body finishes.
- Chase, cockpit, hood and orbit cameras; paused photo mode with drag orbit and scroll zoom. EV motor harmonics, rolling/wind noise, slip and gas audio (off initially).
- Keyboard, multitouch and standard gamepad input. Phone HUD, settings, pause/resume, best times/splits and stunt scores saved on the device. Existing classic V1 records are retained under their old storage keys.

## Controls

| Input | Action |
| --- | --- |
| W / S or up / down | Accelerate / brake, then reverse |
| A / D or left / right | Steer; airborne yaw |
| Space / X | Lift / controlled descent |
| Shift | Rear cold-gas thrust |
| H | Capture current altitude while airborne |
| F | Toggle ground-effect fan |
| Q / E | Roll thrusters |
| I / K | Manual pitch when stabilization is disabled |
| B | Rear handbrake |
| C | Cycle camera |
| O | Pause in photo mode; drag to orbit, scroll to zoom |
| R | Recover; adds 3 seconds in flight trial |
| Esc / P | Pause / resume |
| M | Sound on / off |

Standard gamepad: left stick steering, triggers throttle/brake, A lift, B descend, X boost, bumpers roll, right-stick vertical manual pitch, D-pad up altitude hold, Start pause. Touch controls are included.

## Sessions and assistance

**Open range:** unlimited training gas is enabled initially and identified in the HUD. Disable it in Setup for a finite reservoir. The marked purple service pad refills finite gas only when stopped.

**Flight trial:** eight directional gates, swept crossing detection and best-run splits. Gas is replenished at gates as an explicitly disclosed training convenience. Recoveries add three seconds. Conserving momentum matters: pointing the car into a turn does not turn its existing velocity. Use thrust to redirect it.

**Stunt session:** 90 seconds with finite gas. Full airborne rotations earn points and can chain up to ×5; air time scores on a gentle landing. Hard landings break the chain.

## Fidelity and limits

This is an independent fan simulation, **not a validated digital twin** or a claim about a production vehicle's measured performance. Mass, power, tire stiffness, grip, suspension, aerodynamic coefficients, tank capacity, exhaust velocity and thrust are estimated tuning parameters in `dist/physics.mjs`.

The tire model uses a saturated slip-angle response and a combined friction circle, not a manufacturer tire dataset. Wheel spin is visual, rather than a separately integrated tire/drivetrain model. There is no deformable crash simulation, thermal tire model, real-time ray tracing or scanned vehicle mesh. Collision boxes approximate hangar walls; suspension/hull contacts model the driving surface. Graphics run locally on the player's GPU; Ultra increases resolution and shadow detail.

## Run and verify

Serve `dist/` with a normal static HTTP server. All executable runtime dependencies and the HDR environment are included. `dist/release.json` identifies the release.

```sh
node --test tests/physics.test.mjs
node --check dist/game.mjs
node --check dist/scene.mjs
node --check dist/vehicle.mjs
```

Thirty deterministic checks cover static load balance, acceleration/braking load transfer, stopping distance, energy loss, reverse, steering symmetry, grip saturation, gravel, conserved airborne momentum, gas accounting/exhaustion, altitude control, roll recovery, pit refill, ramp launches, landing, recovery penalties, swept gate crossings, ordered trial progress, timed completion, timestep convergence, fan load and wall collision. The ordered gate test checks crossing/score logic, not autonomous completion of the course.

For the existing DPI Proxmox host, `deploy/install-v1.py` remains the initial isolated-route installer. V1 uses `roadster-flight-v1.service` on loopback port 18768. The root game uses its own service and port 18767. After pulling the branch, run `python3 deploy/update-v1.py`. Updates are staged as immutable release directories and published by atomically replacing `public/v1`; the prior release is retained for rollback. No tunnel edits are needed for normal updates.

## References and credits

- Official vehicle visual reference: https://www.tesla.com/roadster
- Official reveal: https://www.youtube.com/watch?v=qt5p-_tE8d0
- Original inspiration: https://x.com/elonmusk/status/2110913107094606330 and https://x.com/Tesla/status/2110913438293647789
- HDR sky, Greg Zaal / Jarod Guest (CC0): https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky
- Three.js r170 / RGBELoader: MIT. Fonts: SIL OFL. See `dist/ASSET-CREDITS.md` and bundled licenses.

Tesla reference images were used for modeling and are not bundled. The prior classic release remains in Git history at `d4009f6ddc09b99f2b97e8947a8b30ebea999191` on this branch.

### Validation for this release

The 30 physics checks passed locally and on the deployment host. A DOM/runtime smoke check exercised startup, acceleration HUD updates, pause/resume, lift and altitude hold, four cameras, photo mode, settings, viewport resizing and both challenge modes, with a mocked graphics backend. The model geometry was inspected from three angles. Desktop Chrome subsequently rendered the game at a displayed 119–120 FPS on the available machine. Browser inspection found and corrected mirrored body-surface winding, menu framing, cockpit eye position and cabin closure. Sustained live driving and physical mobile-device performance remain separate checks from the deterministic simulation tests.

The domain's existing Cloudflare configuration injects security and traffic measurement scripts into HTML. The game code does not add its own analytics. Public game modules, styles and the HDR asset were verified byte-for-byte against the published source; the HTML contains those hosting-provider additions.
