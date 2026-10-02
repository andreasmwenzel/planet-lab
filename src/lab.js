export const axisKeys = ['model', 'effort', 'promptApproach'];

export function availableRuns(experiment) {
  return experiment.runs.filter(run => run.status === 'available');
}

export function filterRuns(runs, filters = {}) {
  return runs.filter(run => axisKeys.every(axis => !filters[axis] || run.axes[axis] === filters[axis]));
}

export function axisOptions(runs, axis, filters = {}) {
  const otherFilters = { ...filters, [axis]: '' };
  return [...new Set(runs.map(run => run.axes[axis]))].map(value => ({
    value,
    available: filterRuns(runs, { ...otherFilters, [axis]: value }).length > 0,
  }));
}

export function parseRoute(hash) {
  const [pathname, search = ''] = hash.replace(/^#/, '').split('?');
  if (pathname === '/about' || pathname === '/method') return { page: 'about' };
  if (!pathname || pathname === '/' || pathname === '/journal') {
    if (!search) return { page: 'home' };
    const params = new URLSearchParams(search);
    return { page: 'home', variant: params.get('variant'), filters: Object.fromEntries(axisKeys.map(axis => [axis, params.get(axis) || ''])) };
  }
  const match = pathname.match(/^\/experiments\/([a-z0-9-]+)$/);
  if (match) {
    const params = new URLSearchParams(search);
    return { page: 'experiment', id: match[1], variant: params.get('variant'), filters: Object.fromEntries(axisKeys.map(axis => [axis, params.get(axis) || ''])), ...(params.get('view') === 'charts' ? { view: 'charts', metric: ['time', 'implementation', 'api'].includes(params.get('metric')) ? params.get('metric') : 'time' } : {}) };
  }
  return { page: 'not-found' };
}

export function experimentHref(id, variant, filters = {}, view, metric) {
  const params = new URLSearchParams();
  if (variant) params.set('variant', variant);
  for (const axis of axisKeys) if (filters[axis]) params.set(axis, filters[axis]);
  if (view === 'charts') {
    params.set('view', 'charts');
    if (['implementation', 'api'].includes(metric)) params.set('metric', metric);
  }
  return `#/experiments/${encodeURIComponent(id)}${params.size ? `?${params}` : ''}`;
}

export function safeRuntimePath(path) {
  return typeof path === 'string' && /^\/experiments\/[a-z0-9-]+\/[a-z0-9-]+\/index\.html$/.test(path);
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

export function editorialScore(evaluation) {
  if (evaluation?.status !== 'scored' || !evaluation.editorial?.scores?.length) return null;
  const values = evaluation.editorial.scores.map(score => score.value);
  if (values.some(value => !Number.isFinite(value) || value < 0 || value > 4)) return null;
  return { earned: values.reduce((sum, value) => sum + value, 0), possible: values.length * 4 };
}

export function implementationScore(review) {
  if (!review?.scores?.length) return null;
  const values = review.scores.map(score => score.value);
  if (values.some(value => !Number.isFinite(value) || value < 0 || value > 4)) return null;
  return { earned: values.reduce((sum, value) => sum + value, 0), possible: values.length * 4 };
}

// Reviews are separate from the frozen generation record and scoped to a post.
export function evaluationFor(run, reviews = {}) {
  const review = reviews[run.experimentId]?.[run.id];
  return { ...run.evaluation, ...(review ? {
    implementation: review.implementation,
    functional: review.functional || run.evaluation?.functional,
    browser: review.browser || run.evaluation?.browser,
  } : {}) };
}

export function homeHref(variant, filters = {}) {
  const link = experimentHref('planetary', variant, filters);
  return link.replace('#/experiments/planetary', '#/');
}

export function selectRun(runs, variant, filters = {}) {
  const matches = filterRuns(runs, filters);
  return matches.find(run => run.id === variant) || matches.find(run => run.kind === 'controlled') || matches[0];
}

export function plannedRunCount(plan) {
  return plan.models.reduce((sum, model) => sum + model.efforts.length * plan.approaches.length, 0);
}
