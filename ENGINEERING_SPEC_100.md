# Roadster Engineering Specification — 100 Requirements

**Status:** in progress. This is the engineering backlog corresponding to the user's numbered 1–100 specification. A passing numerical unit test does **not** mean a real-world vehicle parameter has been validated. [V3.1 delivery](README.md#v31--engineering-specification-first-delivery-not-100100) only implements a targeted first batch.

## V3.1 delivered / partial coverage

| Requirement | Status | Scope delivered and limitations |
|---|---|---|
| 1 Independent unsprung mass | Implemented, conceptual | Four tire/hub displacement and velocity states; vertical tire compliance, inertial force transfer. Not full multibody dynamics. |
| 2 Wishbone geometry | Partial | Planar unequal-length arm constraints and camber gain; not complete 3D link geometry. |
| 3 Caster/trail | Partial | Caster/trail hardpoint parameters affect return-to-center rack response; no aligning-moment steering model. |
| 4 Bump/rebound toe | Partial | Geometric tie-rod projection; not a calibrated Ackermann or steering linkage. |
| 5 Progressive springs | Partial | Nonlinear end-travel response; preset and rate tuning exist, not replaceable physical spring catalog. |
| 6 Position-sensitive damping | Partial | Direction/velocity-sensitive bump/rebound; not a sampled shock-dyno curve. |
| 7 Split high/low-speed damping | Implemented, conceptual | Separate velocity coefficients for compression and rebound at a threshold. |
| 8 Adjustable bump stops | Implemented, conceptual | Adjustable stiffness via Suspension Lab slider, nonlinear engagement. |
| 9 Geometry-derived anti-roll | Partial | Anti-roll load-transfer with projected lever correction; no full bar-link torsion beam. |
| 10 Rough road measured trace | Partial | `traceProfile` ingests distance/elevation samples; no actual measured trace supplied. |
| 11 Pacejka tire curve | Partial | Smooth capped Magic Formula-inspired lateral forces. Not fitted to test tire data. |
| 12 Transient tire relaxation | Implemented, conceptual | Speed-dependent transient slip angle for each wheel. |
| 13 Inflation and stiffness | Partial | Pressure-dependent slip stiffness and grip; baseline inflation not yet independently tunable. |
| 14 Surface/carcass thermal | Partial | Separate thermal state and exchange, simplified rather than finite-element tread diffusion. |
| 15 Compound and heat cycling | Partial | Touring/Sport/Track choice and frictional wear; heat-cycle hysteresis not yet modeled. |
| 16 Hydroplaning | Partial | Water-depth and speed-based adhesion reduction; puddle world authoring pending. |
| 17 Thermal pressure rise | Implemented, conceptual | Ideal-gas absolute pressure response to carcass temperature. |
| 21 Motor torque map | Partial | RPM-based approximation, not dyno data. |
| 23 Battery limits | Partial | Temperature/SOC power taper, not pack electrothermal model. |
| 55 Steering suspension visuals | Partial | Wheels animate camber/toe; physical link pivots still approximated. |

## Not completed in V3.1

All other requirement numbers **18–20, 22, 24–54, 56–100**, plus the unfinished portions of the above rows. No licensed high-resolution Roadster mesh is included, no OEM validation dataset is available, no real-GPU WebGL benchmark has passed, and no claim of 100/100 delivery is made.

## Prioritized future release gates

- **V3.2:** measured or user-supplied rough-road profiles, adjustable tire pressure/compound calibration, and per-wheel Bode/frequency response and suspension telemetry plots.
- **V3.3:** full 3D linkage kinematics, hub-mounted mechanical link rendering, articulated steering, improved contact/friction solver.
- **V3.4:** calibrated drivetrain maps, controls and powertrain parameter validation, realistic damage and collision continuous detection.
- **V4:** professionally licensed high-resolution art, world and audio improvements, end-to-end WebGL and graphics performance QA on actual GPUs. Licensed mesh references and target GPU devices are prerequisites.

The full 100 concepts are also listed in [`ROADMAP_100.md`](ROADMAP_100.md). Further work must keep GitHub tests and Proxmox deployment rollbacks intact.


## V3.2 — subsequent partial coverage

- 24/25: improved differential front-wheel Ackermann angles, steering-rack rate and caster return (still not calibrated).
- 33/40: campus pylons now use finite-energy impulse-style dissipation; complete body collision shape fitting and general contact manifolds are not implemented.
- 51–60: procedural concept exterior, cabin, fenders, lighting, steering assembly and articulating control arms upgraded; licensed high-resolution OEM geometry and calibrated photometry remain unavailable.
- 61/67/83: separate slalom, braking course, skidpad, continuous route data, localized wet asphalt, dynamic engineering minimap. Full laser-scan data and terrain deformation remain pending.
- 88: basic gamepad steering/trigger support added. Calibration, deadzone UI and accessibility binding editor remain pending.
- No additional items in the 100-item specification are claimed fully validated.


## V3.3 — engine work delivered / still partial

- **21:** front/rear concept motor torque maps include distinct shaft speed, base torque, max power, and a redline taper. Their coefficients are not measured OEM maps.
- **22/24:** speed-dependent motor axle envelopes and conservative left/right force redistribution now account for total requested force; a physically modeled torque-vectoring differential is still outstanding.
- **23:** thermal/SOC discharge derating and high-SOC/cold charging limits now constrain the engine and regenerative path; cell-level electrothermal modeling remains outstanding.
- **27/28:** hydraulic pressure has first-order rise/release; driver brake demand is blended into power-limited regeneration and heat-sensitive friction brakes. Wheel-level ABS remains a simplified grip limiter.
- **11/12:** longitudinal relaxation and a smooth nonlinear slip curve added alongside the existing lateral tire model. Friction ellipse avoids summing independently saturated forces. Tire parameters are not fitted to measured data.
- **30:** live 0–60 and quarter-mile timers plus peak lateral g and energy counters are available; standardized surface calibration and validated skidpad/slalom timing are not.
- **41/42/43/47/49:** three-axis torque/rate integration, virtual balanced angular thruster couples, propellant-dependent inertia, actuator lag, and fuel use for attitude/translational jets have been added. A true coupled 6-DOF spacecraft model with real nozzle geometry/pressure dynamics is still **not implemented**.
- **95:** added an invariant showing fixed 120 Hz stepping yields identical physics for 30, 60 and 120 FPS rendering under the same inputs.
- V3.3 passes **117 numerical and CPU geometry checks**. This does **not** mean 117 of the 100 requested engineering requirements are complete. No automotive engineering validation or real-GPU screenshot differential test has been performed.