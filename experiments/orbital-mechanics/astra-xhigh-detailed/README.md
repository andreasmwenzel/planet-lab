# Apogee — Orbital flight lab

A self-contained, in-browser orbital workbench. The default flight begins in a 400 km circular Earth orbit with a prepared 1,200 km Hohmann transfer. Execute departure, watch or skip the coast, and execute arrival. The flight automatically pauses and locks at the arrival point until the burn is executed or the plan is canceled.

Free-burn mode supports local transverse and radial impulses, a circularization helper, geometric previews, and recoverable burn history. Alternate starts include a geotransfer ellipse, a high ellipse, escape, and a custom ellipse. Surface encounters stop the simulation; Undo rewinds to before the latest burn.

## Files

- `index.html`, `main.js`, `style.css`: product UI and Canvas renderer
- `physics.mjs`: pure, exported numerical mechanics used by the UI and tests
- `numerical-tests.mjs`: numerical checks against analytic cases, invariants, and an independent RK4 oracle
- `workflow-tests.mjs`: actual controller logic tested with Node-only DOM doubles; this is not browser verification
- `static-tests.mjs`: packaging and restricted-runtime checks
- `build-check.mjs`: isolated Vite build with `configFile: false`, `envFile: false`, and `write: false`
- `worker-report.json`: timestamps, verification, numerical model, repairs, and unresolved review limits

## Reproduce verification

From this run directory:

    node --check main.js && node --check physics.mjs && node --check numerical-tests.mjs && node --check workflow-tests.mjs && node --check static-tests.mjs && node --check build-check.mjs && node numerical-tests.mjs && node workflow-tests.mjs && node static-tests.mjs && node build-check.mjs

Only Vite, supplied by the execution environment, is needed for the build. No new packages are required. Verification writes JSON results in this directory. The Vite build's emitted artifacts stay in memory. The common evaluation harness can inline the HTML, JavaScript, and CSS.

## Numerical model

Planar Newtonian two-body mechanics with a fixed spherical Earth. Units: km, km/s, seconds. Earth radius: 6,371 km. Gravitational parameter: 398,600.4418 km³/s². Universal-variable Kepler propagation uses a bracketed Newton solve; a surface event is located independently of the time warp, then refined against the propagator. Burns are instantaneous; no propellant or mass model is implied by the Δv budget.

No atmosphere, oblateness, rotation, third bodies, inclination, or finite thrust. Hohmann transfers connect coplanar circular orbits; they are not guaranteed to be globally minimum-Δv for every radius ratio. Custom initial altitudes and target altitudes are limited to 120–100,000 km. Each free-burn component is limited to ±12,000 m/s. Nearly radial trajectories with less than 0.1% of local circular transverse speed are rejected. A flight is bounded to 30 simulated days. Up to 20 burns can be undone, and the latest 80 flight-log entries are retained for this tab only.

## Review limits

No browser localhost access was used. Actual browser appearance, input behavior, responsive layout, Canvas performance, assistive-technology behavior, and common-harness rendering remain unverified. The Node DOM-double test is explicitly not a substitute for browser review. No network services, remote assets, fonts, persistent storage, account access, or cross-frame communication are used.
