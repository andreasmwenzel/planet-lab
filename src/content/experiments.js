import { generatedRuns } from './generated-runs.js';
export const comparisonPlan = {
  models: [{ id: 'luna', label: 'Luna', efforts: ['medium', 'max'] }, { id: 'sol', label: 'Sol 6.1', efforts: ['medium', 'xhigh'] }, { id: 'astra', label: 'Astra', efforts: ['medium', 'xhigh'] }],
  approaches: ['minimal', 'detailed', 'bold', 'refined'],
};

export const rubric = [
  { id: 'craft', name: 'Visual craft', description: 'Composition, typography, color, and a coherent visual identity.' },
  { id: 'interaction', name: 'Interaction', description: 'Responsive, understandable controls and useful feedback.' },
  { id: 'delight', name: 'Sense of discovery', description: 'A memorable idea that rewards a little exploration.' },
  { id: 'clarity', name: 'Clarity', description: 'An experience that explains itself without getting in the way.' },
  { id: 'inclusion', name: 'Inclusive design', description: 'Readable layouts, keyboard access, reduced motion, and helpful fallbacks.' },
];

export const baseline = {
  id: 'baseline',
  title: 'Pocket Cosmos',
  experimentId: 'planetary',
  status: 'available',
  kind: 'baseline',
  runtime: '/experiments/planetary/baseline/index.html',
  axes: { model: 'Not recorded', effort: 'Not recorded', promptApproach: 'Assistant-curated' },
  summary: 'Five fictional worlds, a small sun, and a comet you can send flying. The original seed of this journal.',
  provenance: {
    label: 'Original, assistant-curated demo',
    note: 'This initial demo predates the controlled comparison. Its model and reasoning effort were not recorded. It is preserved here as the starting point, not as a measured model result.',
    modelId: null,
    effort: null,
  },
  prompt: {
    status: 'partial',
    messages: [{ role: 'user', content: 'What about 3D rendering? Can you publish a fun 3D experiment to a private GitHub repo?' }],
    note: 'The original user request is reproduced exactly. The assistant chose an interactive planetary system with orbit controls and playful physics. That summary is context, not an exact generation prompt; the complete generation prompt was not recorded.',
  },
  evaluation: {
    status: 'unscored',
    functional: { status: 'partial', passed: 7, total: 7, scope: 'Pure simulation unit tests', note: 'These checks cover orbital math, timing, deterministic randomness, and comet paths. They do not verify rendering or browser interactions.' },
    editorial: null,
    browser: { status: 'not-verified', note: 'The deployed baseline showed its graceful WebGL 2 fallback in the cloud browser. That browser could not render WebGL 2, so visual and interactive 3D behavior remains unverified.' },
    measurements: [],
    notes: ['The production bundle builds successfully.', 'A stylized rendering playground, not a gravity or astronomy simulation.'],
  },
};

export const experiments = [
  {
    id: 'planetary',
    number: '001',
    title: 'A universe in a browser',
    subtitle: 'One idea. Many possible worlds.',
    category: 'Interactive 3D',
    status: 'In progress',
    description: 'What happens when a loose idea for a 3D experiment becomes something you can actually play with? Start with Pocket Cosmos, then follow the comparison as new runs arrive.',
    question: 'How much do the model, reasoning effort, and prompt approach change the world that comes back?',
    brief: 'Build a playful, interactive planetary system for the browser. Make exploration feel inviting, give the controls a purpose, and turn a small technical experiment into a place worth spending a few minutes.',
    tags: ['Three.js', 'Creative coding', 'Model comparison'],
    runs: [baseline, ...generatedRuns.filter(run => run.experimentId === 'planetary')],
  },
];

export const futureIdeas = [
  { number: '002', title: 'What could a sound look like?', category: 'A possible next question', description: 'An audiovisual playground, where a gesture becomes a little piece of music.', visual: 'sound' },
  { number: '003', title: 'A tiny ecosystem, taking shape', category: 'A possible next question', description: 'A living sketch of emergent behavior. Small rules, surprising outcomes.', visual: 'ecosystem' },
];
