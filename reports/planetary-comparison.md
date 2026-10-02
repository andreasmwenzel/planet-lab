# Planetary implementation comparison

## Main finding

The 24 generated samples share a familiar Solar System concept, but their implementation quality is not identical. The clearest differences in source are error handling, keyboard camera access, motion preferences, reset consistency, and graphics lifecycle management. Several attractive-sounding descriptions mask concrete state or fallback defects.

The scores below are **provisional code-review scores out of 20**, not visual design ratings or observed interaction pass rates. All 24 passed JavaScript syntax and isolated Vite bundle checks. The available cloud browser did not provide usable WebGL2, so rendered 3D, shader compilation, live interactions, touch behavior, contrast, and device performance remain unverified. Unknown runtime behavior has not been scored as a failure.

## What was compared

- 24 independent generated samples: Luna at medium/max, Sol 6.1 at medium/xhigh, and Astra at medium/xhigh, each under minimal, detailed, bold, and refined treatments
- One sample per condition; the earlier baseline is excluded
- The same Three.js 0.186.1 and Vite 7.3.6 scaffold, common feature contract, packaging requirements, and syntax/bundle repair allowance
- A frozen public prompt, implementation, generation report, source hashes, and measured artifact record for every sample
- 24 distinct main.js hashes; all reviewed source files still match their recorded hashes

Initial source review used randomized identifiers with model and effort labels hidden. Identifiers were restored for synthesis and checking generation reports; the synthesis was not blind. These are subjective, equally weighted ordinal assessments, without inter-rater reliability validation. A one-point gap is not evidence of a general model advantage. The samples are listed in recorded dispatch order rather than as a leaderboard.

## Rubric

Each criterion uses 0 absent, 1 weak, 2 adequate, 3 strong, and 4 exceptional. A 3 means a strong implementation with remaining gaps; a 4 is reserved for unusually complete source-level coverage. Code length, model name, decorative ambition, and generated descriptions do not earn points.

| Code | Criterion | Source evidence assessed |
| --- | --- | --- |
| F | Feature implementation | Required scene, orbit/zoom, pause, speed, reset, and labelled selection are actually wired |
| S | State and interaction correctness | State transitions, reset, pause/speed consistency, selection indices, camera tracking, and input handling |
| R | Resilience | WebGL failure/context loss, resize, hidden-page and frame-delta safeguards |
| A | Accessibility and responsive implementation | Semantic controls and labels, keyboard paths, visible focus, responsive rules, and reduced-motion handling |
| M | Maintainability and resource discipline | Understandable state flow, bounded work, reuse, avoidable per-frame work, and graphics lifecycle handling |

Missing cleanup is recorded as a lifecycle gap, not a demonstrated memory leak. Bounded resources in an iframe that is later removed differ from an app repeatedly allocating live scenes. Responsive CSS is evidence of implementation intent, not proof that a phone layout works.

## Scores and measurements

Build checks are 2/2 for every sample: JavaScript syntax and isolated Vite bundling only. Browser acceptance results and editorial visual scores are unscored. The JSON companion contains exact file-and-line evidence for every component, concrete findings, and unknowns: [full evaluation records](planetary-evaluations.json).

