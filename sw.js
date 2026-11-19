// Bump this cache name for each app-shell release. Bank updates need no SW change.
const SHELL = 'cert-practice-shell-v1';
const FILES = ['./', './index.html', './styles.css', './app.js', './core.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(FILES)));
  // No skipWaiting: an open attempt keeps its current app code until all tabs close.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('cert-practice-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url), base = new URL(self.registration.scope);
  if (event.request.method !== 'GET' || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
  // Content is downloaded and validated by core.js, then atomically cached in
  // device storage. Never serve stale network JSON that could hide a bad update.
  if (url.pathname.startsWith(new URL('./content/', base).pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(SHELL).then(cache => cache.match('./index.html')).then(cached => cached || fetch(event.request)));
  } else {
    event.respondWith(caches.open(SHELL).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request)));
  }
});
