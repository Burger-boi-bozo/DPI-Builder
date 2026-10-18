# V3.4.1 — Visual and Map Rebuild (2026-10-17)

The visual and map upgrade supersedes the old garage-blockout release. The car is a detailed licensed Roadster 2020 GLB (CC BY 4.0), with four independently animated, articulated hub pivots. The shared wheel-order bug (FL, RL, FR, RR versus physics FL, FR, RL, RR) was corrected in both the fallback and imported wheel pipeline.

The West Texas Engineering Autodrome is a closed course with smooth curves, painted curbs, road lamps, roadside structures, desert landscape, solar research roofs, and a wind-tunnel test compound. The original flight and suspension courses remain.

The GLB, GLTFLoader, Draco decoder and geometry utilities are downloaded by `deploy/install-on-proxmox.sh` using pinned HTTPS sources and verified SHA-256 digests, with a repeatable local cache. An offline unlicensed procedural fallback remains if the detailed model fails. A fresh server deployment requires internet access to fetch first-time assets. Attribution and license details are in `game/ASSET_CREDITS.md`.

A near-BeamNG node-beam soft-body physics engine has **not** been implemented. The current dynamics are an advanced rigid-body plus four-hub model with tire/brake/EV/thruster subsystems. True deformable collisions and OEM-calibrated parts are ongoing research. The model is a 3D artist's CC BY model, not engineering CAD. Final GPU-rendered browser visual QA is not verified in this execution environment.

---

# Roadster X-Flight — Experimental Flight Lab V3.3

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

## Visual and usability upgrades

- Research campus with launch and docking pads, lit telemetry gates, wind-shear vanes, calibration sensors, expanded instrumentation and animated cold-gas exhaust.
- More physically based metallic clearcoat Roadster concept body panels, surface detail, terrain/asphalt procedural textures, smooth lighting and distinct day/night profiles.
- Desktop/mobile UI and touch controls; in-game photo capture and selectable camera.
- Hover-hold and stability settings; no ChatGPT account, no remote CDN, no API keys.

## Controls

`W/S` drive/forward impulse, `A/D` yaw, `Space` apply upward thrusters, `Shift` boost, `J/L` strafe using lateral jets (X-Flight), `Z` toggle active altitude hold (consumes propellant), `G` toggle stability augmentation. `Q/E` barrel-roll on legacy modes, `F` toggle suction loop, `C` cycle cameras, `O` toggle free orbit (drag rotate, mouse wheel zoom, right-drag pan, double-click reset), `R` reset, `T` cycle lighting, `H` save a screenshot, `M` toggle sound, `P/Escape` pause. In Suspension Lab, hold `S` while stopped to engage Reverse (after 0.3 s); hold `W` after stopping to return to Drive, and use `K` to toggle traction control.

## Run locally

Serve `game/` as a static directory. For example: `python3 -m http.server 18767 --directory game`. No compiler or backend; requires an up-to-date browser with WebGL2 and JS modules. When cloning from GitHub, extract the bundled offline assets first: `python3 -m zipfile -e artifacts/roadster-v2-deploy.zip .` (or deploy directly from the ZIP).

## Test and deploy

`node --test tests/*.test.mjs` runs 117 deterministic checks across V1 heritage physics, flight certification, suspension, four-contact-patch tire dynamics, collisions, and CPU-level 3D model integrity. `node --check game/*.mjs` verifies syntax. UI logic is additionally tested using a mocked renderer to exercise flight startup, telemetry, hover controller and checkpoint reset. **Full visual/WebGL playtesting on a GPU-enabled browser is still required.** The working sandbox blocks full WebGL; automated browser UI interactions use a renderer stub, while all 3D meshes receive direct CPU-level geometry integrity tests. GPU-rendered QA remains outstanding.

Production: Proxmox `pve` at `/opt/roadster-flight`, service `roadster-flight.service`, loopback port `18767`, Cloudflare `https://fly.dpifiles.org`. Run `bash deploy/install-on-proxmox.sh` as root from a current `roadster-flight-v2` checkout to test, back up the previous version and swap in the self-contained archive. Source branch and release archive remain synchronized.

