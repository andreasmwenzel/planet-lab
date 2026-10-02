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

`dev` and `build` first bundle completed experiment sources into standalone HTML under `public/experiments/`. These generated files are ignored by Git and copied to `dist/` by Vite. Do not run the journal from a `file:` URL. No API key, backend, CDN, telemetry, account, or model request is needed.

## Routes

- `/#/`: journal home
- `/#/method`: methodology and rubric
- `/#/experiments/planetary`: first post and playground
- `/#/experiments/planetary?variant=luna-medium-minimal`: stable run deep link
- `/experiments/planetary/<variant-id>/index.html`: standalone built runtime

Hash routes work with ordinary static hosting without rewrite rules. Unknown routes have a recovery link. Model/effort/prompt filters persist in the URL, and browser Back/Forward restores them. The viewer keeps the currently running artifact while filters change if it remains selected; selecting another creation or restarting resets it.

## Adding an experiment run

See `experiments/README.md`. Each run adds its own source folder and `metadata.json`, so a run can ship in a separate pull request without editing the shell. The build only includes completed runs with metadata; the baseline is explicitly allowed. The manifest loader discovers those records at build time and orders Luna before Sol 6.1 before Astra.

The approved planetary matrix has 24 conditions: Luna medium/max, Sol 6.1 medium/xhigh, Astra medium/xhigh, each with minimal/detailed/bold/refined prompt approaches. Pending cells are not playable and do not represent completed output.

## Evidence and isolation

Functional check counts, provisional implementation reviews, and rendered editorial ratings are distinct. No score is invented for missing evidence. A code review is never presented as visual QA. The baseline passes seven pure simulation tests; these do not verify browser interactions. The deployed original showed its WebGL 2 fallback in the cloud browser, whose WebGL rendering was unavailable.

Each runtime is bundled as inline JS/CSS with local assets, uses an opaque-origin `sandbox="allow-scripts"` iframe, and carries a restrictive Content Security Policy blocking network calls. No `allow-same-origin`, forms, popups, downloads, top navigation, camera, microphone, geolocation, or payment permission is granted. A failed fetch has an explicit retry flow. WebGL support remains browser-dependent; individual artifacts must provide fallbacks.

## Project map

- `src/main.js`, `src/style.css`: responsive journal and reusable viewer
- `src/lab.js`: pure routing, filtering, output escaping, and score helpers
- `src/content/experiments.js`: posts, comparison plan, baseline provenance, rubric
- `src/content/generated-runs.js`: build-time discovery of completed run metadata
- `scripts/build-runtimes.mjs`: isolated inline runtime bundler
- `experiments/planetary/<variant-id>/`: sources and provenance for one creation
- `test/`: journal helper tests and preserved baseline simulation tests

## Publishing and verification

The repository stays private. Building writes local artifacts only. Hosting is managed separately through the authorized Vercel integration; no deployment or CI workflow is installed here. The lockfile is preserved.

`npm run check` runs the available unit tests and production build. Live browser QA of the shell should be performed on an authorized deployment; localhost browser access in the creation environment was blocked. Never label rendered 3D behavior verified based only on a build or iframe document load.
