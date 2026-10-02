import './style.css';
import { experiments, rubric, comparisonPlan } from './content/experiments.js';
import { availableRuns, filterRuns, axisOptions, parseRoute, experimentHref, selectRun, plannedRunCount, safeRuntimePath, escapeHtml as e, editorialScore } from './lab.js';

const main = document.querySelector('main');
const axisLabels = { model: 'Model', effort: 'Reasoning effort', promptApproach: 'Prompt approach' };
let controller, currentRoute, currentExperiment, loadedRuntime, renderCount = 0;
const total = plannedRunCount(comparisonPlan);
const hrefFor = (exp, variant, filters = {}) => experimentHref(exp.id, variant, filters);

function journalIndex() {
 return `<section class="journal-index"><header class="index-intro"><h1>Experiments</h1></header><div class="post-list" aria-label="Experiment posts">${experiments.map(exp => { const count = availableRuns(exp).filter(run => run.kind === 'controlled').length; return `<article class="post-list-item"><div class="post-date"><time datetime="2026-10-02">2 October 2026</time><span>Interactive 3D</span></div><h2><a href="${experimentHref(exp.id)}">One planetary toy, 24 different builds</a></h2><p>Luna, Sol 6.1, and Astra build a planetary system with two reasoning settings and four prompt approaches.</p><div class="post-list-bottom"><span>${count} of ${total} runs published</span><a href="${experimentHref(exp.id)}">Read the experiment <span aria-hidden="true">→</span></a></div></article>`; }).join('')}</div></section>`;
}

function post(exp) {
 const controlled = availableRuns(exp).filter(run => run.kind === 'controlled').length;
 return `<article class="planetary-post full-post">
 <header class="post-header"><div class="post-intro"><div class="post-meta"><span>Experiment 01</span><span>Interactive 3D</span><time datetime="2026-10-02">2 October 2026</time></div><h1>One planetary toy.<br><span>${total} different builds.</span></h1></div><div class="post-deck"><p>A playable planetary system, built by Luna, Sol 6.1, and Astra using two reasoning settings and four prompt approaches.</p><p class="progress-copy"><strong>${controlled} of ${total} builds available</strong></p></div></header>
 <section class="observation-desk" aria-label="Planetary experiment"><div class="artifact-column"><div id="viewer-container"></div></div><aside class="selector-column" aria-label="Compare creations"><div id="picker"></div></aside></section>
 <section class="run-record" aria-labelledby="record-title"><div class="record-section-heading"><h2 id="record-title">Build record</h2></div><div id="run-record"></div></section>
 </article>`;
}

function method() {
 return `<article class="method-page"><a class="back-link" href="#/">← Experiments</a><header class="method-header"><h1>Method</h1></header><div class="method-body"><section><h2>The setup</h2><p>Each planetary build starts with a shared feature contract. Three models each run at two reasoning settings, using four prompt approaches: minimal, detailed, bold, and refined.</p><p>Minimal and detailed change specificity. Bold and refined change aesthetic direction. These are creative conditions, not perfectly isolated scientific variables.</p><p>Luna uses medium and max effort. Sol 6.1 and Astra use medium and xhigh. The original Pocket Cosmos demo sits outside the comparison because its model, effort, and complete generation prompt weren’t recorded.</p></section><section><h2>The records</h2><p>Controlled runs include the actual model identifier, reasoning setting, and exact user-level generation prompt, including the public harness constraints. Each creation is preserved independently.</p><p>One output per condition cannot establish general model quality. Run-to-run variation, prompt differences, implementation choices, and personal taste all affect the result.</p></section><section><h2>Three kinds of evidence</h2><dl class="method-evidence"><div><dt>Functional checks</dt><dd>Tests of specific behavior. Passing orbital math tests doesn’t establish that the rendered controls work.</dd></div><div><dt>Implementation review</dt><dd>A provisional code assessment. This is not a visual rating.</dd></div><div><dt>Editorial design review</dt><dd>A judgment of the rendered creation against the rubric below. Missing reviews remain unscored.</dd></div></dl></section><section><h2>Runtime</h2><p>The viewer loads a prebuilt artifact. It doesn’t call a model or generate a new result. Only one creation runs at a time.</p><p>Each artifact runs in a script-only sandbox with bundled assets and network connections blocked. It cannot access this site or its storage. 3D rendering needs a browser with working WebGL 2.</p></section></div><section class="rubric-section"><h2>The design rubric</h2><p>Five criteria, scored from 0 to 4: absent, weak, adequate, strong, exceptional. Every rating must identify its reviewer and evidence.</p><dl class="rubric-list">${rubric.map(item => `<div><dt>${e(item.name)}</dt><dd>${e(item.description)}</dd></div>`).join('')}</dl></section><a class="solid-button" href="${experimentHref('planetary')}">Back to the builds →</a></article>`;
}

