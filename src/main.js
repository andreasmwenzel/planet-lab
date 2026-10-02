import './style.css';
import { experiments, rubric } from './content/experiments.js';
import { chartsHtml } from './charts.js';
import { reviews, reviewDownloads } from './content/evaluations.js';
import { comparisonHtml, reviewFindingsHtml, evidenceHtml } from './report.js';
import { availableRuns, filterRuns, axisOptions, parseRoute, experimentHref, resultHref, resultRun, selectRun, plannedRunCount, safeRuntimePath, escapeHtml as e, editorialScore, implementationScore, evaluationFor } from './lab.js';

const main = document.querySelector('main');
const axisLabels = { model: 'Model', effort: 'Reasoning effort', promptApproach: 'Prompt approach' };
let controller, currentRoute, currentExperiment, loadedRuntime, renderCount = 0;
const hrefFor = (exp, variant, filters = {}, view = currentRoute?.view, metric = currentRoute?.metric) => experimentHref(exp.id, variant, filters, view, metric);

function journalIndex() {
 return `<section class="journal-index"><header class="index-intro"><h1>Experiments</h1></header><div class="post-list" aria-label="Experiment posts">${experiments.map(exp => { const count = availableRuns(exp).filter(run => run.kind === 'controlled').length, total = plannedRunCount(exp.plan); return `<article class="post-list-item"><div class="post-date"><time datetime="${e(exp.date)}">${e(exp.displayDate)}</time><span>${e(exp.category)}</span></div><h2><a href="${experimentHref(exp.id)}">${e(exp.title)}</a></h2><p>${e(exp.excerpt)}</p><div class="post-list-bottom"><span>${count} of ${total} runs published</span><a href="${experimentHref(exp.id)}">Read the experiment <span aria-hidden="true">→</span></a></div></article>`; }).join('')}</div></section>`;
}

function post(exp) {
 const controlled = availableRuns(exp).filter(run => run.kind === 'controlled').length, total = plannedRunCount(exp.plan);
 return `<article class="experiment-post full-post">
 <header class="post-header"><div class="post-intro"><div class="post-meta"><span>Experiment ${e(String(Number(exp.number)).padStart(2, '0'))}</span><span>${e(exp.category)}</span><time datetime="${e(exp.date)}">${e(exp.displayDate)}</time></div><h1>${exp.headline.map((line, index) => index ? `<br><span>${e(line)}</span>` : e(line)).join('')}</h1></div><div class="post-deck"><p>${e(exp.description)}</p><p class="progress-copy"><strong>${controlled} of ${total} builds available</strong></p></div></header>
 <nav class="view-switch" aria-label="Experiment view"><button data-view="simulator">Simulator</button><button data-view="charts">Charts</button><a id="open-result" target="_blank" rel="noopener noreferrer" hidden>Open result in new tab</a></nav>
 <section class="observation-desk" aria-label="${e(exp.title)}"><div class="artifact-column"><div id="viewer-container"></div></div><aside class="selector-column" aria-label="Compare creations"><div id="picker"></div></aside></section>
 ${comparisonHtml(exp, reviews[exp.id], reviewDownloads[exp.id])}
 <section class="run-record" aria-labelledby="record-title"><div class="record-section-heading"><h2 id="record-title">Build record</h2></div><div id="run-record"></div></section>
 </article>`;
}

function about() {
 return `<article class="about-page"><h1>What this is</h1><p>A fun attempt at testing AI models by making things. The <a href="https://github.com/andreasmwenzel/planet-lab">Planet Lab repository</a> keeps the code behind the ideas, models, prompts, and results collected here.</p><p>You can play with each build, compare the recorded times and reviews, and read the exact prompts. It’s a small collection of experiments, with the rough edges left in.</p></article>`;
}