## License and attribution

Three.js notice: `game/THREE-LICENSE.txt`; font licenses: `game/FONTS-OFL-1.1.txt`. Fan concept; not official Tesla/SpaceX product, not a statement of actual vehicle capabilities. V1 attribution remains in the recovered original export.


## V2.6 — Real suspension and interface overhaul

- Entirely reworked flight UI: the main scene is unobstructed and the engineering instrument panel is explicitly toggled via **SHOW SYSTEMS**. Larger readable typography, mobile responsive, simpler controls and discrete mode selection.
- Four **independent spring/damper assemblies** modeled at 120 Hz, each sampling contact elevation per wheel. Includes wheel-normal forces, compression/droop travel, pitch/roll and sprung-mass heave, nonlinear bump stops, damping asymmetry and axle anti-roll bars. Tire grip responds to load and lost contact.
- **Suspension Lab** mode spawns directly at the 200-meter handling course. Hold **W** to roll through speed humps, a washboard, and an offset rut. Click **SHOW SYSTEMS** to read the four individual normal forces and travel indicators.
- The visual wheel carriers move with the computed travel rather than sharing body motion, and the exposed dampers and springs follow the animated wheels. The physical test strip is rendered with precisely the same height profile used by the physics solver.
- X-Flight telemetry CSV now includes four wheel strokes, four normal forces, chassis heave, pitch and roll.

The physics is a high-fidelity *concept-level* sprung-body simulation, not an OEM engineering model or a validated multibody tire simulation. Real Roadster suspension specifications, geometry, and empirical tire coefficients are not available. No claim of photorealism or experimentally validated Tesla performance is made.

## V2.7 — Tyre grip, collision and chassis fidelity

- The Suspension Lab now uses a separate four-contact-patch AWD model rather than a prescribed car heading. Each tire receives its instantaneous suspension load, Ackermann-like rack steer input, combined friction-limited longitudinal/lateral forces, wheel angular dynamics and slip response. Tire forces integrate a yaw moment against chassis inertia; steering with zero forward motion cannot spin the car in place.
- Tire/road coefficients can be switched between DRY and WET in the engineering instruments (`Y`). ABS saturation, corrective stability control, wheel slip, regenerative braking, effective electric-drive power, battery SOC, rotor heat and tire heat are simulated with parameterized, deliberately hypothetical constants.
- The handling lane has modeled steel crash barriers and nonteleporting contact impulses; corner hits damage the airframe. Braking distance, axle weight transfer, pitch/roll under accelerations, low-grip stopping distances and an extended deterministic regression suite are tested.
- Visual improvements include a cubic-smoothed body and canopy, refined bumper/splitter/lens details, tread and rotor geometry, stationary brake calipers, wishbone links, animated front steering and individual wheel spin driven by calculated wheel angular rates.
- CSV black-box samples include drivetrain and tire temperatures in addition to flight state and four-corner suspension telemetry. This is an original educational concept, **not measured Roadster hardware behavior** and not engineering-grade crash/suspension/tire validation.


## V2.8 — Chassis calibration and driver feedback

The Suspension Lab is now an adjustable **chassis test bench**, not a static suspension demo. Switch **Comfort**, **Balanced**, and **Track** (`B` or the Show Systems drawer); adjust spring stiffness and damper response independently while monitoring kN wheel loads, ride RMS vertical g, peak body roll, wheel airtime, and bump-stop events. The spring preload is automatically recalculated to hold the same static ride height so setup comparisons start from a meaningful reference. The benchmark control requires passing the first speed hump; restart the identical course to compare another setup under matched conditions. Results are local to the current session. Suspension coefficients remain deliberately hypothetical.

