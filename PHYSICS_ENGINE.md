# Roadster Physics Engine — V3.3 Architecture

**Status:** tested experimental simulation, **not** measured/validated Tesla Roadster physics. All parameters are original hypotheses. It is intended for interactive education and game handling, not actual vehicle design or safety evaluation.

## Units and integration

The simulator's simulation loop advances at **120 Hz (8.333 ms)** independently of rendering. Torque is N·m, distance m, force N, mass kg, inertia kg·m², energy J, pressure kPa, angular velocity rad/s, and power W. The test suite checks deterministic repeatability under the same inputs, fixed-step frame-cadence invariance, finite-state outputs, and explicit energy-accounting channels. Stress tests vary contact, steering, acceleration, rain, suspension presets, and temperatures.

## Ground dynamics (4 contact patches)

- **Bodies:** approximate sprung-body heave/pitch/roll plus four finite-mass vertically translating hubs. The yaw degree of freedom is integrated from tire-generated torques; planar surge/sway are integrated from local contact forces. This is **not** a full multibody 6-DOF chassis solver.
- **Suspension:** unequal-length projected double-wishbone hardpoints produce approximate camber gain, tie-rod toe changes and projected track variation. Nonlinear springs, asymmetrical low/high-velocity dampers, tunable bump stops, anti-roll coupling, tire vertical compliance and road-velocity sampling feed hub and body equations.
- **Tires:** combined-slip friction cap, transient lateral and longitudinal relaxation, Pacejka-inspired nonlinear force curves, suspension-dependent normal load, pressure and compound modifiers, temperature, wear, wet surface and hydroplane reduction. Force cap operates on both longitudinal/lateral components together.
- **Motors:** independent front/rear electric motor torque/shaft-speed envelopes. Flat low-speed torque transitions to power-limited high-speed output and then redline taper. SOC/battery temperature further limit output. A low-pass motor actuator models requested torque response. Axle torque is split among wheels and adjusted by limited differential torque vectoring.
- **Braking:** independently rate-limited hydraulic pressure, front/rear brake bias, rotor heat and fade, battery-SOC-limited regenerative braking blended with friction brakes, wheel rotation with inertia and tire torque reaction. ABS/TCS and ESC remain approximations rather than hardware-validated controllers.
- **Yaw/steering:** rack-angle limits, speed-sensitive steering and caster/trail return; actual front wheel Ackermann angles; yaw acceleration from forces applied at each wheel's lever arm with an ESC moment when needed.
- **Diagnostics:** battery energy out, energy recovered, tire slip work, friction-brake work, time to 60 MPH, quarter-mile accumulated path distance, peak lateral g, per-wheel forces, torque caps, contact losses and suspension wear.

### Example relations

Motor rotational speed is related to road speed by `rpm = v × finalDrive × 60 / (2πR)`. Below the base rpm the motor uses a constant torque envelope; above base rpm `τ ≤ Pmax/ω` plus an upper-speed taper. Axle tractive force is limited by torque, ratio, wheel radius, efficiency, pack power and road traction.

Longitudinal tire slip is `(ωR - Vx) / max(2 m/s, |Vx|)`. The tire force follows a bounded nonlinear function of relaxed slip and a friction ellipse shared with lateral force. Wheel angular acceleration depends on `(motor torque - brake torque - road reaction torque) / wheel inertia`. The solver applies a small demand feed-forward component to maintain controllable low-speed behavior; it is therefore not a pure calibrated slip-only model.

Regenerative braking demand is limited by driver pressure, axle speed, battery thermal/charging constraints and a total regenerative force envelope. Mechanical friction braking absorbs the remaining requested brake force. Energy counters integrate torque/force work over time, but they **do not constitute a complete energy conservation proof** including thermal/collision energy.

## Flight attitude and propulsion

V3.3 adds a three-axis angular dynamics subsystem with separate yaw, pitch and roll rates, finite torque/jet authority, propellant-dependent moments of inertia, rate feedback, damper terms and matched reaction-jet force pairs. Attitude-controller fuel flow is debited from the main tank. Translation jet use for lateral/forward flight is also debited using `ṁ = thrust / effectiveExhaustVelocity`; tank depletion disables powered jets. Virtual nozzle pairs provide balanced net force for pure attitude requests.

This system remains **3-axis attitude dynamics plus simplified 3D translational dynamics**, rather than a fully coupled quaternion 6-DOF engine with independently calibrated valve/nozzle forces. Hover altitude hold, turbulence, structural damage, drag and touchdown physics also remain phenomenological approximations. It is a major step beyond decorative pitch/roll animation, not completion of requirements 41–50.

## Invariants and acceptance gates

- No free propulsive thrust from an empty propellant tank.
- Torque vectoring must preserve the sum of requested drive force and left/right symmetry.
- Tire forces must be finite and remain within configured friction limits.
- Pressure, SOC, wheel omega, thermal states and rotor heat remain bounded.
- Hydraulic pressure responds continuously; holding a brake at a stop cannot propel the car backwards.
- Reverse engagement requires near-zero speed; yaw is not directly teleported from steering input while stopped.
- Motor/regen maps derate under physical limits; regenerative power is zero when the battery is fully charged.
- Fixed-step simulation must match across 30, 60, and 120 FPS render schedules under identical sampled inputs.
- Previously delivered Flight Trial, Stunt, Launch, Free Roam, Suspension Lab and X-Flight tests must all remain green.

## Unfinished engineering work

True three-dimensional articulated suspension links, accurate 6-DOF contact/collision impulses, tire force curves fitted to telemetry, real chassis/body CAD, OEM motor inverter maps, wind-tunnel calibration, actual LiDAR road traces, structural deformation, and end-to-end GPU visual validation are pending. The simulator cannot honestly claim roadworthiness, aerospace-grade accuracy, or photorealism.