function picker(exp, route) {
 const plan = exp.plan, total = plannedRunCount(plan);
 const runs = availableRuns(exp), filters = route.filters || {}, filtered = filterRuns(runs, filters), selected = selectRun(runs, route.variant, filters);
 const resultLink = document.querySelector('#open-result');
 resultLink.hidden = !selected;
 if (selected) resultLink.href = resultHref(exp.id, selected.id);
 else resultLink.removeAttribute('href');
 document.querySelectorAll('[data-view]').forEach(button => {
   button.setAttribute('aria-pressed', String(button.dataset.view === (route.view || 'simulator')));
   button.onclick = () => { location.hash = hrefFor(exp, selected?.id, filters, button.dataset.view, route.metric); };
 });
 const priorFocus = document.activeElement?.closest('#picker') ? { run: document.activeElement.dataset.run, axis: document.activeElement.dataset.axis, id: document.activeElement.id } : null;
 const activeFilters = Object.values(filters).some(Boolean);
 const controlled = runs.filter(run => run.kind === 'controlled');
 const requested = runs.find(run => run.id === route.variant);
 document.querySelector('#picker').innerHTML = `<div class="selector-heading"><h2>Builds</h2></div>${reviews[exp.id] ? '<p class="code-score-key">Provisional code scores /20</p>' : ''}
 <div class="matrix-key"><span><i class="key-available"></i> Available</span><span><i class="key-selected"></i> Selected</span><span><i class="key-pending"></i> Pending</span></div>
 <div class="condition-matrix" aria-label="${total} planned build conditions">${plan.models.map(model => `<section class="model-group"><h3>${e(model.label)}</h3><table><caption class="sr-only">${e(model.label)} builds by reasoning effort and prompt approach</caption><thead><tr><th scope="col"><span class="sr-only">Effort</span></th>${plan.approaches.map(approach => `<th scope="col">${e(approach)}</th>`).join('')}</tr></thead><tbody>${model.efforts.map(effort => `<tr><th scope="row">${e(effort)}</th>${plan.approaches.map(approach => {
   const run = controlled.find(run => run.axes.model === model.label && run.axes.effort === effort && run.axes.promptApproach === approach);
   const codeScore = run && implementationScore(evaluationFor(run, reviews).implementation);
   const label = `${model.label}, ${effort} effort, ${approach} prompt${codeScore ? `, provisional code score ${codeScore.earned} out of ${codeScore.possible}` : ''}`;
   return `<td>${run ? `<button class="condition ${selected?.id === run.id ? 'selected' : ''} ${!filtered.includes(run) ? 'filtered-out' : ''}" data-run="${e(run.id)}" aria-label="Play ${e(label)}${!filtered.includes(run) ? '; clears filters' : ''}" aria-pressed="${selected?.id === run.id}" title="${e(label)}">${codeScore ? `<span class="condition-score" aria-hidden="true">${codeScore.earned}</span>` : '<span class="condition-mark" aria-hidden="true"></span>'}<span class="sr-only">${selected?.id === run.id ? 'Selected' : 'Play'}</span></button>` : `<span class="condition pending" aria-label="${e(label)}, pending" title="${e(label)}: pending"><span aria-hidden="true">—</span><span class="sr-only">Pending</span></span>`}</td>`;
 }).join('')}</tr>`).join('')}</tbody></table></section>`).join('')}</div>
 <details class="filter-disclosure" ${activeFilters ? 'open' : ''}><summary>Filter available builds${activeFilters ? ` · ${filtered.length} matching` : ''}</summary><div class="filter-bar">${Object.entries(axisLabels).map(([axis, label]) => `<label><span>${label}</span><select data-axis="${axis}" aria-label="Filter by ${label.toLowerCase()}"><option value="">All ${axis === 'model' ? 'models' : axis === 'effort' ? 'efforts' : 'approaches'}</option>${axisOptions(runs, axis, filters).map(option => `<option value="${e(option.value)}" ${filters[axis] === option.value ? 'selected' : ''} ${!option.available ? 'disabled' : ''}>${e(option.value)}${!option.available ? ' · no match' : ''}</option>`).join('')}</select></label>`).join('')}<button class="clear-filters" id="clear-filters" ${activeFilters ? '' : 'disabled'}>Clear filters</button></div></details>
 ${runs.filter(run => run.kind === 'baseline').map(run => `<button class="baseline-choice ${selected?.id === run.id ? 'selected' : ''}" data-run="${e(run.id)}" aria-pressed="${selected?.id === run.id}"><span>Original demo</span><strong>${e(run.title)}</strong></button>`).join('')}
 ${route.variant && !requested ? '<p class="notice" role="status">That build isn’t available.</p>' : ''}
 ${!selected ? `<div class="empty-state" role="status"><h3>${runs.length ? 'No matching build' : 'No published builds yet'}</h3>${activeFilters ? '<button class="solid-button" id="empty-clear">Clear filters</button>' : ''}</div>` : ''}`;
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
   if (route.view === 'charts') showCharts(exp, route, filtered, selected);
   else if (loadedRuntime !== `${selected.experimentId}/${selected.id}`) viewer(selected);
 } else {
   if (document.body.classList.contains('viewer-expanded')) expand(false);
   controller?.abort(); loadedRuntime = null;
   if (route.view === 'charts') showCharts(exp, route, filtered, selected);
   else document.querySelector('#viewer-container').innerHTML = `<div class="no-artifact"><h2>${runs.length ? 'No build selected' : 'No published builds yet'}</h2>${runs.length ? '<p>These filters don’t match an available creation.</p>' : ''}</div>`;
   if (document.querySelector('#run-record')) document.querySelector('#run-record').innerHTML = '';
 }
}


