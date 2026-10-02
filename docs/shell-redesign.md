# Work-first shell redesign

## Decision

The homepage is one genuine, dated experiment post. Its centerpiece is the actual selected creation, with a compact selector whose 24 positions correspond to the model × effort × prompt conditions. The complete post keeps the exact prompts, provenance, and evaluation records underneath that same viewer. Homepage variant/filter URLs preserve browser history, and the original experiment deep links remain stable.

## What changed, and why

- **Actual work before atmosphere.** Removed the invented planetary illustration, aspirational hero, decorative stars, rotated note, future-idea cards, and manifesto. A genuine completed controlled creation is the default; the original baseline is explicitly separate. This responds to the repeated mismatch between attractive generic frames and their real subject.
- **One functional visual gesture.** The 24-cell selector is the prominent structural feature. Its positions represent actual experiment conditions. Dark cells are available, vermilion identifies the selected creation, and empty cells stay pending. It is not a chart of model quality.
- **Ordinary, readable writing.** Sentence case, materially larger reading sizes, cool white and dark ink, and plain descriptive copy replace tiny all-caps labels and manufactured diary voice. No cream/serif or black/neon theme substitution.
- **Evidence remains qualified.** Functional checks, provisional implementation scores, and rendered design ratings are separate. No score was created. WebGL availability is reported without asserting that frame load proves 3D works.
- **Sources are immutable.** The redesign touches only the shell. It embeds the bundled original creation without injecting scripts or modifying its design.

## Research informing the decision

These sources supplied qualitative direction, not a scientific benchmark of design quality:

- Community critique of generic AI UI: https://www.reddit.com/r/codex/comments/1v272nf/has_anyone_fixed_codexs_ui_taste/
- The missing layer of design taste in agents: https://ai.engineer/talks/7GMKdpLsxwU-missing-layer-design-taste-in-ai-agents
- Discussion of repetitive AI-generated design: https://news.ycombinator.com/item?id=48504912
- No-code users describing template sameness: https://www.reddit.com/r/nocode/comments/1txeeg2/how_do_you_stop_aibuilt_websites_from_looking/
- A specific, iterated personal-site counterexample: https://wilbertliu.com/blog/how-i-designed-my-personal-site-using-codex-cli
- Explicit warnings against the newer cream/serif/eyebrow template: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- Creator-run exploration of concept convergence: https://impeccable.style/research/ (qualitative and partly model-judged; no general performance claim inferred)

No third-party skill was installed. Framework-specific templates were not imported.

## Verification and limits

Unit checks cover routing/filter history, controlled-run default selection, pending-state exclusion, computed planned counts, scoring guards, and shell isolation invariants. The production build bundles the pre-existing creations unchanged. Responsive CSS includes small-screen layouts, 44px mobile comparison targets, safe areas, keyboard focus, and reduced motion. Expanded viewing restores the rest of the page on close, navigation, or restart.

Local cloud-browser navigation was blocked with `ERR_BLOCKED_BY_CLIENT`. No rendered desktop/mobile or 3D pass is claimed from unit tests and build success. A deployed shell review is still required. The cloud review browser is known not to render WebGL 2; that review can assess the shell and truthful fallbacks, not the underlying rendered 3D creations.
