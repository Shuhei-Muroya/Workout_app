// LiftLog Service Worker
// ・アプリ本体（index.html など）は「ネット優先」：通常は常に最新版、電波がないときだけ保存済みの版を表示
// ・CDNのライブラリやフォントは「保存済みを優先しつつ裏で更新」
// ・Firebase のログインや同期の通信には一切触らない
const CACHE = 'liftlog-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'];
const CDN_HOSTS = ['cdn.tailwindcss.com', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isFirebaseSdk = (url) => url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 同じサイトのファイル：ネット優先
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }

  // ライブラリ・フォント・Firebase SDK：保存済みを優先しつつ裏で更新
  if (CDN_HOSTS.includes(url.hostname) || isFirebaseSdk(url)) {
    e.respondWith(
      caches.open(CACHE).then((c) => c.match(req).then((hit) => {
        const update = fetch(req)
          .then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; })
          .catch(() => hit);
        return hit || update;
      })),
    );
  }
  // それ以外（Firebase の認証・データベース通信など）は何もしない
});
