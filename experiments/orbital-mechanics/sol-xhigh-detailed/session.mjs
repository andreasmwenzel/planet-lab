import { circularState, hohmann, advance, impulse, orbitalElements, EARTH_RADIUS } from './physics.mjs';

export function createFlight(startAltitude = 400, targetAltitude = 2400, label = 'Training ascent') {
  const plan = hohmann(startAltitude, targetAltitude);
  return {
    mission: { startAltitude, targetAltitude, label }, plan,
    craft: circularState(startAltitude, -Math.PI / 6), phase: 'parking',
    arrivalAt: null, departedAt: null, burns: [], totalDV: 0,
  };
}

function logBurn(flight, craft, dv, description) {
  return { ...flight, craft, totalDV: flight.totalDV + Math.abs(dv), burns: [...flight.burns, { t: craft.t, dv, description, altitude: Math.hypot(craft.x, craft.y) - EARTH_RADIUS }] };
}

export function depart(flight) {
  if (flight.phase !== 'parking') throw new Error('The departure burn is only available in the parking orbit.');
  const dv = flight.plan.departureDV * 1000;
  const craft = impulse(flight.craft, Math.abs(dv), dv >= 0 ? 'prograde' : 'retrograde');
  return { ...logBurn(flight, craft, Math.abs(dv), 'Burn 1 · departure'), phase: 'transfer', departedAt: craft.t, arrivalAt: craft.t + flight.plan.coastSeconds };
}

export function propagateFlight(flight, seconds) {
  if (flight.phase === 'impact') return flight;
  let dt = seconds;
  if (flight.phase === 'transfer') dt = Math.min(dt, Math.max(0, flight.arrivalAt - flight.craft.t));
  const result = advance(flight.craft, dt);
  let phase = flight.phase;
  if (result.impacted) phase = 'impact';
  else if (phase === 'transfer' && result.state.t >= flight.arrivalAt - 1e-6) phase = 'arrival';
  return { ...flight, craft: result.state, phase };
}

export function targetAssessment(flight) {
  const el = orbitalElements(flight.craft);
  const targetRadius = EARTH_RADIUS + flight.mission.targetAltitude;
  const apsisError = Math.max(Math.abs(el.periapsis - targetRadius), Math.abs(el.apoapsis - targetRadius));
  return { success: el.bound && apsisError < 1 && el.e < 0.0002, apsisError, eccentricity: el.e };
}

export function circularize(flight) {
  if (flight.phase !== 'arrival') throw new Error('Coast to the arrival point before the second burn.');
  const dv = flight.plan.arrivalDV * 1000;
  const craft = impulse(flight.craft, Math.abs(dv), dv >= 0 ? 'prograde' : 'retrograde');
  const updated = logBurn(flight, craft, Math.abs(dv), 'Burn 2 · circularization');
  return { ...updated, phase: targetAssessment(updated).success ? 'achieved' : 'free', arrivalAt: null };
}

export function manualBurn(flight, dv, direction) {
  if (flight.phase === 'impact') throw new Error('Reset or undo to recover from impact.');
  if (!Number.isFinite(dv) || dv < 1 || dv > 2500) throw new RangeError('Choose a manual impulse from 1 to 2,500 m/s.');
  const craft = impulse(flight.craft, dv, direction);
  const names = { prograde: 'along velocity', retrograde: 'against velocity', outward: 'radially out', inward: 'radially in' };
  return { ...logBurn(flight, craft, dv, `Manual · ${names[direction]}`), phase: 'free', arrivalAt: null };
}
