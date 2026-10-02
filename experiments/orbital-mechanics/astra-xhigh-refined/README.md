# Apsis — Earth transfer workbench

A focused, self-contained orbital mechanics simulator for designing and rehearsing circular-to-circular Earth transfers. Choose altitudes, compare raising and lowering transfers, and turn off the arrival burn to watch the spacecraft return along the transfer ellipse.

## Entry point

`index.html` loads `main.js`, which imports local `style.css` and `physics.mjs`. The supplied Vite/common viewer harness can bundle the application. There are no additional dependencies, remote assets, network requests, or persistent storage. The only development dependency used by the build check is the already-installed Vite.

## Controls

- Edit either altitude directly or use its logarithmic slider (160–50,000 km).
- Use Raise orbit, To GEO, Return, or swap the two altitudes.
- Rehearse, pause, rewind, change playback rate, or seek with the timeline and burn buttons.
- Disable the arrival burn to coast through the arrival point and back to departure.
- Click near the transfer path to seek; drag to pan; scroll or use the buttons to zoom; Fit restores scale.
- Velocity toggles a direction/relative-speed vector. Vector length is illustrative, while all orbit and Earth distances share the same scale.
- Space plays/pauses when focus is outside a control. Left/right arrows seek by 1% of mission duration when focus is outside a control. Native range controls support keyboard operation.
- Model & guide describes the physics, workflow, and limitations.

The initial spacecraft state at elapsed time zero is immediately after the departure impulse. The exact arrival instant is immediately after the insertion impulse when enabled. Playback starts paused and pauses when the document is hidden or the guide opens. Changes to orbital altitudes restart the rehearsal; toggling insertion preserves elapsed time, clamped to the new horizon.

## Re-run every check

From this directory:

```sh
node verify.mjs
```

Or from anywhere:

```sh
cd /workspace/scratch/bb2a48021f5a/planet-lab/experiments/orbital-mechanics/astra-xhigh-refined && node verify.mjs
```

Individual checks:

```sh
node --check main.js
node --check physics.mjs
node test-physics.mjs
node test-interface.mjs
node test-build.mjs
```

The physics tests import the actual application physics module. They include fixed numerical references, Kepler residuals, conservation, finite differences, endpoint continuity, missed insertion, and comparison against an independent Cartesian RK4 central-gravity integrator.

The interface tests execute the actual application code with minimal Node DOM/canvas stubs. They check event-handler state transitions and numerical readout wiring, including the unavailable-canvas fallback. They are not browser tests and make no claim about real event delivery, rendered layout, graphics, or performance.

The Vite check uses `configFile:false` and `build.write:false`; it emits artifacts only in memory. No development server or browser localhost check is used.

## Model

Distances are km, times seconds, and velocities km/s. Earth μ = 398,600.4418 km³/s²; radius = 6,378.137 km. The model uses exact two-body elliptic propagation via Kepler's equation and instantaneous tangential burns for a prograde, coplanar Hohmann transfer. Circular pre-departure and post-insertion states are analytic too.

The transfer is tangent to both circular orbits and lasts half its ellipse's period. The normal rehearsal then continues for one quarter of the arrival circular period. With insertion disabled it continues for a full transfer-ellipse period and returns to departure.

Atmospheric drag, oblateness, finite-thrust losses, inclinations, plane changes, perturbing bodies, navigation uncertainty, collision avoidance, and rendezvous timing are excluded. GEO is represented by the approximate 35,786 km circular altitude without a specified inclination or longitude. Hohmann is not globally minimum-Δv for every large radius ratio; a bi-elliptic maneuver is outside scope. Earth markings are an abstract diagram, not a geographic map. This is an educational workbench, not operational mission-planning software.

## Verification limit

Browser appearance, native browser interactions, accessibility-tree behavior, and performance remain unverified. No quality score, measured token usage, or cost has been inferred. See `worker-report.json` for measured numerical outcomes and reporting details.
