const CACHE_NAME = "family-superapp-v1.1.7-finance-3-layer-period-1";
const OFFLINE_URL = "./offline.html";

const APP_FILES = [
  "./akun-form.html",
  "./akun.html",
  "./css/components/account-visual-picker.css",
  "./css/components/avatar.css",
  "./css/components/quote.css",
  "./css/components/finance-period.css",
  "./css/components/finance-period.css?v=20260908-1",
  "./css/pages/akun-backend.css",
  "./css/pages/akun-form-backend.css",
  "./css/pages/akun-list-color-hotfix.css",
  "./css/pages/auth.css",
  "./css/pages/detail-transaksi.css",
  "./css/pages/dompet-backend.css",
  "./css/pages/dompet-detail.css",
  "./css/pages/dompet-detail.css?v=20260908-2",
  "./css/pages/dompet-form.css",
  "./css/pages/family-invitation.css",
  "./css/pages/family-invitation.css?v=20260908-2",
  "./css/pages/family-invitation.css?v=20260908-3",
  "./css/pages/family-invitation.css?v=20260908-4",
  "./css/pages/kelola-undangan.css",
  "./css/pages/kelola-undangan.css?v=20260908-1",
  "./css/pages/kelola-undangan.css?v=20260908-2",
  "./css/pages/home.css",
  "./css/pages/home.css?v=20260908-1",
  "./css/pages/keamanan.css",
  "./css/pages/keluarga-awal.css",
  "./css/pages/keluarga-member-management.css",
  "./css/pages/keluarga-member-management.css?v=20260908-2",
  "./css/pages/keluarga-family-media.css",
  "./css/pages/keluarga-family-media.css?v=20260908-1",
  "./css/pages/keluarga-leave.css",
  "./css/pages/keluarga-leave.css?v=20260908-1",
  "./css/pages/keluarga-dissolve.css",
  "./css/pages/keluarga-dissolve.css?v=20260908-1",
  "./css/pages/keluarga-history.css",
  "./css/pages/keluarga-history.css?v=20260908-1",
  "./css/pages/keluarga-history.css?v=20260908-2",
  "./css/pages/keluarga.css",
  "./css/pages/pengaturan.css",
  "./css/pages/pengaturan-profile-media.css",
  "./css/pages/pengaturan-profile-media.css?v=20260908-1",
  "./css/pages/transaksi-category-picker.css",
  "./css/pages/transaksi-category-picker.css?v=20260908-1",
  "./css/style.css",
  "./css/theme.css",
  "./daftar.html",
  "./detail-transaksi.html",
  "./dompet-detail.html",
  "./laporan-dompet.html",
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
  "./js/backend/family-service.js?v=20260908-3",
  "./js/backend/family-service.js?v=20260908-5",
  "./js/backend/family-service.js?v=20260908-6",
  "./js/backend/family-service.js?v=20260908-7",
  "./js/backend/family-service.js?v=20260908-8",
  "./js/backend/family-service.js?v=20260908-9",
  "./js/backend/finance-service.js",
  "./js/backend/finance-service.js?v=20260908-1",
  "./js/backend/finance-service.js?v=20260908-2",
  "./js/backend/finance-cache.js",
  "./js/backend/supabase.js",
  "./js/components/account-visual-picker.js",
  "./js/components/avatar.js",
  "./js/components/finance-period.js",
  "./js/components/finance-period.js?v=20260908-1",
  "./js/components/quote.js",
  "./js/pages/account-deletion.js",
  "./js/pages/akun-backend.js",
  "./js/pages/akun-form-backend.js",
  "./js/pages/daftar.js",
  "./js/pages/detail-transaksi-backend.js",
  "./js/pages/detail-transaksi-backend.js?v=20260908-1",
  "./js/pages/dompet-backend.js",
  "./js/pages/dompet-detail-backend.js",
  "./js/pages/dompet-detail-backend.js?v=20260908-2",
  "./js/pages/laporan-dompet-backend.js",
  "./js/pages/laporan-dompet-backend.js?v=20260908-1",
  "./js/pages/dompet-form-backend.js",
  "./js/pages/home-backend.js",
  "./js/pages/home-backend.js?v=20260908-6",
  "./js/pages/keamanan.js",
  "./js/pages/keluarga-awal.js",
  "./js/pages/keluarga-awal.js?v=20260908-1",
  "./js/pages/keluarga-awal.js?v=20260908-2",
  "./js/pages/keluarga-awal.js?v=20260908-3",
  "./js/pages/keluarga-awal.js?v=20260908-4",
  "./js/pages/keluarga.js",
  "./js/pages/keluarga.js?v=20260908-3",
  "./js/pages/keluarga.js?v=20260908-5",
  "./js/pages/keluarga.js?v=20260908-6",
  "./js/pages/keluarga.js?v=20260908-7",
  "./js/pages/keluarga-media.js",
  "./js/pages/keluarga-media.js?v=20260908-2",
  "./js/pages/keluarga-media.js?v=20260908-3",
  "./js/pages/keluarga-media.js?v=20260908-4",
  "./js/pages/riwayat-anggota.js",
  "./js/pages/riwayat-anggota.js?v=20260908-1",
  "./js/pages/kelola-undangan.js",
  "./js/pages/kelola-undangan.js?v=20260908-1",
  "./js/pages/kelola-undangan.js?v=20260908-2",
  "./js/pages/login.js",
  "./js/pages/pengaturan-auth.js",
  "./js/pages/pengaturan-avatar-backend-v1.js",
  "./js/pages/pengaturan-avatar-backend-v1.js?v=20260908-3",
  "./js/pages/pengaturan-profile-backend-v2.js",
  "./js/pages/pengaturan-tema.js",
  "./js/pages/transaksi-backend.js",
  "./js/pages/transaksi-backend.js?v=20260908-1",
  "./js/pwa.js",
  "./js/theme.js",
  "./keamanan.html",
  "./keluarga-awal.html",
  "./keluarga.html",
  "./kelola-undangan.html",
  "./login.html",
  "./manifest.webmanifest",
  "./offline.html",
  "./pengaturan.html",
  "./riwayat-anggota.html",
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
