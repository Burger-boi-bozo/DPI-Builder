# Roadster // Flight Lab — V2

Standalone 3D arcade driving and flight experience, built with Three.js + Vite. Unofficial fan concept: not affiliated with Tesla, SpaceX, or Elon Musk.

## Live build

- Public URL: https://fly.dpifiles.org — verified HTTP 200 without ChatGPT authentication on October 17, 2026.
- Host: Proxmox `pve`, serving a static Vite build through an isolated local HTTP service and existing Cloudflare Tunnel. The public DNS CNAME points to the tunnel, not ChatGPT Sites.
- Legacy V1: https://roadster-flight-lab.bonnycove6.chatgpt.site (preserved separately).

## Features

- Four modes: **Launch Run** (6 staged checkpoints + runway ramp), **Sky Trial** (12 aerial checkpoints), **Stunt Demo** (five-stage inverted suction loop and kickflip course inspired by the October 2026 reveal), **Free Flight** (open simulation).
- Procedural Roadster-inspired 3D vehicle (red prototype and white reveal colorways), road, launch ramp, distant mountains, tower landmarks, gates, particle thrusters, sunset environment.
- Arcade 6-DoF-inspired control: steering, yaw, pitch, roll, thrust, boost, landing and automatic ramp launch.
- Chase, long-chase, cockpit, and look-back cameras; airborne kickflips and suction-assisted inverted-loop driving.
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
| Shift | Rocket boost |\n| X | Activate fan grip to stick to the inverted loop |\n| Space | Airborne kickflip |
| C | Cycle camera |
| V | Look back |
| R | Restart run |
| Esc | Pause / Resume |

On mobile, use the on-screen arrow, GO, FLIGHT, BOOST, SUCTION and FLIP controls.

## Local development

```bash
npm ci
npm run dev
npm run check
npm run build
```

`dist/` is the static deployment artifact, served by `roadster-flight.service` on localhost port 18767 on Proxmox `pve`. Public traffic flows through `cloudflared-public-routes.service`. Run `bash deploy/verify.sh` for repeatable checks. No API keys, user accounts, telemetry collection, or paid services required.

## Provenance and media

The original V1 was a separately hosted sign-in-protected ChatGPT site and its source was not directly retrievable. This is an independent V2 implementation, not a byte-for-byte fork. A Roadster demonstration clip reportedly downloaded in Crate was not present in the inspected local Crate directories; no third-party video was bundled or republished. The stunt challenge is a stylized interpretation of public October 2026 Roadster reveal coverage, not a mechanically accurate simulation or a frame-by-frame video recreation.

## Version control

- Stable base: `main` (existing DPI Builder repository).
- Independent development branch: `roadster-flight-v2`.
- Do not merge into main until gameplay and visual QA are complete.