function picker(exp, route) {
 const runs = availableRuns(exp), filters = route.filters || {}, filtered = filterRuns(runs, filters), selected = selectRun(runs, route.variant, filters);
 const priorFocus = document.activeElement?.closest('#picker') ? { run: document.activeElement.dataset.run, axis: document.activeElement.dataset.axis, id: document.activeElement.id } : null;
 const activeFilters = Object.values(filters).some(Boolean);
 const controlled = runs.filter(run => run.kind === 'controlled');
 const requested = runs.find(run => run.id === route.variant);
 document.querySelector('#picker').innerHTML = `<div class="selector-heading"><h2>Builds</h2></div>
 <div class="matrix-key"><span><i class="key-available"></i> Available</span><span><i class="key-selected"></i> Selected</span><span><i class="key-pending"></i> Pending</span></div>
 <div class="condition-matrix" aria-label="${total} planned build conditions">${comparisonPlan.models.map(model => `<section class="model-group"><h3>${e(model.label)}</h3><table><caption class="sr-only">${e(model.label)} builds by reasoning effort and prompt approach</caption><thead><tr><th scope="col"><span class="sr-only">Effort</span></th>${comparisonPlan.approaches.map(approach => `<th scope="col">${e(approach)}</th>`).join('')}</tr></thead><tbody>${model.efforts.map(effort => `<tr><th scope="row">${e(effort)}</th>${comparisonPlan.approaches.map(approach => {
   const run = controlled.find(run => run.axes.model === model.label && run.axes.effort === effort && run.axes.promptApproach === approach);
   const label = `${model.label}, ${effort} effort, ${approach} prompt`;
   return `<td>${run ? `<button class="condition ${selected?.id === run.id ? 'selected' : ''} ${!filtered.includes(run) ? 'filtered-out' : ''}" data-run="${e(run.id)}" aria-label="Play ${e(label)}${!filtered.includes(run) ? '; clears filters' : ''}" aria-pressed="${selected?.id === run.id}" title="${e(label)}"><span class="condition-mark" aria-hidden="true"></span><span class="sr-only">${selected?.id === run.id ? 'Selected' : 'Play'}</span></button>` : `<span class="condition pending" aria-label="${e(label)}, pending" title="${e(label)}: pending"><span aria-hidden="true">—</span><span class="sr-only">Pending</span></span>`}</td>`;
 }).join('')}</tr>`).join('')}</tbody></table></section>`).join('')}</div>
 <details class="filter-disclosure" ${activeFilters ? 'open' : ''}><summary>Filter available builds${activeFilters ? ` · ${filtered.length} matching` : ''}</summary><div class="filter-bar">${Object.entries(axisLabels).map(([axis, label]) => `<label><span>${label}</span><select data-axis="${axis}" aria-label="Filter by ${label.toLowerCase()}"><option value="">All ${axis === 'model' ? 'models' : axis === 'effort' ? 'efforts' : 'approaches'}</option>${axisOptions(runs, axis, filters).map(option => `<option value="${e(option.value)}" ${filters[axis] === option.value ? 'selected' : ''} ${!option.available ? 'disabled' : ''}>${e(option.value)}${!option.available ? ' · no match' : ''}</option>`).join('')}</select></label>`).join('')}<button class="clear-filters" id="clear-filters" ${activeFilters ? '' : 'disabled'}>Clear filters</button></div></details>
 ${runs.filter(run => run.kind === 'baseline').map(run => `<button class="baseline-choice ${selected?.id === run.id ? 'selected' : ''}" data-run="${e(run.id)}" aria-pressed="${selected?.id === run.id}"><span>Original demo</span><strong>${e(run.title)}</strong></button>`).join('')}
 ${route.variant && !requested ? '<p class="notice" role="status">That build isn’t available.</p>' : ''}
 ${!selected ? '<div class="empty-state" role="status"><h3>No matching build</h3><button class="solid-button" id="empty-clear">Clear filters</button></div>' : ''}`;
 document.querySelectorAll('[data-axis]').forEach(select => select.addEventListener('change', () => {
   const next = { ...filters, [select.dataset.axis]: select.value }, match = selectRun(runs, selected?.id, next);
   location.hash = hrefFor(exp, match?.id, next);
 }));
 const clear = () => { location.hash = hrefFor(exp, selected?.id); };
 document.querySelector('#clear-filters').onclick = clear;
 document.querySelector('#empty-clear')?.addEventListener('click', clear);
 document.querySelectorAll('[data-run]').forEach(button => button.addEventListener('click', () => {
   const run = runs.find(run => run.id === button.dataset.run);
   location.hash = hrefFor(exp, run.id, filtered.includes(run) ? filters : {});
 }));
 if (priorFocus) {
   const target = [...document.querySelectorAll('#picker button, #picker select')].find(element => priorFocus.run ? element.dataset.run === priorFocus.run : priorFocus.axis ? element.dataset.axis === priorFocus.axis : element.id === priorFocus.id);
   target?.focus({ preventScroll: true });
 }
 if (selected) {
   if (document.querySelector('#run-record')) record(selected);
   if (loadedRuntime !== selected.id) viewer(selected);
 } else {
   if (document.body.classList.contains('viewer-expanded')) expand(false);
   controller?.abort(); loadedRuntime = null;
   document.querySelector('#viewer-container').innerHTML = '<div class="no-artifact"><h2>No build selected</h2><p>These filters don’t match an available creation.</p></div>';
   if (document.querySelector('#run-record')) document.querySelector('#run-record').innerHTML = '';
 }
}


