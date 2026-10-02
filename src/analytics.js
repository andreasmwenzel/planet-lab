import { inject, pageview } from '@vercel/analytics';
import { parseRoute } from './lab.js';

// Keep this allowlist in sync with published posts. Never forward arbitrary
// slugs, variant/filter query strings, or unknown hashes to analytics.
const publicPaths = new Set(['/', '/about', '/experiments/planetary', '/experiments/orbital-mechanics', '/not-found']);
const activeTrackers = new WeakMap();

export function analyticsPath(hash) {
  const route = parseRoute(hash);
  if (route.page === 'home') return '/';
  if (route.page === 'about') return '/about';
  if (route.page === 'experiment' && publicPaths.has(`/experiments/${route.id}`)) {
    return `/experiments/${route.id}`;
  }
  return '/not-found';
}

export function sanitizePageview(event) {
  if (event.type !== 'pageview') return null;
  try {
    const url = new URL(event.url);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.pathname = publicPaths.has(url.pathname) ? url.pathname : '/not-found';
    url.search = '';
    url.hash = '';
    return { ...event, url: url.href };
  } catch {
    return null;
  }
}

export function startAnalytics({
  browser = globalThis.window,
  enabled = Boolean(import.meta.env?.PROD),
  injectAnalytics = inject,
  sendPageview = pageview,
} = {}) {
  // Local development/preview and embedded artifacts must not send analytics.
  if (!enabled || !browser || browser.self !== browser.top ||
      /^(localhost|127(?:\.\d+){3}|\[::1\])$/.test(browser.location.hostname)) return () => {};
  if (activeTrackers.has(browser)) return activeTrackers.get(browser);

  // Hash navigation is not pushState navigation. Disable automatic page views
  // and use the SDK's pageview API, as Vercel's framework adapters do.
  injectAnalytics({ mode: 'production', disableAutoTrack: true, beforeSend: sanitizePageview });
  let lastPath;
  const trackPage = event => {
    const hash = event?.newURL ? new URL(event.newURL).hash : browser.location.hash;
    const path = analyticsPath(hash);
    if (path === lastPath) return;
    lastPath = path;
    sendPageview({ path, route: path });
  };
  const stop = () => {
    browser.removeEventListener('hashchange', trackPage);
    activeTrackers.delete(browser);
  };
  activeTrackers.set(browser, stop);
  browser.addEventListener('hashchange', trackPage);
  trackPage();
  return stop;
}

startAnalytics();
