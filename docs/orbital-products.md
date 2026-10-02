# One brief, twenty-four orbital products

What changes when a model is asked to make a useful product rather than reproduce a specified interface? This experiment gave three model families the same orbital-mechanics brief and let them choose the purpose, workflow, architecture, interactions, and visual direction.

The matrix contains 24 conditions: Luna at medium and max effort, Sol 6.1 at medium and xhigh, and Astra at medium and xhigh. Each configuration received one of four frozen creative directions: minimal, detailed, bold, or refined. The runtime packaging and numerical-testing scaffold stayed the same. Each condition has one independent sample; this is an exploration of product choices, not a general model leaderboard.

## What the prompts changed

The clearest source-level difference is in the bold conditions. These products change the user's job, not just the interface's name: orbital triage, conjunction avoidance, salvage rendezvous, spacecraft retirement, cargo dispatch, and a one-burn rescue. Their central decisions differ too: clearance, miss distance, matched velocity, a timed atmospheric-interface crossing, delivery to a moving depot, or rescue feasibility.

Most minimal, detailed, and refined conditions converged on orbit editors or Earth-centered maneuver workbenches. That convergence is itself informative. Their workflows range from inspecting a Kepler ellipse to rehearsing a complete two-impulse Hohmann transfer, with differing approaches to preview, time controls, recovery, and telemetry. The notable minimal-direction exception is Luna max's Earth-to-Moon transfer planner, which also brings a different physical approximation and should not be treated as an interchangeable Earth-orbit solver.

These are provisional observations from the preserved implementations, reports, and test evidence. They are not visual ratings. A completed bundle and passing mechanics tests do not establish that an interface feels good to use.

## Read the products by purpose

- Orbit and profile exploration: Luna medium minimal, detailed, and refined; Luna max refined.
- Lunar transfer planning: Luna max minimal.
- Maneuver and transfer workbenches: Luna max detailed; Sol medium minimal, detailed, and refined; Sol xhigh minimal, detailed, and refined; Astra medium minimal, detailed, and refined; Astra xhigh minimal, detailed, and refined.
- Task-specific orbital operations: all six bold conditions, listed individually in the inventory.

These groups describe the visible product purpose in source, not a ranking or a guarantee of complete interaction coverage. Try the different jobs before comparing polish: a conjunction desk and a transfer planner are solving different problems.

## What was verified

Each run preserves its exact creative prompt, shared scaffold, reporting amendment, source files, quantitative test script, worker report, and independently rerun numerical results. JavaScript syntax and isolated bundling were checked before producing a self-contained sandbox runtime. Source hashes make later changes detectable. Numerical suites exercise each product's actual mechanics functions; cases vary by product and include orbit closure, conservation, impulse behavior, transfers, surface crossings, and comparisons with independent numerical integration.

A concrete example: Sol medium bold’s preserved 18-check suite reports a one-revolution position error of 1.037 × 10⁻⁶ km against a 10⁻⁴ km tolerance, and ten-revolution relative specific-energy drift of 1.020 × 10⁻¹¹ against 10⁻⁸. Its phase-matched Hohmann rendezvous finishes with a separation of 2.754 × 10⁻⁷ km against a 0.001 km tolerance. These values describe the implemented idealized model and its test cases, not real spacecraft accuracy. Luna medium minimal separately checks the Kepler equation, circular and elliptical invariants, period closure, and invalid inputs; its five grouped tests are not less coverage simply because another suite reports 18 checks. Expand an inventory row to inspect the exact rerun command and output.

Do not compare raw assertion counts as quality scores. A dense parameter sweep can produce many assertions from one invariant, while another suite groups the same work differently. Passing a run's chosen tolerances does not certify unrestricted physical accuracy. Headless control or source-structure checks, where present, are additional evidence rather than substitutes for browser testing.

Rendered appearance, native browser interactions, accessibility in practice, and performance remain unverified for this batch. The individual run records retain their precise verification scope.

## Important comparison limits

- One sample per condition does not separate stable model tendencies from sampling variation. Effort labels are provider settings, not equal-compute budgets across models.
- The products chose different purposes and physics scopes. Most assume idealized planar two-body motion and instantaneous burns; specific approximations and exclusions are stated in each report. None is an operational flight-planning tool.
- Sol medium bold and refined were interrupted by routine maintenance and resumed using their own partial work, with the same configured model and effort. Sol xhigh minimal was interrupted before implementation files survived and restarted from the original prompt. Their provenance discloses this continuity difference.
- Observed wall-clock duration includes tools and coordination. Interrupted conditions also include downtime and restart gaps. It is not model latency or a fair speed benchmark.
- Measured token and cost counters were unavailable. They remain null. No estimates were invented from file size, context limits, or elapsed time.
- Independent source hashes establish distinct saved artifacts, not statistical independence or absence of common conventions. Similar names and patterns can emerge without a worker seeing another run.

The useful result is a set of runnable product hypotheses with traceable mechanics, not a single winner. The next evaluation should use task-based browser trials: can a person understand the chosen job, finish it, recover from a mistake, and see where the model stops being realistic?