function implementationHtml(review) {
 if (!review?.scores?.length) return '';
 const valid = review.scores.every(score => Number.isFinite(score.value) && score.value >= 0 && score.value <= 4);
 return `<details class="implementation-review"><summary><span>Implementation review <small>Provisional · code only</small></span><strong>${valid ? `${review.scores.reduce((sum, score) => sum + score.value, 0)}/${review.scores.length * 4}` : 'Unscored'}</strong></summary><p>${e(review.method || 'Code review; rendered visuals not rated.')}</p><p class="review-byline">${e(review.reviewer || 'Reviewer not recorded')} · ${e(review.evaluatedAt || 'Date not recorded')}</p><ul>${review.scores.map(score => `<li><div><strong>${e(score.label || score.id)}</strong><p>${e(score.evidence)}</p></div><span>${valid ? `${score.value}/4` : '—'}</span></li>`).join('')}</ul></details>`;
}

function record(run) {
 const ev = run.evaluation || {}, fun = ev.functional, score = editorialScore(ev), prompt = run.prompt;
 document.querySelector('#run-record').innerHTML = `<div class="run-record-grid"><section class="record-panel"><div class="record-heading"><h3>The prompt</h3><span>${prompt?.status === 'complete' ? 'Complete record' : 'Partial record'}</span></div><p>${e(prompt?.note || 'The generation prompt has not been recorded.')}</p>${(prompt?.messages || []).map(message => `<details class="prompt-disclosure"><summary>${e(message.role === 'user' ? 'Read the exact user prompt' : message.role)}</summary><pre tabindex="0" aria-label="Exact generation prompt">${e(message.content)}</pre></details>`).join('')}<div class="provenance"><h3>Recorded setup</h3><strong>${e(run.provenance.label)}</strong><p>${e(run.provenance.note)}</p><dl><div><dt>Model identifier</dt><dd>${e(run.provenance.modelId || 'Not recorded')}</dd></div><div><dt>Reasoning effort</dt><dd>${e(run.provenance.effort || 'Not recorded')}</dd></div><div><dt>Prompt approach</dt><dd>${e(run.axes.promptApproach)}</dd></div>${run.provenance.completedAt ? `<div><dt>Completed</dt><dd>${e(run.provenance.completedAt)}</dd></div>` : ''}</dl></div></section>
 <section class="record-panel evidence-panel"><div class="record-heading"><h3>The evidence</h3><span>${score ? 'Design reviewed' : 'Design unscored'}</span></div><div class="evidence-summary"><div><span>Editorial design</span><strong>${score ? `${score.earned}<small>/${score.possible}</small>` : '—'}</strong><p>${score ? `${e(ev.editorial.reviewer)} · ${e(ev.editorial.evaluatedAt)}` : 'No rendered editorial rating yet'}</p></div><div><span>Functional checks</span><strong>${Number.isInteger(fun?.passed) && Number.isInteger(fun?.total) ? `${fun.passed}<small>/${fun.total}</small>` : '—'}</strong><p>${e(fun?.scope || 'Not yet tested')}</p></div></div><p>${e(fun?.note || 'Functional checks have not been recorded.')}</p><div class="browser-evidence"><strong>${ev.browser?.status === 'verified' ? 'Browser checks recorded' : '3D browser behavior not verified'}</strong><p>${e(ev.browser?.note || 'No live browser evidence has been recorded.')}</p></div>${implementationHtml(ev.implementation)}<details class="score-details"><summary>Editorial rubric <span>0–4 per criterion</span></summary><ul>${rubric.map(item => { const result = score && ev.editorial.scores.find(score => score.id === item.id); return `<li><div><strong>${e(item.name)}</strong><p>${e(result?.evidence || item.description)}</p></div><span>${result ? `${result.value}/4` : '—'}</span></li>`; }).join('')}</ul></details>${ev.measurements?.length ? `<dl class="measurements">${ev.measurements.map(measurement => `<div><dt>${e(measurement.label)}</dt><dd>${e(measurement.value)} ${e(measurement.unit || '')}</dd></div>`).join('')}</dl>` : ''}${ev.notes?.length ? `<ul class="evaluation-notes">${ev.notes.map(note => `<li>${e(note)}</li>`).join('')}</ul>` : ''}<a class="text-link" href="#/method">How to read these scores ↗</a></section></div>`;
}

