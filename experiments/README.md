# Independent experiment contract

Each controlled run owns one directory:

```
experiments/planetary/<variant-id>/
  index.html
  main.js
  style.css              (optional; import from main.js)
  metadata.json          (only once the run is complete and validated)
  prompt.md              (optional exact prompt record)
```

The HTML must include exactly `<script type="module" src="./main.js"></script>`. Import `three`, its bundled addons, and local CSS from the JavaScript entry. All runtime assets must bundle inline. No CDN, runtime fetch, API keys, network calls, parent-document access, account flow, analytics, or remote dependencies. A completely inline HTML-only runtime can omit main.js. Provide keyboard-accessible controls, responsive layout, reduced-motion support, and an honest WebGL failure message.

`npm run build:runtimes` uses Vite library-mode IIFE output, inlines CSS/assets, attaches restrictive CSP, and writes `public/experiments/planetary/<variant-id>/index.html`. Pending source folders without metadata are skipped. The baseline is explicitly included without metadata. Run source is never dynamically generated in the user's browser.

## Metadata

`src/content/generated-runs.js` discovers each `metadata.json` with Vite's static glob. One PR can add one directory. Use real provenance only:

```json
{
  "id": "luna-medium-minimal",
  "experimentId": "planetary",
  "title": "Luna · medium · minimal",
  "status": "available",
  "kind": "controlled",
  "runtime": "/experiments/planetary/luna-medium-minimal/index.html",
  "axes": { "model": "Luna", "effort": "medium", "promptApproach": "minimal" },
  "summary": "Description of the actual creation",
  "provenance": { "label": "Controlled generation", "note": "Facts about this run", "modelId": "gpt-6-luna", "effort": "medium" },
  "prompt": {
    "status": "complete",
    "messages": [{ "role": "user", "content": "The exact complete user-level generation prompt and public constraints" }],
    "note": "How this prompt was used"
  },
  "evaluation": {
    "status": "unscored",
    "functional": { "status": "not-verified", "passed": null, "total": null, "scope": "Browser acceptance checks", "note": "Not yet tested" },
    "editorial": null,
    "browser": { "status": "not-verified", "note": "Not yet tested" },
    "measurements": [],
    "notes": []
  }
}
```

Models: `Luna`, `Sol 6.1`, `Astra`. Efforts: Luna `medium`/`max`; others `medium`/`xhigh`. Approaches: `minimal`, `detailed`, `bold`, `refined`. IDs use `luna-`, `sol-`, or `astra-` plus effort and approach.

An optional `evaluation.implementation` object may record a **provisional code-review score**, with `reviewer`, `evaluatedAt`, `method`, and `scores: [{id, label, value, evidence}]`. Values are 0–4. Criteria must assess implementation, not unobserved visuals. It is distinct from editorial design scoring.

Only actual rendered review may set `evaluation.status` to `scored` and populate `editorial: {reviewer, evaluatedAt, scores: [{id, value, evidence}]}`. Editorial criterion IDs are `craft`, `interaction`, `delight`, `clarity`, `inclusion`, each 0–4. Functional results name their exact test scope and counts; build success alone is not a functional acceptance pass. Measurements accept `{label, value, unit}`. Mark unavailable token counts as unavailable, not zero.
