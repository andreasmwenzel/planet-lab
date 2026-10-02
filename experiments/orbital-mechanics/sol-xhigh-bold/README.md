# The Last Orbit

A local, in-browser end-of-life flight desk. Rehearse impulsive spacecraft disposal, inspect the full orbit and altitude history, and aim the first 120 km atmospheric-interface crossing at a fictional equatorial longitude sector.

## Controls

- Edit the initial orbit, departure longitude, training window, impulse budget, and forecast horizon.
- Add up to six burns, edit their absolute mission times and radial/transverse components, or pin a burn on the orbit path or altitude plot.
- Scrub or play the flight. Space toggles playback; B adds a burn; the arrow keys move 30 seconds when focus is outside a field or button.
- Use **Set 80 km perigee** to write an explicit vis-viva burn into the selected card.
- Use **Solve a one-burn handoff** to search departure times within the budget and replace the ledger with the closest center-aligned plan.
- Undo/redo edits. Open the flight receipt for the state, outcome, assumptions, and a copyable/importable Plan JSON.

## Model

Two-body, planar equatorial point-mass gravity with spherical Earth (6,371 km radius, μ = 398,600.4418 km³/s²). Initial states are at apogee. Burn impulses act instantly in the radial/transverse basis. Universal-variable propagation supports closed and escape conics. Handoff timing is the first analytic conic intersection with a 6,491 km sphere, with a numerical bracket for exactly radial states. Longitude includes sidereal Earth rotation. The simulation stops at this interface.

No atmospheric trajectory, landing prediction, drag, heating, breakup, inclination, J₂, third bodies, finite thrust, fuel mass or actual disposal safety constraints are modeled. This is an educational rehearsal. The training sector is fictional.

## Rerun verification

Run these commands from this run directory. No package changes or build output writes are needed.

```sh
node --check main.js && node --check physics.js && node --check test-physics.mjs && node --check test-structure.mjs && node --check verify-build.mjs
node test-physics.mjs
node test-structure.mjs
node verify-build.mjs
```

The build script imports the installed Vite and explicitly disables config-file loading, public-directory processing and filesystem writes. The numerical tests import the actual `physics.js`; the independent RK4 reference is used only as a cross-check.

No browser localhost checks were performed. Actual rendering, interactions, accessibility and browser performance remain unverified. The structural test does not substitute for browser review.

No network requests, external assets, storage, accounts, publishing or Git operations are used.
