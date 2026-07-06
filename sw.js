// Service worker — офлайн-кэш Трекера Задач.
// При изменении кэшируемых файлов поднимать версию CACHE — старый кэш удалится в activate.
const CACHE = 'todo-tracker-v2';

// Пути относительные (./) — важно для GitHub Pages (/todo-list/).
const ASSETS = [
  './',
  './index.html',
  './script.js',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

// Прекэш оболочки приложения
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Чистка старых версий кэша
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Стратегия cache-first с фолбэком в сеть.
// Только GET; чужие домены (напр. Google Fonts) не перехватываем принудительно.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          // кэшируем успешные ответы того же origin (для шрифтов/будущих файлов)
          if (resp.ok && new URL(req.url).origin === self.location.origin) {
            const copy = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return resp;
        })
        .catch(() => cached); // офлайн и нет в кэше — вернём undefined
    })
  );
});
