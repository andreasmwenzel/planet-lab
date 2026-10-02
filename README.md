# Planet Lab

An AI field journal: ideas become posts, and each post keeps its playable creations, generation prompts, provenance, and evaluation evidence together.

The first experiment is a planetary playground. The original **Pocket Cosmos** remains a separate, assistant-curated baseline, with its original simulation source preserved under `experiments/planetary/baseline/`. Its model and effort were not recorded. The user request is quoted exactly; a complete generation prompt is unavailable. It is not represented as a controlled run.

## Run locally

Node **22.12+** is required (Node 24 recommended).

```
npm ci
npm run dev
npm test
npm run build
npm run preview
npm run check
```

`dev` and `build` first bundle completed experiment sources into standalone HTML under `public/experiments/`. These generated files are ignored by Git and copied to `dist/` by Vite. Do not run the journal from a `file:` URL. No API key, backend, CDN, account, or model request is needed to run locally. Analytics is disabled in development and on localhost previews.

## Web Analytics

The deployed journal shell uses [Vercel Web Analytics](https://vercel.com/docs/analytics/quickstart) via the official `@vercel/analytics` package. Enable Web Analytics for the Vercel project and deploy to provide its script and collection endpoints.

Hash routes are recorded as `/`, `/about`, `/experiments/planetary`, `/experiments/orbital-mechanics`, or `/not-found`. Page URLs exclude query strings and fragments; switching builds or filters within a post does not create another page view. Unknown paths are grouped under `/not-found` rather than forwarded verbatim. Add new published posts to the explicit allowlist in `src/analytics.js`.

No custom events, simulator interactions, or session replay are added. Vercel receives its standard page-view and request metadata; see its [privacy documentation](https://vercel.com/docs/analytics/privacy-policy). Analytics runs only in the journal shell. The preserved experiment sources and standalone runtime artifacts remain uninstrumented, with their existing network-blocking CSP and sandbox unchanged.

After deployment, visit the index and a post, confirm the Vercel analytics script and page-view requests succeed in browser developer tools, and check the project's Analytics dashboard. Local tests verify routing and collection setup but do not prove the dashboard has received a production visit.

## Routes

- `/#/`: journal home
- `/#/about`: brief “What this is” introduction (`/#/method` remains an alias)
- `/#/experiments/planetary`: first post and playground
- `/#/experiments/planetary?variant=luna-medium-minimal`: stable run deep link
- `/#/experiments/orbital-mechanics`: second experiment
- `/#/experiments/planetary?variant=luna-medium-minimal&view=charts&metric=time`: charts for the selected build
- Chart metrics are `time`, `implementation`, and `api`
- `/#/results/<experiment-id>/<variant-id>`: shareable standalone result, opened with “Open result in new tab” from either post view
- `/experiments/planetary/<variant-id>/index.html`: generated runtime asset (the result route wraps it in the isolated viewer)

Standalone result routes display only the exact available build requested, with Restart and Back to experiment controls. They reuse the same opaque-origin sandbox and CSP validation; no raw runtime is opened as a top-level page. Unknown or pending results show a recovery link.

Hash routes work with ordinary static hosting without rewrite rules. Unknown routes have a recovery link. Model/effort/prompt filters persist in the URL, and browser Back/Forward restores them. The viewer keeps the currently running artifact while filters change if it remains selected; selecting another creation or restarting resets it. Charts and Simulator share the selected build and filters. View and chart metric persist in the URL; Charts removes the iframe so no hidden simulation keeps running.

## Adding an experiment run

See `experiments/README.md`. Each run adds its own source folder and `metadata.json`, so a run can ship in a separate pull request without editing the shell. The build only includes completed runs with metadata; the baseline is explicitly allowed. The manifest loader discovers those records at build time and orders Luna before Sol 6.1 before Astra.

Each approved experiment matrix has 24 conditions: Luna medium/max, Sol 6.1 medium/xhigh, Astra medium/xhigh, each with minimal/detailed/bold/refined prompt approaches. Pending cells are not playable and do not represent completed output.

## Reports and charts

`reports/planetary-evaluations.json` contains the independent provisional code review. `src/content/evaluations.js` overlays it by experiment and run ID without modifying frozen generation metadata. The first post shows the 24-row source comparison, criterion evidence, private-repository line links, and readable inline findings. The full written analysis remains in `reports/planetary-comparison.md`. Second-experiment code reviews remain pending.

Time charts use recorded task wall time, including tools, bundling, and coordination; they are not model-latency charts. Actual run costs and token usage remain unavailable. The separate API price reference uses official Standard base rates checked 2 October 2026, in USD per million tokens, with source links. It is not an estimate of recorded run costs; longer contexts and Fast pricing differ.

## Evidence and isolation

Functional check counts, provisional implementation reviews, and rendered editorial ratings are distinct. No score is invented for missing evidence. A code review is never presented as visual QA. The baseline passes seven pure simulation tests; these do not verify browser interactions. The deployed original showed its WebGL 2 fallback in the cloud browser, whose WebGL rendering was unavailable.

Each runtime is bundled as inline JS/CSS with local assets, uses an opaque-origin `sandbox="allow-scripts"` iframe, and carries a restrictive Content Security Policy blocking network calls. No `allow-same-origin`, forms, popups, downloads, top navigation, camera, microphone, geolocation, or payment permission is granted. A failed fetch has an explicit retry flow. WebGL support remains browser-dependent; individual artifacts must provide fallbacks.

## Project map

- `src/main.js`, `src/style.css`: responsive journal and reusable viewer
- `src/lab.js`: pure routing, filtering, output escaping, and score helpers
- `src/content/experiments.js`: posts, comparison plan, baseline provenance, rubric
- `src/content/generated-runs.js`: build-time discovery of completed run metadata across experiments
- `src/charts.js`, `src/report.js`: accessible chart comparisons and source-review presentation
- `src/content/evaluations.js`: separate review overlay, keyed by experiment
- `scripts/build-runtimes.mjs`, `scripts/runtime-assets.mjs`: isolated inline runtime bundler and local CSS inlining
- `experiments/<experiment-id>/<variant-id>/`: sources and provenance for one creation
- `test/`: journal helper tests and preserved baseline simulation tests

## Publishing and verification

The repository stays private. Building writes local artifacts only. Hosting is managed separately through the authorized Vercel integration; no deployment or CI workflow is installed here. The lockfile is preserved.

`npm run check` runs the available unit tests and production build. Live browser QA of the shell should be performed on an authorized deployment; localhost browser access in the creation environment was blocked. Never label rendered 3D behavior verified based only on a build or iframe document load.

## Additional orbital game

`/#/results/orbital-mechanics/astra-ultra-game` opens **Kepler Dispatch**, the independently generated Astra Ultra game. It also appears under **Additional builds** in the orbital experiment. This optional extension is outside the standard 24 conditions and their comparison charts. Its runtime source is preserved; the exact game brief, source hashes, numerical tests, mocked interaction tests, build validator, and original worker report are retained in `experiments/orbital-mechanics/astra-ultra-game/`. Token usage and cost are unavailable. See that directory's README for reproducible tests and model limitations.
