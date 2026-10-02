// Independent run PRs add their own source directory and metadata.json.
const records = import.meta.glob('../../experiments/planetary/*/metadata.json', { eager: true, import: 'default' });
const models = ['Luna', 'Sol 6.1', 'Astra'];
const approaches = ['minimal', 'detailed', 'bold', 'refined'];
export const generatedRuns = Object.values(records).sort((a, b) => models.indexOf(a.axes.model) - models.indexOf(b.axes.model) || (a.axes.effort === 'medium' ? 0 : 1) - (b.axes.effort === 'medium' ? 0 : 1) || approaches.indexOf(a.axes.promptApproach) - approaches.indexOf(b.axes.promptApproach));
