# Pocket Cosmos ✦

A tiny, entirely fictional solar system for curious minds and idle moments. Five procedural planets, one warm little sun, and an unreasonable amount of personality. Built with **Three.js + Vite**, without a framework, backend, external assets, accounts, telemetry, or runtime network requests.

## Run it

Requires Node.js **22.12+** (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Use a current browser with **WebGL 2** and hardware acceleration enabled.

```sh
npm test          # Pure simulation tests, Node's built-in test runner
npm run build    # Production bundle in dist/
npm run preview  # Preview that production bundle locally
npm run check    # Tests + production build
```

## Play

- **Drag** the scene to orbit the camera; **scroll or pinch** to zoom
- **Click a planet**, or use its accessible color button, to read its field notes
- **Take a closer look** follows the selected world; drag to release the follow camera
- **Pause/play** time, or set orbital speed from **0.25× to 3×**
- **Launch a comet** across the system. Up to four comets can exist at once; launching resumes paused time
- **Labels** toggles names, and **reset** restores the camera, time, speed, labels, selected world, and comet state
- Keyboard shortcuts when focus isn't on another control: **P** pause/play, **C** comet, **R** reset

Mobile supports one-finger orbit and two-finger pinch. Planet selection and all actions are also available as standard keyboard-accessible HTML controls. `prefers-reduced-motion` starts the system paused. The WebGL scene itself is decorative to screen readers; field notes and controls remain semantic HTML.

## Under the hood

- Locally generated surface textures, star field, sun glow, and planetary rings
- Seeded procedural visuals; no texture downloads or paid assets
- Raycast picking and smoothly eased planet-follow camera
- Bounded comet lifetimes, disposed trail resources, capped device pixel ratio
- Frame-delta clamp and hidden-tab simulation pause
- WebGL startup failure message and a context-loss recovery hint

This is a playful rendering experiment, **not an astronomy or gravity simulation**. Orbits are intentionally circular and stylized; sizes, names, speeds, and colors are made up. There is no audio, persistence, or API key setup.

## Project map

- `src/main.js`: Three.js scene, procedural materials, camera and UI
- `src/simulation.js`: Planet definitions and pure simulation functions
- `src/style.css`: Responsive interface
- `test/simulation.test.js`: Determinism, timing, orbit and comet tests

## Privacy and publishing

The repository can remain private. `npm run build` only writes files locally; no command deploys the app, enables GitHub Pages, or makes the source public. To share a running version later, choose an explicitly authorized hosting destination and serve `dist/` as static files.

## Verification

Seven pure simulation tests and the production build passed in the creation environment. Live browser visual and interaction testing was blocked by that environment’s browser access restrictions, so those checks still need to be performed. No automated deployment or CI workflow is configured.