New ground-vehicle dynamics include tire-temperature and load-sensitive grip, a speed-dependent loss of wet-surface adhesion, brake fade under high rotor temperatures, heat/cooling, finite skid decals triggered by actual contact-patch slip, and visible brake/rotor feedback. These are approximate controlled models, not verified tire-compound data or real Roadster braking specifications. Flight-only instruments are removed from the Suspension Lab's engineering drawer; chassis tuning is accessible first on desktop and mobile.

## V2.9 — Driveline realism / launch-control lab

- Reverse is a distinct gear, requested by holding **S** after the vehicle stops for 0.3 seconds. **W** requests drive after coming to a stop. No direction flips at speed.
- On the Suspension Lab test strip, **K** toggles motor torque traction control. Slip-based torque reduction uses the previous 120 Hz tire slip estimate, and is reported on the diagnostics panel.
- Tire wear accumulates from slipping work, degrades available adhesion, and is reported as average tread wear. Releasing the pedals preserves the selected gear and gives the drive wheels a chance to regain contact traction.
- A CSV export is available live from the Suspension Lab workbench, with four tire wear channels and torque-control status appended to each 20 Hz sample. Ground and flight modes remain separate; the speculative flying performance is not real-world Tesla specification data.


## V3.0 — Orbital camera + screenshot layout repair + damper upgrade

- Free orbit through `O` or ORBIT CAM. Click/touch-drag to rotate around the vehicle, wheel/trackpad to zoom between 2.8–75 m, right-click-drag (or Shift-drag) to pan, and double-click to recenter. `C` cycles chase, hood, wide, and orbit. Camera stays vehicle-centered as it moves, has an under-ground floor clamp, and resets on a new run. Mobile orbit closes the systems panel to free up the gesture surface.
- The engineering panel has an inline critical-position fallback and the stylesheet is cache-busted per version, preventing the partial-old-CSS layout shown in the field screenshot. Compact and responsive instrument drawer; the visual play area stays clear.
- Damper relative velocity now samples and filters approaching road elevation per wheel so bump arrival affects the compression damper, not just the body. Progressive spring rate near bump stops. Existing load-transfer behavior remains verified through full regression testing.
- 73 automated checks including 8 new suspension/orbit tests; desktop/mobile browser interactions check orbit rotation, wheel zoom, reset, panel bounds, and JavaScript errors. Browser QA uses a mocked renderer because GPU WebGL support is unavailable on the test environment.
- `ROADMAP_100.md` contains one hundred specific prioritized improvements. Most remain proposed, not shipped.


## V3.1 — Engineering specification, first delivery (not 100/100)

- Replaces instantaneous suspension wheel contacts with four **independent vertical unsprung hub states**, including finite hub mass, tire radial rate, tire damping, dynamic wheel load and contact loss. Sprung-body heave/pitch/roll are still approximate; a six-degree-of-freedom coupled multibody model is **not** complete.
- Adds a projected unequal-length double-wishbone hardpoint solver. Each wheel reports camber, bump-steer/toe, projected track change, caster and mechanical trail. This is a deliberately approximate planar linkage, not CAD-verified Roadster geometry.
- Adds separate low/high-speed compression/rebound damping regimes, nonlinear rising-rate spring and adjustable bump-stop stiffness; user can tune bump-stop rate in Suspension Lab. Chassis and unsprung motion are integrated at 120 Hz.
- The ground tire model now uses a capped Pacejka-style lateral slip force, speed-sensitive slip relaxation, compound options (Touring / Sport / Track; press **I** or use the Systems control), carcass temperature, thermal inflation and pressure-dependent stiffness. Surface/carcass thermal coupling and high-water-depth hydroplaning are conceptual and not experimentally calibrated.
- The Engineering panel shows wheel camber, mean hub displacement, tire pressure and tire carcass temperature. Wheel carriers articulate with toe and camber. `game/engineering.mjs` accepts external distance/height traces as an interpolation function; no measured road traces are bundled or claimed.
- Adds 10 new numerical tests for independent hub states, four tire load support, bump response, airborne release, camber gain, nonlinear wheel response, tire force saturation, tire relaxation, tire pressure and deterministic trace interpolation. Total **83 automated checks**, plus Chromium renderer-stub UI tests.
- `ENGINEERING_SPEC_100.md` tracks the user's 100-item engineering request. Most specifications remain *pending or partial*; this release does not claim OEM fidelity, licensed concept meshes, true WebGL GPU validation or all 100 completed.