function showCharts(exp, route, runs, selected) {
 if (document.body.classList.contains('viewer-expanded')) expand(false);
 controller?.abort(); loadedRuntime = null;
 const previousFocus = { metric: document.activeElement?.dataset.metric, run: document.activeElement?.dataset.chartRun };
 const container = document.querySelector('#viewer-container');
 container.innerHTML = chartsHtml(exp, runs, selected, route, reviews);
 container.querySelectorAll('[data-metric]').forEach(button => button.addEventListener('click', () => {
   location.hash = hrefFor(exp, selected?.id, route.filters, 'charts', button.dataset.metric);
 }));
 container.querySelectorAll('[data-chart-run]').forEach(button => button.addEventListener('click', () => {
   location.hash = hrefFor(exp, button.dataset.chartRun, route.filters, 'charts', route.metric);
 }));
 if (previousFocus.metric || previousFocus.run) [...container.querySelectorAll('button')].find(button => previousFocus.metric ? button.dataset.metric === previousFocus.metric : button.dataset.chartRun === previousFocus.run)?.focus({ preventScroll: true });
}

function implementationHtml(review, detail) {
 if (!review?.scores?.length) return '';
 const valid = review.scores.every(score => Number.isFinite(score.value) && score.value >= 0 && score.value <= 4);
 return `<details class="implementation-review"><summary><span>Implementation review <small>Provisional · code only</small></span><strong>${valid ? `${review.scores.reduce((sum, score) => sum + score.value, 0)}/${review.scores.length * 4}` : 'Unscored'}</strong></summary><p>${e(review.method || 'Code review; rendered visuals not rated.')}</p><p class="review-byline">${e(review.reviewer || 'Reviewer not recorded')} · ${e(review.evaluatedAt || 'Date not recorded')}</p><ul>${review.scores.map(score => `<li><div><strong>${e(score.label || score.id)}</strong>${detail?.criteria?.[score.id]?.evidence ? evidenceHtml(detail.criteria[score.id].evidence) : `<p>${e(score.evidence)}</p>`}</div><span>${valid ? `${score.value}/4` : '—'}</span></li>`).join('')}</ul></details>`;
}

