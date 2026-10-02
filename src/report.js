import { availableRuns, experimentHref, escapeHtml as e, implementationScore } from './lab.js';

const criteria = [
  ['featureImplementation', 'F', 'Feature implementation'],
  ['stateCorrectness', 'S', 'State correctness'],
  ['resilience', 'R', 'Resilience'],
  ['accessibilityResponsive', 'A', 'Accessibility and responsive implementation'],
  ['maintainabilityResources', 'M', 'Maintainability and resource discipline'],
];

// A repository link is supplementary; all findings are readable on this page.
export const sourceBase = 'https://github.com/andreasmwenzel/planet-lab/blob/main';

export function sourceReference(item) {
  const label = `${item.file || 'Source'}${Number.isInteger(item.line) ? `:${item.line}` : ''}`;
  if (!sourceBase || !/^experiments\/[a-z0-9-]+\/[a-z0-9-]+\/[a-zA-Z0-9_.-]+$/.test(item.file || '')) return `<span class="source-reference">${e(label)}</span>`;
  const href = `${sourceBase}/${item.file}${Number.isInteger(item.line) && item.line > 0 ? `#L${item.line}` : ''}`;
  return `<a class="source-reference" href="${e(href)}" target="_blank" rel="noopener noreferrer">${e(label)}</a>`;
}

export function evidenceHtml(items) {
  return `<ul class="source-evidence">${items.map(item => `<li><p>${e(item.observation)}</p>${sourceReference(item)}</li>`).join('')}</ul>`;
}

export function reviewFindingsHtml(review) {
  if (!review) return '';
  return `<details class="review-findings"><summary>Findings and limits</summary><p>${e(review.summary)}</p>${review.bugs?.length ? `<h4>Source findings</h4>${evidenceHtml(review.bugs)}` : ''}${review.strengths?.length ? `<h4>Strengths</h4><ul>${review.strengths.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : ''}${review.unknowns?.length ? `<h4>Unverified</h4><ul>${review.unknowns.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : ''}${review.generationReport?.limitationsReported?.length ? `<h4>Generator-reported limits</h4><ul>${review.generationReport.limitationsReported.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : ''}</details>`;
}

export function comparisonHtml(exp, reviews, download) {
  if (!reviews) return '';
  const rows = availableRuns(exp).filter(run => run.kind === 'controlled' && implementationScore(reviews[run.id]?.implementation));
  if (!rows.length) return '';
  const totals = rows.map(run => implementationScore(reviews[run.id].implementation).earned);
  const summary = exp.id === 'planetary' ? `<p>The familiar Solar System concept repeats across the builds. The clearest source differences are keyboard camera access, fallback handling, reset consistency, and graphics cleanup. Code scores range from ${Math.min(...totals)} to ${Math.max(...totals)}/20.</p><p>“Minimal” changed a short treatment paragraph inside a substantial shared brief that already specified the scene, controls, library, and delivery constraints. This compared implementations of a constrained toy, with one sample per condition.</p>` : '';
  return `<section class="comparison-report" aria-labelledby="comparison-title"><h2 id="comparison-title">What the code review found</h2>${summary}<p class="report-caveat">Provisional source review, not a visual rating or a model benchmark. Rendered 3D and live interactions remain unverified.</p><div class="comparison-scroll" tabindex="0" role="region" aria-label="Implementation comparison"><table class="comparison-table"><caption>${rows.length} reviewed builds · 0–4 per criterion</caption><thead><tr><th scope="col">Build</th>${criteria.map(([, short, label]) => `<th scope="col"><abbr title="${e(label)}">${short}</abbr></th>`).join('')}<th scope="col">Code /20</th><th scope="col">Wall time (s)</th><th scope="col">Bundle (KiB)</th></tr></thead><tbody>${rows.map(run => {
    const review = reviews[run.id], scores = review.implementation.scores, score = implementationScore(review.implementation);
    return `<tr><th scope="row"><a href="${experimentHref(exp.id, run.id)}">${e(run.axes.model)} / ${e(run.axes.effort)} / ${e(run.axes.promptApproach)}</a></th>${criteria.map(([id]) => `<td>${scores.find(item => item.id === id)?.value ?? '—'}</td>`).join('')}<td><strong>${score.earned}</strong></td><td>${Number.isFinite(review.measurements?.observedWallSeconds) ? review.measurements.observedWallSeconds.toLocaleString('en-US') : '—'}</td><td>${Number.isFinite(review.measurements?.runtimeBytes) ? (review.measurements.runtimeBytes / 1024).toFixed(1) : '—'}</td></tr>`;
  }).join('')}</tbody></table></div><p class="criterion-key">F: features · S: state · R: resilience · A: accessibility · M: maintainability</p><p class="measurement-note">Wall time includes tools, bundling, and coordination; it is not model latency. Bundle size includes library code. Tokens and cost are unavailable.</p><details class="review-method"><summary>Review method</summary><p>Model and effort labels were hidden for the initial review, then restored for synthesis. The five criteria are equally weighted, subjective assessments. The review has no inter-rater validation; a one-point difference cannot establish a general model advantage.</p><p>All ${rows.length} builds passed syntax and isolated bundle checks. These checks do not establish functional completeness. The original Pocket Cosmos baseline is excluded. Each build’s record contains its evidence and known limits.</p></details>${download ? `<a class="text-link" href="${e(download)}" download="${e(exp.id)}-evaluations.json">Download the evaluation records</a>` : ''}</section>`;
}
