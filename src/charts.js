import { escapeHtml as e, evaluationFor, implementationScore } from './lab.js';

// Standard API base rates verified on the official model pages, 2 October 2026.
// These are a reference, not the billing of the recorded generation tasks.
export const apiRates = [
  { model: 'Luna', id: 'gpt-6-luna', input: 0.10, cached: 0.01, write: 0.125, output: 0.50 },
  { model: 'Sol 6.1', id: 'gpt-6.1-sol', input: 2, cached: 0.10, write: 2.50, output: 10 },
  { model: 'Astra', id: 'gpt-6-astra', input: 10, cached: 1, write: 12.50, output: 50 },
];

export function chartValue(run, metric, reviews) {
  if (metric === 'implementation') return implementationScore(evaluationFor(run, reviews).implementation)?.earned ?? null;
  if (metric === 'time') {
    const value = run.provenance?.durationSeconds;
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  return null;
}

function priceHtml() {
  const max = Math.max(...apiRates.map(rate => rate.output));
  return `<h2>API price reference</h2><p class="chart-note">USD per million tokens · Standard base rates</p><div class="price-key"><span><i class="input-key"></i>Input</span><span><i class="output-key"></i>Output</span></div><div class="price-bars">${apiRates.map(rate => `<div class="price-row"><h3>${e(rate.model)}</h3><div class="price-series"><div class="price-bar input-price" style="--bar:${rate.input / max * 100}%" aria-label="Input: $${rate.input}"><span></span><strong>$${rate.input.toFixed(2)}</strong></div><div class="price-bar output-price" style="--bar:${rate.output / max * 100}%" aria-label="Output: $${rate.output}"><span></span><strong>$${rate.output.toFixed(2)}</strong></div></div></div>`).join('')}</div><div class="rate-table-wrap"><table class="rate-table"><caption>All rates, USD / million tokens</caption><thead><tr><th>Model</th><th>Input</th><th>Cached input</th><th>Cache write</th><th>Output</th></tr></thead><tbody>${apiRates.map(rate => `<tr><th><a href="https://developers.openai.com/api/docs/models/${rate.id}" target="_blank" rel="noopener noreferrer">${e(rate.model)}</a></th><td>$${rate.input.toFixed(2)}</td><td>$${rate.cached.toFixed(2)}</td><td>$${rate.write.toFixed(3)}</td><td>$${rate.output.toFixed(2)}</td></tr>`).join('')}</tbody></table></div><p class="chart-note">Official model pages, checked 2 October 2026. Base rates cover inputs up to 272K tokens; longer contexts and Fast pricing differ. These rates do not establish what these runs cost.</p>`;
}

export function chartsHtml(exp, runs, selected, route, reviews) {
  const metric = route.metric || 'time';
  const rows = runs.filter(run => run.kind === 'controlled').map(run => ({ run, value: chartValue(run, metric, reviews) }));
  const values = rows.filter(row => row.value !== null);
  const max = metric === 'implementation' ? 20 : Math.max(1, ...values.map(row => row.value));
  const title = metric === 'implementation' ? 'Provisional implementation score' : 'Observed completion time';
  const description = metric === 'implementation' ? 'Source review /20 · rendered design unscored' : 'Wall-clock seconds, including tools, bundling, and coordination';
  return `<section class="chart-panel" aria-label="Experiment charts"><div class="chart-controls" aria-label="Chart metric">${[['time', 'Time'], ['implementation', 'Code review'], ['api', 'API prices']].map(([id, label]) => `<button data-metric="${id}" aria-pressed="${metric === id}">${label}</button>`).join('')}</div>${metric === 'api' ? priceHtml() : `<h2>${title}</h2><p class="chart-note">${description}</p>${values.length ? `<div class="run-bars">${rows.map(({ run, value }) => `<button class="run-bar ${run.id === selected?.id ? 'selected' : ''}" data-chart-run="${e(run.id)}" aria-pressed="${run.id === selected?.id}" aria-label="${e(`${run.axes.model}, ${run.axes.effort}, ${run.axes.promptApproach}: ${value === null ? 'unavailable' : `${value}${metric === 'implementation' ? ' out of 20' : ' seconds'}`}`)}"><span class="bar-label">${e(run.axes.model)} / ${e(run.axes.effort)} / ${e(run.axes.promptApproach)}</span><span class="bar-track"><span class="bar-fill" style="--bar:${value === null ? 0 : value / max * 100}%"></span></span><strong>${value === null ? '—' : `${value.toLocaleString('en-US')}${metric === 'implementation' ? '/20' : ' s'}`}</strong></button>`).join('')}</div>` : `<p class="chart-empty">${metric === 'implementation' ? 'Implementation reviews are pending.' : 'No completion times are available for these filters.'}</p>`}`}${selected ? `<div class="chart-selection"><strong>${e(selected.axes.model)} / ${e(selected.axes.effort)} / ${e(selected.axes.promptApproach)}</strong><span>Actual run cost: unavailable</span><p>Provider token and billing counters were not exposed.</p></div>` : ''}</section>`;
}