function record(run) {
 const ev = evaluationFor(run, reviews), fun = ev.functional, score = editorialScore(ev), codeScore = implementationScore(ev.implementation), prompt = run.prompt;
 document.querySelector('#run-record').innerHTML = `<div class="run-record-grid"><section class="record-panel"><div class="record-heading"><h3>The prompt</h3><span>${prompt?.status === 'complete' ? 'Complete record' : 'Partial record'}</span></div><p>${e(prompt?.note || 'The generation prompt has not been recorded.')}</p>${(prompt?.messages || []).map(message => `<details class="prompt-disclosure"><summary>${e(message.role === 'user' ? 'Read the exact user prompt' : message.role)}</summary><pre tabindex="0" aria-label="Exact generation prompt">${e(message.content)}</pre></details>`).join('')}<div class="provenance"><h3>Recorded setup</h3><strong>${e(run.provenance.label)}</strong><p>${e(run.provenance.note)}</p><dl><div><dt>Model identifier</dt><dd>${e(run.provenance.modelId || 'Not recorded')}</dd></div><div><dt>Reasoning effort</dt><dd>${e(run.provenance.effort || 'Not recorded')}</dd></div><div><dt>Prompt approach</dt><dd>${e(run.axes.promptApproach)}</dd></div>${run.provenance.completedAt ? `<div><dt>Completed</dt><dd>${e(run.provenance.completedAt)}</dd></div>` : ''}</dl></div></section>
 <section class="record-panel evidence-panel"><div class="record-heading"><h3>The evidence</h3><span>${score ? 'Design reviewed' : 'Design unscored'}</span></div><div class="evidence-summary">${codeScore ? `<div><span>Implementation</span><strong>${codeScore.earned}<small>/${codeScore.possible}</small></strong><p>Provisional · code only</p></div>` : ''}<div><span>Editorial design</span><strong>${score ? `${score.earned}<small>/${score.possible}</small>` : '—'}</strong><p>${score ? `${e(ev.editorial.reviewer)} · ${e(ev.editorial.evaluatedAt)}` : 'No rendered editorial rating yet'}</p></div><div><span>${fun?.status === 'build-checks-passed-browser-unverified' ? 'Build checks' : 'Functional checks'}</span><strong>${Number.isInteger(fun?.passed) && Number.isInteger(fun?.total) ? `${fun.passed}<small>/${fun.total}</small>` : '—'}</strong><p>${e(fun?.scope || 'Not yet tested')}</p></div></div><p>${e(fun?.note || 'Functional checks have not been recorded.')}</p><div class="browser-evidence"><strong>${ev.browser?.status === 'verified' ? 'Browser checks recorded' : (run.experimentId === 'planetary' ? '3D browser behavior not verified' : 'Browser behavior not verified')}</strong><p>${e(ev.browser?.note || 'No live browser evidence has been recorded.')}</p></div>${implementationHtml(ev.implementation, reviews[run.experimentId]?.[run.id])}${reviewFindingsHtml(reviews[run.experimentId]?.[run.id])}<details class="score-details"><summary>Editorial rubric <span>0–4 per criterion</span></summary><ul>${rubric.map(item => { const result = score && ev.editorial.scores.find(score => score.id === item.id); return `<li><div><strong>${e(item.name)}</strong><p>${e(result?.evidence || item.description)}</p></div><span>${result ? `${result.value}/4` : '—'}</span></li>`; }).join('')}</ul></details>${ev.measurements?.length ? `<dl class="measurements">${ev.measurements.map(measurement => `<div><dt>${e(measurement.label)}</dt><dd>${e(measurement.value)} ${e(measurement.unit || '')}</dd></div>`).join('')}</dl>` : ''}${ev.notes?.length ? `<ul class="evaluation-notes">${ev.notes.map(note => `<li>${e(note)}</li>`).join('')}</ul>` : ''}</section></div>`;
}

