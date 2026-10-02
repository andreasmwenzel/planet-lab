import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
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
 assert.match(main, /loadedRuntime !== `\$\{selected\.experimentId\}\/\$\{selected\.id\}`/);
});
test('homepage is a post index and the simulator stays inside its post', () => {
 assert.match(main, /viewer\(selected\)/);
 assert.match(main, /plannedRunCount\(exp\.plan\)/);
 assert.doesNotMatch(main, /futureIdeas|orbit-art|hero-note|manifesto-strip/);
 assert.match(main, /main\.innerHTML = journalIndex\(\)/);
 assert.match(main, /main\.innerHTML = post\(exp\)/);
 const index = main.slice(main.indexOf('function journalIndex'), main.indexOf('function post('));
 assert.doesNotMatch(index, /viewer-container|picker|iframe/);
 assert.match(index, /post-list-item/);
});
test('mobile safe areas, reduced motion, and clear focus are covered', () => {
 assert.match(styles, /env\(safe-area-inset-bottom\)/);
 assert.match(styles, /prefers-reduced-motion/);
 assert.match(styles, /focus-visible/);
 assert.match(styles, /max-width:540px/);
});


test('shell omits redundant subtitles and control commentary', () => {
 const shell = main + html;
 for (const copy of [
  'Restart resets the simulation',
  'Controlled run · isolated frame',
  'isolated frame',
  'One idea at a time. The builds and their records stay together.',
  'A cell is a recorded run. Selecting one never starts a new generation.',
  'Choose a cell to load that version.',
  'The shell doesn’t alter the model’s design.',
  'Things made with AI, with the prompts, different attempts, and notes kept alongside them.',
  'The exact prompt, the recorded setup, and the evidence we have.',
  'Now playing',
 ]) assert.equal(shell.includes(copy), false, `Unnecessary copy returned: ${copy}`);
 assert.doesNotMatch(main, /runtime-caption|selector-help|selection-note|selection-facts|matrix-note/);
});

test('controls use text or CSS shapes rather than special icon glyphs', () => {
 assert.doesNotMatch(main, /⤢|↻|●/);
 assert.match(main, /id="restart-runtime"[^>]*>Restart<\/button>/);
 assert.match(main, /id="expand-runtime"[^>]*>Expand<\/button>/);
 assert.match(styles, /\.condition-mark\{/);
});

test('copy edits preserve exact prompts, honest evidence, and the WebGL fallback', () => {
 assert.match(main, /e\(message\.content\)/);
 assert.match(main, /e\(score\.evidence\)/);
 assert.match(main, /3D browser behavior not verified/);
 assert.match(main, /No rendered editorial rating yet/);
 assert.match(main, /Use a browser with working WebGL 2 to play/);
 const index = main.slice(main.indexOf('function journalIndex'), main.indexOf('function post('));
 const post = main.slice(main.indexOf('function post('), main.indexOf('function about('));
 assert.match(index, /experimentHref\(exp\.id\)/);
 assert.doesNotMatch(index, /viewer-container|run-record|picker|iframe/);
 assert.match(post, /id="viewer-container"/);
 assert.match(post, /id="run-record"/);
});

test('posts use their own title, date, category, matrix and filtered run records', async () => {
 const content = await readFile(new URL('../src/content/experiments.js', import.meta.url), 'utf8');
 const loader = await readFile(new URL('../src/content/generated-runs.js', import.meta.url), 'utf8');
 const index = main.slice(main.indexOf('function journalIndex'),main.indexOf('function post('));
 for(const property of ['title','date','category','excerpt','plan']) assert.match(index,new RegExp(`exp\\.${property}`));
 assert.match(content,/id: 'orbital-mechanics'/);
 assert.match(content,/basePrompt: 'Build an in-browser orbital mechanics simulator'/);
 assert.match(loader,/experiments\/\*\/\*\/metadata\.json/);
 assert.match(main,/requiresWebGL2 === true/);
});
test('Charts disposes the active artifact; unchanged Simulator selection retains it', () => {
 const charts = main.slice(main.indexOf('function showCharts'),main.indexOf('function implementationHtml'));
 assert.match(charts,/controller\?\.abort\(\); loadedRuntime = null/);
 assert.match(charts,/container\.innerHTML = chartsHtml/);
 assert.doesNotMatch(charts,/createElement\('iframe'\)/);
 assert.match(main,/else if \(loadedRuntime !==/);
 assert.match(main,/button\.dataset\.view, route\.metric/);
});
test('What this is is two short paragraphs, with no standalone Method navigation', () => {
 const about = main.slice(main.indexOf('function about('),main.indexOf('function picker('));
 assert.equal((about.match(/<p>/g)||[]).length,2);
 assert.match(about,/href="https:\/\/github.com\/andreasmwenzel\/planet-lab"/);
 assert.doesNotMatch(about,/Andreas/);
 assert.match(html,/href="#\/about"/);
 assert.doesNotMatch(html,/Method|#\/method/);
});
