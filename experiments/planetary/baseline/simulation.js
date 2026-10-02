export const TAU = Math.PI * 2;
export const DEFAULT_SPEED = 1;
export const PLANETS = Object.freeze([
  { id: 'cinder', name: 'Cinder', kind: '01 / THE LITTLE FIRECRACKER', color: '#ed986b', accent: '#793c2a', radius: .47, orbit: 3.65, period: 24, phase: .8, tilt: .05, mood: 'Small, but spicy', description: 'A sun-kissed pebble with a molten heart. Always in a hurry. Almost certainly late for something.' },
  { id: 'taffy', name: 'Taffy', kind: '02 / THE DAYDREAMER', color: '#d8a4c2', accent: '#704f85', radius: .7, orbit: 5.55, period: 40, phase: 3.9, tilt: -.06, mood: 'Soft & slightly odd', description: 'Pastel skies, purple valleys, and absolutely no plans. A good place to do a whole lot of nothing.' },
  { id: 'lagoon', name: 'Lagoon', kind: '03 / THE BLUE-GREEN MARBLE', color: '#75cbb8', accent: '#287d9a', radius: .92, orbit: 7.6, period: 58, phase: 2.1, tilt: .035, mood: 'Endlessly curious', description: 'An ocean world with mint-green shallows and deep blue secrets. Bring a towel. Stay for the view.' },
  { id: 'halo', name: 'Halo', kind: '04 / THE SHOW-OFF', color: '#edc88c', accent: '#ad735a', radius: 1.07, orbit: 10.1, period: 84, phase: 5.8, tilt: -.025, mood: 'A little extra', description: 'Wears its favorite rings everywhere. A golden giant with a soft spot for dramatic entrances.', rings: true },
  { id: 'drift', name: 'Drift', kind: '05 / THE QUIET ONE', color: '#8cacda', accent: '#535da0', radius: .65, orbit: 12.5, period: 114, phase: 4.6, tilt: .07, mood: 'Perfectly unbothered', description: 'A tiny blue wanderer on the edge of everything. Takes the scenic route. Every single time.' },
]);

export function orbitPosition(planet, time) {
  const angle = planet.phase + (time / planet.period) * TAU;
  return { x: Math.cos(angle) * planet.orbit, y: Math.sin(angle) * planet.orbit * planet.tilt, z: Math.sin(angle) * planet.orbit };
}

// Clamp long frames so switching tabs cannot launch the simulation into the future.
export function advanceTime(time, delta, speed, paused) {
  if (paused) return time;
  return time + Math.min(Math.max(Number.isFinite(delta) ? delta : 0, 0), .1) * Math.min(3, Math.max(.25, Number.isFinite(speed) ? speed : 1));
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function cometPosition(progress, lane = 0) {
  const t = Math.min(1, Math.max(0, progress));
  return { x: -20 + 40 * t, y: 2.5 + Math.sin(t * Math.PI) * 4 + lane * .4, z: -8 + 20 * t + lane * 1.7 };
}