| Sample | F | S | R | A | M | Total /20 | Wall seconds | Bundle bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| luna-medium-minimal | 2 | 1 | 1 | 1 | 2 | 7 | 292 | 552,455 |
| luna-medium-detailed | 3 | 2 | 2 | 2 | 2 | 11 | 274 | 573,967 |
| luna-medium-bold | 3 | 2 | 1 | 2 | 2 | 10 | 294 | 572,394 |
| luna-medium-refined | 2 | 1 | 2 | 2 | 2 | 9 | 241 | 544,063 |
| luna-max-minimal | 3 | 2 | 2 | 2 | 3 | 12 | 571 | 580,028 |
| luna-max-detailed | 3 | 2 | 2 | 2 | 3 | 12 | 742 | 593,554 |
| luna-max-bold | 3 | 2 | 2 | 2 | 2 | 11 | 562 | 566,865 |
| luna-max-refined | 3 | 2 | 3 | 2 | 2 | 12 | 677 | 581,572 |
| sol-medium-minimal | 3 | 2 | 2 | 2 | 2 | 11 | 355 | 574,885 |
| sol-medium-detailed | 3 | 3 | 2 | 2 | 2 | 12 | 353 | 576,738 |
| sol-medium-bold | 3 | 3 | 3 | 2 | 2 | 13 | 365 | 569,015 |
| sol-medium-refined | 3 | 2 | 2 | 3 | 2 | 12 | 441 | 575,996 |
| sol-xhigh-minimal | 3 | 3 | 3 | 3 | 2 | 14 | 1082 | 601,383 |
| sol-xhigh-detailed | 3 | 3 | 2 | 4 | 3 | 15 | 889 | 598,400 |
| sol-xhigh-bold | 3 | 3 | 3 | 4 | 3 | 16 | 875 | 604,794 |
| sol-xhigh-refined | 3 | 3 | 3 | 3 | 3 | 15 | 936 | 599,949 |
| astra-medium-minimal | 3 | 2 | 3 | 3 | 2 | 13 | 368 | 573,769 |
| astra-medium-detailed | 3 | 2 | 2 | 2 | 2 | 11 | 398 | 578,802 |
| astra-medium-bold | 3 | 3 | 3 | 3 | 2 | 14 | 413 | 570,361 |
| astra-medium-refined | 3 | 3 | 3 | 3 | 3 | 15 | 481 | 580,647 |
| astra-xhigh-minimal | 3 | 3 | 3 | 4 | 3 | 16 | 740 | 593,537 |
| astra-xhigh-detailed | 3 | 3 | 3 | 4 | 3 | 16 | 808 | 595,847 |
| astra-xhigh-bold | 3 | 3 | 3 | 4 | 3 | 16 | 741 | 593,926 |
| astra-xhigh-refined | 3 | 3 | 3 | 3 | 2 | 14 | 736 | 595,834 |

Scores span **7–16/20**. Four samples share the highest source-score tier: Sol xhigh/bold, Astra xhigh/minimal, Astra xhigh/detailed, and Astra xhigh/bold. Their keyboard paths, timing/fallback handling, or resource organization support those scores; none is established as the best-looking or best-performing result.

Observed completion times range from **241 to 1,082 seconds** (4:01 to 18:02; median 521.5 seconds). These include tools, build work, and coordination, so they are not model-latency measurements. Runtime bundles range from **544,063 to 604,794 bytes** (531.3–590.6 KiB; median 579,415 bytes). Bundle size includes library code and is not generated-source length. Token usage and cost are unavailable and remain null, not estimates.

## Differences that matter

The most useful distinctions are in implementation behavior, rather than the generated titles:

