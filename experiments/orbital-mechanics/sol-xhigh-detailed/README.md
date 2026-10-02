# Orbit Workshop · Transfer Lab

A finished, local-only orbital mechanics learning tool. Design a circular-to-circular Earth transfer, fly two Hohmann impulses, and inspect what gravity does between them.

## Use

The entry point is `index.html` with its exact local `main.js` module entry. The experiment harness can bundle the JavaScript and CSS into its single-document iframe. This app requires no accounts, network assets, persistence, backend, or frame communication.

1. Start with Training ascent, Station return, or High-orbit transfer. Custom parking and target altitudes accept 150–50,000 km, separated by at least 50 km.
2. Apply burn 1. Watch the coast at your selected rate, or jump to burn 2. The flight pauses at the planned arrival time.
3. Apply burn 2 to complete the transfer. Success requires both apsides within 1 km of the destination and eccentricity below 0.0002.
4. Explore further with manual along-velocity, against-velocity, radially outward, or radially inward impulses. The proposed orbit is previewed before applying a manual burn.
5. Undo restores the complete state before the last burn, coast jump, reset, or mission change. Up to twelve actions are retained. Reset starts the current mission again.
6. Flight report opens a local, selectable text snapshot. It does not require clipboard permission, file downloads, or browser storage.

Space plays/pauses, B performs the next guided action, and U undoes. Keyboard shortcuts are suspended while editing a field, focusing a button, or viewing a dialog. Zoom controls, a fit control, and optional schematic velocity/gravity vectors are available. The simulation pauses when the page is hidden or help/report is opened.

## Implementation

- `physics.mjs`: actual two-body mechanics, RK4 integration, orbital elements, impulses, Hohmann planning, and finite conic samples
- `session.mjs`: mission state, burn guards, scheduled arrival, manual-plan cancellation, and target assessment
- `main.js`: accessible DOM controls, state snapshots, Canvas illustration, readable telemetry, and local reports
- `style.css`: responsive system-font presentation with no remote resources
- `test-physics.mjs`: independently runnable tests importing the real physics and session modules
- `verify-build.mjs`: isolated Vite build with `configFile:false`, `write:false`, and module-preload networking disabled

## Exact verification command

Run from this directory, using the scaffold's Node and Vite installation:

```sh
node --check main.js && node --check physics.mjs && node --check session.mjs && node --check test-physics.mjs && node --check verify-build.mjs && node test-physics.mjs && node verify-build.mjs && node audit-source.mjs
```

Full command with the run directory:

```sh
cd /workspace/scratch/bb2a48021f5a/planet-lab/experiments/orbital-mechanics/sol-xhigh-detailed && node --check main.js && node --check physics.mjs && node --check session.mjs && node --check test-physics.mjs && node --check verify-build.mjs && node test-physics.mjs && node verify-build.mjs && node audit-source.mjs
```

The scripts regenerate `test-results.json` and `build-results.json` inside this directory only. Vite emits no build files. No browser localhost checks were attempted or claimed.

## Model

Positions are km, velocities km/s, and time seconds. Earth is a fixed sphere of radius 6,371 km, with μ = 398,600.4418 km³/s². The spacecraft is a massless planar test particle under Newtonian central gravity. Impulses are instantaneous, and the Δv budget is not a fuel-mass estimate.

Integration uses fourth-order Runge–Kutta with maximum steps of 8 seconds, 0.0015 local dynamical times, and 0.0015 radius-crossing times at the current speed. Changing playback rate does not loosen these limits. Surface contacts are bracketed and refined by bisection; in-step radial minima are also checked to resolve shallow grazing impacts. Numerical integration and event detection retain finite floating-point precision.

No atmosphere, drag, oblateness, Earth rotation, Moon, Sun, relativity, inclination changes, finite thrust, propellant model, or live orbit data. The 35,786 km preset is a high-altitude transfer, not a simulation of geostationary longitude. The teal path is the instantaneous osculating conic; the white trail is sampled from actual propagated states. Open conic drawings are necessarily truncated. Planet geometry is to scale; spacecraft and vectors are enlarged schematic markers. This is a learning tool, not operational navigation software.

## Verification boundary

Numerical tests, JavaScript syntax checks, isolated Vite bundling, and static resource guards pass. Actual browser appearance, interaction behavior, accessibility, sandbox execution, and browser/device performance remain unverified pending separate review.
