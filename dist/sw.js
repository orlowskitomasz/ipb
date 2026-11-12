// Service worker IPB: aplikacja działa bez sieci po pierwszym otwarciu z serwera.
// Najpierw sieć (żeby nowa wersja docierała od razu), a gdy sieci nie ma – kopia z pamięci podręcznej.
// Ścieżki /__* (logowanie i synchronizacja) nigdy nie są przechwytywane ani zapamiętywane.
const PAMIEC = 'ipb-447202582c9d';
const PLIKI = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(PAMIEC).then((c) => c.addAll(PLIKI)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== PAMIEC).map((n) => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/__')) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const k = r.clone(); caches.open(PAMIEC).then((c) => c.put(e.request, k)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
