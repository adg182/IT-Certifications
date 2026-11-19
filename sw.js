// Bump this cache name for each app-shell release. Bank updates need no SW change.
const SHELL = 'cert-practice-shell-v7';
const FILES = ['./', './index.html', './styles.css', './theme.js', './app.js', './flashcards.js', './flashcards/aws-services.json', './flashcards/security-plus-sy0-701.json', './core.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(installShell());
});

async function installShell() {
  const cache = await caches.open(SHELL);
  // Fetch the full release before taking over, including in browsers with older cached files.
  await cache.addAll(FILES.map(path => new Request(new URL(path, self.registration.scope), {cache: 'reload'})));
  // The next navigation uses the new shell. Existing pages are not reloaded.
  await self.skipWaiting();
}
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
