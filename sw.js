// Medo service worker: lets the board open and work offline,
// while always fetching the newest version when there is internet.
const CACHE = 'medo-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  // fetch fresh copies (never the browser's HTTP cache) so a new worker never starts with old files
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) =>
    fetch(u, { cache: 'reload' }).then((r) => r.ok && c.put(u, r)).catch(() => {})
  ))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('medo') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// Headers that switch on "cross-origin isolation". Without them the voice engine may only use one
// processor core; with them it uses up to four, which makes the natural voice several times faster.
// GitHub Pages can't send these headers, so the service worker adds them to the board's own files.
// "credentialless" still lets the fonts and other sites' files load as before.
function iso(res) {
  if (!res || res.status === 0 || res.type === 'opaque' || res.type === 'opaqueredirect') return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'credentialless');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Other sites (weather, holidays, voices): straight to the network.
  if (url.origin !== self.location.origin) return;
  // Update checks (?v=…): always straight to the network, never a saved copy.
  if (url.searchParams.has('v')) return;

  // The board itself: newest version first, saved copy only when offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(url.pathname, { cache: 'no-store', credentials: 'same-origin' })
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
        .then(iso)
    );
    return;
  }

  // Voice engine files (big, rarely change): saved copy first, no background re-download.
  if (url.pathname.includes('/tts/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })).then(iso));
    return;
  }

  // Icons and the manifest: saved copy first, refreshed in the background.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    }).then(iso)
  );
});