function hasWebGL2() {
 try { const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2'); if (!gl) return false; gl.getExtension('WEBGL_lose_context')?.loseContext(); return true; } catch { return false; }
}
const supportsWebGL2 = hasWebGL2();

async function viewer(run) {
 if (document.body.classList.contains('viewer-expanded')) expand(false);
 controller?.abort(); controller = new AbortController(); const signal = controller.signal; loadedRuntime = run.id;
 document.body.classList.remove('viewer-expanded');
 const container = document.querySelector('#viewer-container');
 container.innerHTML = `<div class="runtime-shell"><div class="runtime-toolbar"><div><strong>${e(run.kind === 'baseline' ? run.title : `${run.axes.model} / ${run.axes.effort} / ${run.axes.promptApproach}`)}</strong></div><div class="runtime-actions"><button id="restart-runtime" aria-label="Restart this creation">Restart</button><button id="expand-runtime" aria-expanded="false">Expand</button></div></div><div class="runtime-stage"><div class="runtime-loading" role="status"><h3>Loading…</h3></div></div>${!supportsWebGL2 ? '<div class="capability-note"><strong>3D isn’t available in this browser.</strong><span>Use a browser with working WebGL 2 to play.</span></div>' : ''}</div>`;
 document.querySelector('#restart-runtime').onclick = () => viewer(run);
 document.querySelector('#expand-runtime').onclick = () => expand();
 try {
   if (!safeRuntimePath(run.runtime)) throw Error('Invalid artifact path.');
   const response = await fetch(run.runtime, { signal, cache: 'no-cache' });
   if (!response.ok) throw Error(`Artifact request failed (HTTP ${response.status}).`);
   const html = await response.text();
   if (!/<html[\s>]/i.test(html) || !html.includes('Content-Security-Policy')) throw Error('Artifact is not a valid isolated build.');
   if (signal.aborted || !container.isConnected) return;
   const frame = document.createElement('iframe');
   frame.title = `${run.title} interactive creation`;
   frame.setAttribute('sandbox', 'allow-scripts'); frame.setAttribute('referrerpolicy', 'no-referrer');
   frame.setAttribute('allow', "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; clipboard-read 'none'; clipboard-write 'none'");
   frame.addEventListener('load', () => { if (!signal.aborted) document.querySelector('#announcement').textContent = `${run.title} document loaded.${supportsWebGL2 ? '' : ' WebGL 2 is unavailable in this browser.'}`; }, { once: true });
   frame.srcdoc = html; container.querySelector('.runtime-stage').replaceChildren(frame);
 } catch (error) {
   if (error.name === 'AbortError' || signal.aborted || !container.isConnected) return;
   container.querySelector('.runtime-stage').innerHTML = `<div class="runtime-error" role="alert"><h3>This build couldn’t load.</h3><p>${e(error.message)}</p><button class="solid-button" id="retry-runtime">Try again</button></div>`;
   document.querySelector('#retry-runtime').onclick = () => viewer(run);
 }
}

function expand(force) {
 const shell = document.querySelector('.runtime-shell'); if (!shell) return;
 const expanded = typeof force === 'boolean' ? force : !shell.classList.contains('expanded');
 shell.classList.toggle('expanded', expanded); document.body.classList.toggle('viewer-expanded', expanded);
 if (expanded) { shell.setAttribute('role', 'dialog'); shell.setAttribute('aria-modal', 'true'); shell.setAttribute('aria-label', 'Expanded creation'); } else { shell.removeAttribute('role'); shell.removeAttribute('aria-modal'); shell.removeAttribute('aria-label'); }
 const button = document.querySelector('#expand-runtime'); button.setAttribute('aria-expanded', String(expanded)); button.textContent = expanded ? 'Close' : 'Expand';
 // Keep the expanded viewer in the keyboard reading order without trapping focus behind it.
 for (const element of document.querySelectorAll('.site-header, .site-footer, .post-header, .selector-column, .run-record')) element.inert = expanded;
 button.focus({ preventScroll: true });
}

function render() {
 const route = parseRoute(location.hash), previous = currentRoute;
 currentRoute = route;
 const exp = route.page === 'experiment' ? experiments.find(exp => exp.id === route.id) : null;
 document.querySelectorAll('[data-nav]').forEach(link => { if ((route.page === 'method' ? 'method' : 'home') === link.dataset.nav) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
 if (exp && previous?.page === route.page && currentExperiment?.id === exp.id) { picker(exp, route); return; }
 if (document.body.classList.contains('viewer-expanded')) expand(false);
 controller?.abort(); loadedRuntime = null; currentExperiment = exp;
 if (route.page === 'home') { document.title = 'Experiments — Planet Lab'; main.innerHTML = journalIndex(); }
 else if (exp) { document.title = 'One planetary toy, 24 builds — Planet Lab'; main.innerHTML = post(exp); picker(exp, route); }
 else if (route.page === 'method') { document.title = 'The method — Planet Lab'; main.innerHTML = method(); }
 else { document.title = 'Page not found — Planet Lab'; main.innerHTML = '<section class="not-found"><h1>Page not found</h1><p>That experiment or page doesn’t exist.</p><a class="solid-button" href="#/">Back to experiments →</a></section>'; }
 window.scrollTo({ top: 0, behavior: 'instant' }); if (renderCount++) main.focus({ preventScroll: true });
}
window.addEventListener('hashchange', render);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.classList.contains('viewer-expanded')) expand(false); });
document.querySelector('.skip-link').onclick = event => { event.preventDefault(); main.focus(); };
render();