## V3.2 — Steering / vehicle mesh / handling campus / ground physics

- Directional steering **A left / D right**, faster rack input, independent Ackermann left/right front wheel carrier angles, corrected ESC target yaw sign, higher-speed steering range and caster-return behavior. Supports analog steering from the standard Gamepad API (left stick, shoulder triggers for power/brake).
- Wheel-carrier links animate between body hard points and hub movement; steering wheel turns. Revised fender arches, DRL and rear-light assemblies, door details, mirrors, and separate bucket-seat cockpit and instruments. Procedural concept model, not licensed OEM geometry.
- South of the suspension strip: continuous slalom/braking corridor, eight impact-detectable pylons, skidpad ring and connector route; roadway lines, signs and dynamic minimap. Localized water depth affects tire adhesion and hydroplaning forces; physics shares route data with the renderer. Pylons topple on contact, damage is tracked.
- New fixed-timestep tests verify steering direction, mirror symmetry, neutral caster return, analog input, geometry, wet-patch grip, navigable routes, and single-event cone impact.
- For the first drive, use **Suspension Lab**; hold **W** to accelerate; **A** is left, **D** is right, **S** brakes and then requests Reverse when held stationary. Drive south (negative Z) past the damper corridor to reach slalom and skidpad.
- Physics uses an improved coupled four-wheel approximation rather than a validated multibody dynamics engine. Visual rendering is not fully GPU-verified here.


## V3.3 — Physics architecture overhaul (117 regression checks)

- New **`game/powertrain.mjs`** models independent front and rear torque-speed maps, power-limited EV motor speed envelopes, pack thermal/SOC derating, motor-command lag, rate-limited hydraulic pressure, mechanical brake/regen blending, controlled differential vectoring and wheel angular reaction torque.
- Longitudinal slip has its own relaxation state and nonlinear bounded force curve. The four contact patches share combined lateral/longitudinal friction constraints. This remains a stabilized hybrid contact solver, not experimentally fitted tire data.
- Ground engineering statistics now include front/rear motor limits, brake pressure, regenerative output, battery draw, recovered energy, slip-work losses, 0–60 MPH and quarter-mile timers, and peak lateral acceleration. These live under an **optional collapsed panel** within Show Systems.
- New **`game/attitude.mjs`** integrates independent yaw/pitch/roll angular rates and moments of inertia. Cold-gas reaction jets debit propellant for attitude control. Lateral and forward jet thrust also consume propellant; depleted tanks cannot propel the craft.
- New tests cover motor-envelope limits, battery cold/heat/SOC derates, thermal/regen constraints, friction ellipse invariants, torque-vectoring symmetry, hydraulic lag, wheel inertia, deterministic solver behavior under randomized input, attitude rate stabilization, and 30/60/120 FPS frame-cadence consistency. **117/117 tests** pass locally prior to release.
- Actual WebGL GPU rendering remains unverified in the test sandbox. The model and coefficients remain fictional and should **not** be used for Roadster engineering or vehicle safety predictions.

See [`PHYSICS_ENGINE.md`](PHYSICS_ENGINE.md) for system equations, invariants and remaining accuracy limits.


### V3.4.1 stability hotfix
- Fixed frozen gameplay after imported GLB initialization (missing `driveVisualWheelRig` runtime import).
- Expanded out-of-range bounds so the entire autodrome is playable without infinite resets.
- Defaulted to the concept study mesh, not the outdated and incorrectly identified 2020 Roadster. The 2020 CC-BY mesh is kept for explicit QA via `?legacy-roadster=2020`. Exact October 2026 Rocket CAD is not currently available.
- Added a browser regression that mounts a mock four-hub model after starting; its active clock must continue increasing.