function hasWebGL2() {
 try { const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2'); if (!gl) return false; gl.getExtension('WEBGL_lose_context')?.loseContext(); return true; } catch { return false; }
}
const supportsWebGL2 = hasWebGL2();

async function viewer(run) {
 const needsWebGL = currentExperiment?.requiresWebGL2 === true;
 if (document.body.classList.contains('viewer-expanded')) expand(false);
 controller?.abort(); controller = new AbortController(); const signal = controller.signal; loadedRuntime = `${run.experimentId}/${run.id}`;
 document.body.classList.remove('viewer-expanded');
 const container = document.querySelector('#viewer-container');
 container.innerHTML = `<div class="runtime-shell"><div class="runtime-toolbar"><div><strong>${e(run.kind === 'baseline' ? run.title : `${run.axes.model} / ${run.axes.effort} / ${run.axes.promptApproach}`)}</strong></div><div class="runtime-actions"><button id="restart-runtime" aria-label="Restart this creation">Restart</button>${currentRoute.page === 'result' ? `<a href="${experimentHref(run.experimentId, run.id)}">Back to experiment</a>` : '<button id="expand-runtime" aria-expanded="false">Expand</button>'}</div></div><div class="runtime-stage"><div class="runtime-loading" role="status"><h3>Loading…</h3></div></div>${needsWebGL && !supportsWebGL2 ? '<div class="capability-note"><strong>3D isn’t available in this browser.</strong><span>Use a browser with working WebGL 2 to play.</span></div>' : ''}</div>`;
 document.querySelector('#restart-runtime').onclick = () => viewer(run);
 document.querySelector('#expand-runtime')?.addEventListener('click', () => expand());
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
   frame.addEventListener('load', () => { if (!signal.aborted) document.querySelector('#announcement').textContent = `${run.title} document loaded.${needsWebGL && !supportsWebGL2 ? ' WebGL 2 is unavailable in this browser.' : ''}`; }, { once: true });
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
 for (const element of document.querySelectorAll('.site-header, .site-footer, .post-header, .selector-column, .run-record, .view-switch, .comparison-report')) element.inert = expanded;
 button.focus({ preventScroll: true });
}

function render() {
 const route = parseRoute(location.hash), previous = currentRoute;
 currentRoute = route;
 const exp = ['experiment', 'result'].includes(route.page) ? experiments.find(exp => exp.id === route.id) : null;
 document.querySelectorAll('[data-nav]').forEach(link => { if ((route.page === 'about' ? 'about' : 'home') === link.dataset.nav) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
 if (route.page === 'experiment' && exp && previous?.page === route.page && currentExperiment?.id === exp.id) { picker(exp, route); return; }
 if (document.body.classList.contains('viewer-expanded')) expand(false);
 controller?.abort(); loadedRuntime = null; currentExperiment = exp;
 document.body.classList.toggle('standalone-result', route.page === 'result');
 if (route.page === 'home') { document.title = 'Experiments — Planet Lab'; main.innerHTML = journalIndex(); }
 else if (exp && route.page === 'experiment') { document.title = `${exp.title} — Planet Lab`; main.innerHTML = post(exp); picker(exp, route); }
 else if (route.page === 'result' && resultRun(exp, route.variant)) {
   const run = resultRun(exp, route.variant);
   document.title = `${run.title} — Planet Lab`;
   main.innerHTML = '<section class="result-page" aria-label="Standalone result"><div id="viewer-container"></div></section>';
   viewer(run);
 }
 else if (route.page === 'about') { document.title = 'What this is — Planet Lab'; main.innerHTML = about(); }
 else { document.title = 'Page not found — Planet Lab'; main.innerHTML = '<section class="not-found"><h1>Page not found</h1><p>That experiment or page doesn’t exist.</p><a class="solid-button" href="#/">Back to experiments →</a></section>'; }
 window.scrollTo({ top: 0, behavior: 'instant' }); if (renderCount++) main.focus({ preventScroll: true });
}
window.addEventListener('hashchange', render);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.classList.contains('viewer-expanded')) expand(false); });
document.querySelector('.skip-link').onclick = event => { event.preventDefault(); main.focus(); };
render();
