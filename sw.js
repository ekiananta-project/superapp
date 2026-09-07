const CACHE_NAME = "family-superapp-v1.0.6";
const OFFLINE_URL = "./offline.html";

const APP_FILES = [
  "./akun-form.html",
  "./akun.html",
  "./css/components/account-visual-picker.css",
  "./css/components/avatar.css",
  "./css/components/quote.css",
  "./css/pages/akun-backend.css",
  "./css/pages/akun-form-backend.css",
  "./css/pages/akun-list-color-hotfix.css",
  "./css/pages/auth.css",
  "./css/pages/detail-transaksi.css",
  "./css/pages/dompet-backend.css",
  "./css/pages/dompet-detail.css",
  "./css/pages/dompet-form.css",
  "./css/pages/family-invitation.css",
  "./css/pages/home.css",
  "./css/pages/keamanan.css",
  "./css/pages/keluarga-awal.css",
  "./css/pages/keluarga-member-management.css",
  "./css/pages/keluarga.css",
  "./css/pages/pengaturan.css",
  "./css/style.css",
  "./css/theme.css",
  "./daftar.html",
  "./detail-transaksi.html",
  "./dompet-detail.html",
  "./dompet-form.html",
  "./dompet.html",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-192-v2.png",
  "./icons/icon-512-v2.png",
  "./index.html",
  "./js/app.js",
  "./js/backend/auth-guard.js",
  "./js/backend/auth-router.js",
  "./js/backend/auth-service.js",
  "./js/backend/family-service.js",
  "./js/backend/finance-service.js",
  "./js/backend/finance-cache.js",
  "./js/backend/supabase.js",
  "./js/components/account-visual-picker.js",
  "./js/components/avatar.js",
  "./js/components/quote.js",
  "./js/pages/account-deletion.js",
  "./js/pages/akun-backend.js",
  "./js/pages/akun-form-backend.js",
  "./js/pages/daftar.js",
  "./js/pages/detail-transaksi-backend.js",
  "./js/pages/dompet-backend.js",
  "./js/pages/dompet-detail-backend.js",
  "./js/pages/dompet-form-backend.js",
  "./js/pages/home-backend.js",
  "./js/pages/keamanan.js",
  "./js/pages/keluarga-awal.js",
  "./js/pages/keluarga.js",
  "./js/pages/login.js",
  "./js/pages/pengaturan-auth.js",
  "./js/pages/pengaturan-avatar-backend-v1.js",
  "./js/pages/pengaturan-profile-backend-v2.js",
  "./js/pages/pengaturan-tema.js",
  "./js/pages/transaksi-backend.js",
  "./js/pwa.js",
  "./js/theme.js",
  "./keamanan.html",
  "./keluarga-awal.html",
  "./keluarga.html",
  "./login.html",
  "./manifest.webmanifest",
  "./offline.html",
  "./pengaturan.html",
  "./transaksi.html"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("family-superapp-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jangan pernah cache request Supabase, CDN, font, atau origin eksternal.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === "navigate") {
          return caches.match(OFFLINE_URL);
        }

        return Response.error();
      })
  );
});
