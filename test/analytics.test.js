import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyticsPath, sanitizePageview, startAnalytics } from '../src/analytics.js';

function fixture(hash = '#/', hostname = 'planet-lab.vercel.app') {
  const listeners = new Map();
  const browser = {
    location: { hash, hostname },
    addEventListener: (event, listener) => listeners.set(event, listener),
    removeEventListener: (event, listener) => {
      if (listeners.get(event) === listener) listeners.delete(event);
    },
  };
  browser.self = browser;
  browser.top = browser;
  const calls = [], injections = [];
  const options = { browser, enabled: true, injectAnalytics: options => injections.push(options), sendPageview: page => calls.push(page) };
  const navigate = nextHash => {
    browser.location.hash = nextHash;
    listeners.get('hashchange')?.({ newURL: `https://${hostname}/${nextHash}` });
  };
  return { browser, calls, injections, listeners, options, navigate };
}

test('analytics distinguishes the journal, method, and published experiment', () => {
  for (const hash of ['', '#/', '#/journal', '#/?variant=luna-medium-minimal']) {
    assert.equal(analyticsPath(hash), '/');
  }
  assert.equal(analyticsPath('#/method'), '/about');
  assert.equal(analyticsPath('#/about'), '/about');
  assert.equal(analyticsPath('#/experiments/orbital-mechanics?variant=luna-medium-minimal&view=charts&metric=api'), '/experiments/orbital-mechanics');
  assert.equal(analyticsPath('#/experiments/planetary?variant=astra-xhigh-bold&model=Astra'), '/experiments/planetary');
});

test('unknown routes are grouped without forwarding arbitrary path or query data', () => {
  for (const hash of ['#/private/token', '#/experiments/private-name', '#/method/private', '#/anything?email=private@example.com']) {
    assert.equal(analyticsPath(hash), '/not-found');
  }
});

test('beforeSend strips query strings and hashes and rejects custom events', () => {
  const input = { type: 'pageview', url: 'https://planet-lab.vercel.app/experiments/planetary?token=secret#private' };
  assert.deepEqual(sanitizePageview(input), { type: 'pageview', url: 'https://planet-lab.vercel.app/experiments/planetary' });
  assert.equal(input.url.includes('token=secret'), true, 'does not mutate the SDK event');
  assert.equal(sanitizePageview({ type: 'pageview', url: 'https://planet-lab.vercel.app/private-name?email=private@example.com' }).url, 'https://planet-lab.vercel.app/not-found');
  assert.equal(sanitizePageview({ type: 'event', url: input.url }), null);
  assert.equal(sanitizePageview({ type: 'pageview', url: 'invalid' }), null);
  assert.equal(sanitizePageview({ type: 'pageview', url: 'file:///private' }), null);
});

test('one initial view is queued after injecting with automatic views disabled', () => {
  const state = fixture('#/experiments/planetary?variant=luna-max-minimal');
  const stop = startAnalytics(state.options);
  assert.equal(state.injections.length, 1);
  assert.deepEqual(state.injections[0], { mode: 'production', disableAutoTrack: true, beforeSend: sanitizePageview });
  assert.deepEqual(state.calls, [{ path: '/experiments/planetary', route: '/experiments/planetary' }]);
  stop();
});

test('the installed Vercel SDK injects one script and queues sanitized manual page views', () => {
  const state = fixture('#/experiments/planetary?variant=luna-max-minimal');
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  const scripts = [];
  globalThis.window = state.browser;
  globalThis.document = {
    head: { querySelector: () => scripts[0], appendChild: script => scripts.push(script) },
    createElement: tag => {
      assert.equal(tag, 'script');
      return { dataset: {} };
    },
  };
  let stop;
  try {
    stop = startAnalytics({ browser: state.browser, enabled: true });
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].src, '/_vercel/insights/script.js');
    assert.equal(scripts[0].dataset.disableAutoTrack, '1');
    assert.equal(scripts[0].defer, true);
    assert.equal(state.browser.vaq[0][0], 'beforeSend');
    assert.equal(state.browser.vaq[0][1], sanitizePageview);
    assert.deepEqual(state.browser.vaq[1], ['pageview', { path: '/experiments/planetary', route: '/experiments/planetary' }]);
    state.navigate('#/experiments/planetary?variant=astra-xhigh-bold');
    assert.equal(state.browser.vaq.length, 2);
    state.navigate('#/method');
    assert.deepEqual(state.browser.vaq[2], ['pageview', { path: '/about', route: '/about' }]);
  } finally {
    stop?.();
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
  }
});

test('hash transitions count pages and Back/Forward returns, not build/filter changes', () => {
  const state = fixture();
  const stop = startAnalytics(state.options);
  state.navigate('#/experiments/planetary');
  state.navigate('#/experiments/planetary?variant=luna-medium-minimal');
  state.navigate('#/experiments/planetary?variant=astra-xhigh-bold&model=Astra');
  state.navigate('#/method');
  state.navigate('#/experiments/planetary?variant=luna-medium-minimal');
  state.navigate('#/');
  state.navigate('#/journal');
  assert.deepEqual(state.calls.map(page => page.path), ['/', '/experiments/planetary', '/about', '/experiments/planetary', '/']);
  stop();
});

test('rapid hash changes use each event URL, not a newer window location', () => {
  const state = fixture();
  const stop = startAnalytics(state.options);
  state.browser.location.hash = '#/method';
  state.listeners.get('hashchange')({ newURL: 'https://planet-lab.vercel.app/#/experiments/planetary' });
  state.listeners.get('hashchange')({ newURL: 'https://planet-lab.vercel.app/#/method' });
  assert.deepEqual(state.calls.map(page => page.path), ['/', '/experiments/planetary', '/about']);
  stop();
});

test('initialization is idempotent and its listener can be cleaned up', () => {
  const state = fixture();
  const stop = startAnalytics(state.options);
  assert.equal(startAnalytics(state.options), stop);
  assert.equal(state.injections.length, 1);
  assert.equal(state.calls.length, 1);
  stop();
  state.navigate('#/method');
  assert.equal(state.calls.length, 1);
  assert.equal(state.listeners.size, 0);
});

test('development, local previews, absent browsers, and frames do not inject analytics', () => {
  const development = fixture();
  startAnalytics({ ...development.options, enabled: false });
  assert.equal(development.injections.length, 0);
  for (const hostname of ['localhost', '127.0.0.1', '127.0.0.2', '[::1]']) {
    const local = fixture('#/', hostname);
    startAnalytics(local.options);
    assert.equal(local.injections.length, 0);
  }
  const embedded = fixture();
  embedded.browser.top = {};
  startAnalytics(embedded.options);
  assert.equal(embedded.injections.length, 0);
  assert.doesNotThrow(() => startAnalytics({ enabled: true, browser: undefined }));
});

test('analytics is included once in the journal shell, never in the runtime bundler', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const bundler = await readFile(new URL('../scripts/build-runtimes.mjs', import.meta.url), 'utf8');
  assert.equal((html.match(/src="\/src\/analytics\.js"/g) || []).length, 1);
  assert.doesNotMatch(bundler, /@vercel\/analytics|src\/analytics/);
  assert.match(bundler, /connect-src 'none'/);
});

test('standalone routes group under known experiments without exposing run identifiers', () => {
 assert.equal(analyticsPath('#/results/planetary/luna-medium-minimal'), '/experiments/planetary');
 assert.equal(analyticsPath('#/results/orbital-mechanics/luna-medium-minimal'), '/experiments/orbital-mechanics');
 assert.equal(analyticsPath('#/results/private-name/private-run'), '/not-found');
});
