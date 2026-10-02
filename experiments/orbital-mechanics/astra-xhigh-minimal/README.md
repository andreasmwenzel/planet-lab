# Apogee

A local orbital flight workbench. Entry: `index.html`.

## Rerun verification

```sh
cd /workspace/scratch/bb2a48021f5a/planet-lab/experiments/orbital-mechanics/astra-xhigh-minimal && node --check main.js && node --check physics.js && node --check test-physics.mjs && node --check verify-build.mjs && node test-physics.mjs --json && node verify-build.mjs
```

The numerical tests import the actual `physics.js` implementation. The Vite verification uses `configFile: false` and `build.write: false` and creates no build directory. Detailed results, tolerances, repairs, assumptions, and unverified aspects are recorded in `worker-report.json` and `numerical-results.json`.

No browser checks were performed. The final viewer, visual appearance, interactions, and performance need a separate browser review.
