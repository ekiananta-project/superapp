const CACHE_NAME = "family-superapp-v1.2.0a-budget-foundation-1";
const OFFLINE_URL = "./offline.html";

const APP_FILES = [
  "./akun-form.html",
  "./akun.html",
  "./budget.html",
  "./css/components/account-visual-picker.css",
  "./css/components/avatar.css",
  "./css/components/quote.css",
  "./css/components/finance-period.css",
  "./css/pages/akun-backend.css",
  "./css/pages/akun-form-backend.css",
  "./css/pages/akun-list-color-hotfix.css",
  "./css/pages/auth.css",
  "./css/pages/budget.css",
  "./css/pages/detail-transaksi.css",
  "./css/pages/dompet-backend.css",
  "./css/pages/dompet-detail.css",
  "./css/pages/dompet-form.css",
  "./css/pages/finance-nav-v117f.css",
  "./css/pages/family-invitation.css",
  "./css/pages/kelola-undangan.css",
  "./css/pages/home.css",
  "./css/pages/keamanan.css",
  "./css/pages/keluarga-awal.css",
  "./css/pages/keluarga-member-management.css",
  "./css/pages/keluarga-family-media.css",
  "./css/pages/keluarga-leave.css",
  "./css/pages/keluarga-dissolve.css",
  "./css/pages/keluarga-history.css",
  "./css/pages/keluarga.css",
  "./css/pages/pengaturan.css",
  "./css/pages/pengaturan-profile-media.css",
  "./css/pages/transaksi-category-picker.css",
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
  "./js/backend/finance-service.js",
  "./js/backend/finance-cache.js",
  "./js/backend/supabase.js",
  "./js/components/account-visual-picker.js",
  "./js/components/avatar.js",
  "./js/components/finance-period.js",
  "./js/components/quote.js",
  "./js/pages/account-deletion.js",
  "./js/pages/akun-backend.js",
  "./js/pages/akun-form-backend.js",
  "./js/pages/budget-backend.js",
  "./js/pages/daftar.js",
  "./js/pages/detail-transaksi-backend.js",
  "./js/pages/dompet-backend.js",
  "./js/pages/dompet-detail-backend.js",
  "./js/pages/laporan-dompet-backend.js",
  "./js/pages/dompet-form-backend.js",
  "./js/pages/home-backend.js",
  "./js/pages/keamanan.js",
  "./js/pages/keluarga-awal.js",
  "./js/pages/keluarga.js",
  "./js/pages/keluarga-media.js",
  "./js/pages/riwayat-anggota.js",
  "./js/pages/kelola-undangan.js",
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
  "./kelola-undangan.html",
  "./login.html",
  "./manifest.webmanifest",
  "./offline.html",
  "./pengaturan.html",
  "./riwayat-anggota.html",
  "./transaksi.html"
];

async function precacheFresh() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(APP_FILES.map(async path => {
    try {
      // Paksa install mengambil bytes terbaru dari origin, bukan HTTP cache lama.
      const request = new Request(path, { cache: "reload" });
      const response = await fetch(request);
      if (response && response.ok) await cache.put(request, response);
    } catch {
      // Satu asset opsional tidak boleh menggagalkan seluruh SW install.
    }
  }));
}

self.addEventListener("install", event => {
  event.waitUntil(precacheFresh().then(() => self.skipWaiting()));
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

async function navigationResponse(request) {
  const url = new URL(request.url);
  const shellKey = new Request(url.origin + url.pathname);

  try {
    // HTML harus selalu mengecek origin. Query string (mis. ?id=wallet) adalah
    // state halaman, bukan versi HTML yang layak disimpan terpisah.
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(shellKey, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(shellKey, { ignoreSearch: true });
    if (cached) return cached;
    return (await caches.match(OFFLINE_URL, { ignoreSearch: true })) || Response.error();
  }
}

async function assetResponse(request) {
  try {
    // no-cache tetap boleh validasi HTTP cache, tetapi memaksa revalidation.
    const response = await fetch(request, { cache: "no-cache" });
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return (
      (await caches.match(request)) ||
      (await caches.match(request, { ignoreSearch: true })) ||
      Response.error()
    );
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation =
    request.mode === "navigate" ||
    request.destination === "document" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/superapp/");

  event.respondWith(
    isNavigation
      ? navigationResponse(request)
      : assetResponse(request)
  );
});