- **Keyboard exploration:** Astra xhigh/minimal provides HTML orbit, tilt, and zoom buttons, and initializes without motion when requested by the device. Astra xhigh/bold and xhigh/detailed also implement focused-canvas camera keys. Compare those explicit paths with Luna medium/minimal, where zoom is a wheel handler and planet browsing stops after focus moves onto a button. Sources: [Astra minimal camera controls](../experiments/planetary/astra-xhigh-minimal/main.js#L207), [Astra bold keyboard handling](../experiments/planetary/astra-xhigh-bold/main.js#L388), [Luna minimal input](../experiments/planetary/luna-medium-minimal/main.js#L69).
- **Reset consistency:** Some runs derive position and rotation from one simulation clock; others reset orbital time but leave accumulated axial rotation intact. Sol xhigh/refined resets the clock, reapplies positions, restores speed and selection, and preserves fallback status. Luna medium/refined resets elapsed time but axial rotation is updated separately. Sources: [Sol reset](../experiments/planetary/sol-xhigh-refined/main.js#L495), [Luna spin](../experiments/planetary/luna-medium-refined/main.js#L93).
- **Resource lifecycle:** Sol xhigh/bold explicitly stops animation, disconnects its resize observer, disposes controls/renderer, and disposes tracked geometry, materials, and textures on pagehide. Many samples only create a bounded scene and rely on document lifetime. This is a concrete implementation difference; it does not establish measured memory use or a leak elsewhere. Source: [Sol lifecycle cleanup](../experiments/planetary/sol-xhigh-bold/main.js#L474).

## Concrete failure risks

These are source findings, not claims of observed rendered behavior:

| Sample | Finding | Evidence |
| --- | --- | --- |
| Luna medium/minimal | Renderer failure returns before selector construction and control wiring; axial spin continues while paused | [main.js:41](../experiments/planetary/luna-medium-minimal/main.js#L41), [57–73](../experiments/planetary/luna-medium-minimal/main.js#L57) |
| Luna medium/refined | The selected-button index is shifted by one because navigation excludes the Sun but compares against body indices | [main.js:31–39](../experiments/planetary/luna-medium-refined/main.js#L31) |
| Luna medium/refined | Child geometry is scaled twice: Saturn's ring outer radius becomes 0.2508 inside its radius-0.33 sphere; Earth's moon is also wholly inside Earth | [main.js:63–77](../experiments/planetary/luna-medium-refined/main.js#L63) |
| Luna medium/bold | Author CSS sets the hidden fallback to display:flex with no hidden override, predicting an error overlay even if 3D starts; zero-speed formatting removes the number | [style.css:1](../experiments/planetary/luna-medium-bold/style.css#L1), [main.js:180](../experiments/planetary/luna-medium-bold/main.js#L180) |
| Luna max/minimal | Phone-width CSS hides the explanation for unavailable WebGL; axial spin ignores the selected simulation speed | [style.css:243](../experiments/planetary/luna-max-minimal/style.css#L243), [main.js:495](../experiments/planetary/luna-max-minimal/main.js#L495) |
| Sol medium/refined | After renderer construction fails, Reset can dereference controls that were never created | [main.js:26](../experiments/planetary/sol-medium-refined/main.js#L26), [37–39](../experiments/planetary/sol-medium-refined/main.js#L37) |
| Sol medium/detailed | Context-loss fallback does not stop or guard the animation/render loop | [main.js:69–70](../experiments/planetary/sol-medium-detailed/main.js#L69) |

The repeated risks are partial reset, fallback controls that still claim to run a simulation, continued work after context loss, and mouse-oriented camera access. A successful bundle check cannot catch these. The evaluation JSON lists additional findings per run; the original samples were not repaired during review.

## Why the outputs converged

The shared brief fixes the library, scene genre, feature list, selection-and-information pattern, responsive and accessibility requirements, fallback, and packaging. The nominally minimal condition is still **362 words and 2,525 UTF-8 bytes**; only its short treatment paragraph is minimal. It is a controlled implementation task over a substantial common brief, not an unconstrained invention task. The other full prompts are 2,788–2,927 bytes. Sources: [minimal prompt](../experiments/planetary/luna-medium-minimal/prompt.txt), [detailed prompt](../experiments/planetary/luna-medium-detailed/prompt.txt), [bold prompt](../experiments/planetary/luna-medium-bold/prompt.txt), [refined prompt](../experiments/planetary/luna-medium-refined/prompt.txt).

Every implementation chose the recognizable Solar System motif, even though the common brief did not require it. Twenty-three include all eight planets; Luna medium/bold includes the Sun and six planets. No completeness penalty was applied for that choice. Naming, palette declarations, typography, textures, and panel arrangements differ, but those source differences do not establish how different the rendered experiences feel. Their quality cannot be inferred from names such as “Arcade,” “Atlas,” or “Observatory.”

The common contract and familiar Three.js planetary-demo genre plausibly contribute to convergence. This run cannot establish the cause or isolate model effects: there is one sample per condition, generation was ordered rather than randomized, effort settings differ across model families, and the prompt treatments mix specificity with aesthetic direction. More extensive code in higher-effort samples is not itself evidence of better design or creativity.

## What to test next

1. **Execution quality:** Keep a chosen product concept and acceptance checks fixed. Use repeated fresh samples per condition, randomized dispatch, and the same GPU-enabled browser/device checks. Test selection, pause/speed/reset, keyboard camera access, narrow/short viewports, reduced motion, renderer failure, and context loss. Score live behavior separately from source quality and rendered design.
2. **Open invention:** Start with a short outcome or theme, without the Solar System demo's feature contract or predefined panel pattern. Ask for distinct concepts before implementation, select anonymously, then apply comparable delivery constraints. Keep this separate from the execution experiment so originality and implementation reliability are not conflated.

Do not interpret the current wall times as model latency or invent token/cost estimates. Those measurements would need provider-supplied counters and a timing method that separates inference from tool and build time.
