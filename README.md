# Roadster // Flight Lab — V2

Standalone 3D arcade driving and flight experience, built with Three.js + Vite. Unofficial fan concept: not affiliated with Tesla, SpaceX, or Elon Musk.

## Live build

- Intended URL: https://fly.dpifiles.org
- Host: Proxmox `pve`, serving a static Vite build through an isolated local HTTP service and existing Cloudflare Tunnel.
- Legacy V1: https://roadster-flight-lab.bonnycove6.chatgpt.site (preserved separately).

## Features

- Three modes: **Launch Run** (6 staged checkpoints + runway ramp), **Sky Trial** (12 aerial checkpoints), **Free Flight** (open simulation).
- Procedural Roadster-inspired 3D vehicle, road, launch ramp, distant mountains, tower landmarks, gates, particle thrusters, sunset environment.
- Arcade 6-DoF-inspired control: steering, yaw, pitch, roll, thrust, boost, landing and automatic ramp launch.
- Chase, long-chase, cockpit, and look-back cameras.
- HUD with live speed, altitude, climb rate, boost, checkpoints, elapsed time, and best run (localStorage).
- Keyboard and touch controls; opt-in synthesized engine sound.
- Accessibility: focus outlines and reduced-motion support.
- High-speed gate intersection uses swept point-to-sphere testing.

## Controls

| Control | Action |
| --- | --- |
| W / S | Accelerate / Brake |
| A / D | Steer / Yaw |
| F | Toggle flight mode |
| Up / Down | Pitch up / down |
| Q / E | Roll while flying |
| Shift | Rocket boost |
| C | Cycle camera |
| V | Look back |
| R | Restart run |
| Esc | Pause / Resume |

On mobile, use the on-screen arrow, GO, FLIGHT and BOOST controls.

## Local development

```bash
npm ci
npm run dev
npm run check
npm run build
```

`dist/` is the static deployment artifact. No API keys, user accounts, telemetry collection, or paid services required.

## Provenance and media

The original V1 was a separately hosted sign-in-protected ChatGPT site and its source was not directly retrievable. This is an independent V2 implementation, not a byte-for-byte fork. A Roadster demonstration clip reportedly downloaded in Crate was not present in the inspected local Crate directories; no third-party video was bundled or republished.

## Version control

- Stable base: `main` (existing DPI Builder repository).
- Independent development branch: `roadster-flight-v2`.
- Do not merge into main until gameplay and visual QA are complete.