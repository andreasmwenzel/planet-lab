# Kepler Dispatch

A complete single-player orbital courier game. Six authored contracts teach orbit raising, circularization, eccentric routes, rendezvous, retrograde returns, and escape. A seeded dispatch board and an unlimited free-flight mode extend the campaign.

## Entry and integration

- Entry: `index.html` with exactly `<script type="module" src="./main.js"></script>`.
- Runtime files: `main.js`, `physics.js`, `missions.js`, `renderer.js`, `style.css`.
- Vanilla JavaScript and Canvas 2D; no dependencies in the runtime and no WebGL requirement.
- Compatible with bundling to one inline HTML document and an opaque-origin `sandbox="allow-scripts"` iframe. No frame communication, cookies, persistence, network requests, remote fonts, or remote assets.
- The Vite validator uses the already-installed Vite and `write:false`; it does not publish or create a dist directory.

## Play

Choose a contract, adjust tangential and radial delta-v, inspect the gold predicted orbit, and execute. The pilot's notebook can calculate conventional transfer burns, but does not execute them. Coast with time warp or apsis jumps. Confirm delivery once every objective is met. Rewind freely.

Three seals recognize delivery, fuel efficiency, and speed. All six routes are selectable immediately. Best seals last for the current visit only. Open dispatch accepts repeatable route codes; free flight offers four initial altitudes and unlimited delta-v.

The controls and model manual are available in the app. Keyboard: Space pause/resume, B burn, R rewind, ? manual. Numerical controls are alternatives to map dragging. The layout adapts at 880, 700, and 470 px.

## Physics

The actual implementation is a bracketed universal-variable Kepler propagator with Stumpff functions. Earth is spherical and stationary, with μ = 398600.4418 km³/s² and radius 6371 km. Internal units: km, seconds, km/s. Impulses: m/s. Transverse and radial burn axes are orthonormal; +T is along orbital travel perpendicular to the position vector, rather than along velocity away from an apsis.

Assumptions: planar, Newtonian, point-mass two-body motion; instantaneous burns; abstract delta-v budget. No drag, J2, Sun, Moon, Earth rotation, engine dynamics, mass depletion, inclination, landing, or launch. The flight is recalled below 100 km. This is a game/learning model, not operational navigation software. Station capture uses deliberately forgiving 50 km / 60 m/s tolerances. Ship/station symbols are enlarged, while orbit distances use one linear scale.

Game coast checks are at most 20 simulated seconds apart; a radial sign change and unsafe periapsis also detect atmospheric grazing between samples. Future nearest-pass estimates are sampled and refined over at most four hours; they are not a global rendezvous solver.

## Verification

Run from this directory with Node 24 and the installed Vite available in the ancestor project:

```
node --check main.js
node --check physics.js
node --check missions.js
node --check renderer.js
node physics-tests.mjs
node ui-smoke-tests.mjs
node ui-smoke-tests.mjs --no-canvas
node validate-build.mjs
```

Reports are regenerated in the same directory. `physics-tests.mjs` tests the actual runtime functions, not a duplicate model. The UI smoke harness loads the actual main module and dispatches control events using a lightweight mocked DOM and Canvas API. It is explicitly not a browser or visual/layout test. Browser localhost access was unavailable, and no browser checks are claimed.

Primary conceptual reference: NASA, *Basics of Space Flight*, chapters 3 and 4:
https://science.nasa.gov/learn/basics-of-space-flight/chapter3-3/
https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/
