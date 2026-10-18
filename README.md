# Roadster Flight Lab

An independent 3D browser game inspired by the October 2026 Roadster reveal.

## Play

The static application lives in `dist/`. Serve that directory with any HTTP server. No build step or server data is required. Three.js and the interface fonts are vendored. The reveal player loads YouTube only when the player requests it.

- **Flight trial:** fly through twelve ordered gates. A reset adds three seconds. Best time is stored on the current device.
- **Stunt run:** ninety seconds to score with barrel rolls, airtime, a lineup jump, and a full suction loop.
- **Free roam:** unlimited compressed air and no time limit.

WASD or arrow keys drive. Hold Space for lift, Shift for rear thrust, Q/E to roll. Release lift to descend. F toggles suction, C changes camera, R resets, Esc/P pauses, and M toggles sound. Touch controls are provided. The west loop is entered from the south with suction enabled and a forward speed above 13 m/s.

The car model, terrain, gates, particles, and interface are original procedural assets. Handling is intentionally arcade-like and does not reproduce or validate vehicle specifications. No accounts, analytics, or network game services are used. Sound starts muted.

## References

- Elon Musk, lineup jump: https://x.com/elonmusk/status/2110913107094606330
- Tesla, suction-ramp clip: https://x.com/Tesla/status/2110913438293647789
- Tesla, full reveal: https://www.youtube.com/watch?v=qt5p-_tE8d0
- Official visual reference: https://www.tesla.com/roadster

X playback was inaccessible in the build environment. The mechanics were based on accessible reveal descriptions and the official Tesla visual references. Original videos are linked in the game, with an optional official reveal embed; no original footage is bundled.

## Verification

Run `node --test tests/physics.test.mjs` for deterministic checks of the simulation, gate detection, mode completion, fuel behavior, resets, and stunt scoring.

Three.js is copyright 2010–2024 Three.js Authors, licensed under MIT. The vendored distribution includes its license header; see `dist/THREE-LICENSE.txt` for the full license.

## V1.1 flight update

This continues original V1 from commit `3ccc626bc44b19b0f4d3a4d1fd1a75c0fbde8a48`.
The original procedural car, desert test range, 12 gates, loop, and three modes
remain the foundation. The public V1 URL is https://fly.dpifiles.org/v1/.
The separate Dynamics Lab and its branch are maintained independently.

- **H / HOLD:** lock the current altitude once airborne. Uses 6% air per second.
  Space, X, empty air, landing, or reset returns to manual vertical control.
- **X / DOWN:** descend faster; tap lift near the ground for a softer landing.
- **Flight guide:** projected gate marker and a route through the next gates.
  Missed gates direct you back to the approach side.
- **Checkpoint splits:** compare with the splits from your best completed V1.1
  trial. Old V1 time records remain; a new best stores its corresponding splits.
- **Stunt chains:** complete another stunt within seven seconds to increase
  the multiplier up to ×5. Hard landings and resets break the chain.
  Combo-enabled stunt records are separate from the original stunt scores.
- **Medals:** trial gold/silver/bronze at 48/65/90 seconds; stunt gold/silver/bronze
  at 12,000/7,000/3,500 points. Results include top speed and maximum altitude.
- **Settings:** performance, balanced, or high graphics; reduced camera motion;
  optional flight guide. Preferences are saved on the current device.
- **Mobile:** visible run timer, descend/hold controls, and a camera button.

Run all 19 simulation regressions with `node --test tests/physics.test.mjs`.
The suite includes a complete 12-gate flight using normal steering and lift,
altitude hold with fuel exhaustion, combo limits, recovery guidance, and medals.

No build or npm installation is needed. Serve `dist/`; all runtime dependencies
and fonts are included. `dist/release.json` identifies this release. Fonts retain
the SIL Open Font License in `dist/FONTS-OFL-1.1.txt`.
