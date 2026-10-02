import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

test('shell retains opaque-origin iframe and CSP validation', () => {
 assert.match(main, /setAttribute\('sandbox', 'allow-scripts'\)/);
 assert.doesNotMatch(main, /allow-same-origin/);
 assert.match(main, /html\.includes\('Content-Security-Policy'\)/);
 assert.match(main, /safeRuntimePath\(run\.runtime\)/);
 assert.match(main, /signal\.aborted/);
});
test('one artifact frame is replaced when switching, never multiplied', () => {
 assert.equal((main.match(/document\.createElement\('iframe'\)/g)||[]).length, 1);
 assert.match(main, /replaceChildren\(frame\)/);
 assert.match(main, /loadedRuntime !== selected\.id/);
});
test('work-first homepage uses real builds rather than decorative mockups', () => {
 assert.match(main, /viewer\(selected\)/);
 assert.match(main, /plannedRunCount\(comparisonPlan\)/);
 assert.doesNotMatch(main, /futureIdeas|orbit-art|hero-note|manifesto-strip/);
 assert.match(main, /post\(exp, route\.page === 'experiment'\)/);
});
test('mobile safe areas, reduced motion, and clear focus are covered', () => {
 assert.match(styles, /env\(safe-area-inset-bottom\)/);
 assert.match(styles, /prefers-reduced-motion/);
 assert.match(styles, /focus-visible/);
 assert.match(styles, /max-width:540px/);
});
