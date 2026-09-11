const CACHE_NAME = "ruangkitha-v2.0.0a44-calendar-events-holidays";
const OFFLINE_URL = "./offline.html";

const APP_FILES = [
  "./akun-form.html",
  "./akun.html",
  "./budget.html",
  "./perencanaan.html",
  "./kelola.html",
  "./tagihan.html",
  "./css/components/account-visual-picker.css",
  "./css/components/avatar.css",
  "./css/components/avatar-preview-dialog.css",
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
  "./css/pages/home-report-entry.css",
  "./css/pages/laporan-finance.css",
  "./css/pages/keamanan.css",
  "./css/pages/keluarga-awal.css",
  "./css/pages/keluarga-member-management.css",
  "./css/pages/keluarga-family-media.css",
  "./css/pages/keluarga-leave.css",
  "./css/pages/keluarga-dissolve.css",
  "./css/pages/keluarga-history.css",
  "./css/pages/keluarga.css",
  "./css/pages/pengaturan.css",
  "./css/pages/perencanaan.css",
  "./css/pages/tagihan.css",
  "./css/pages/pengaturan-profile-media.css",
  "./css/pages/transaksi-category-picker.css",
  "./css/style.css",
  "./css/theme.css",
  "./daftar.html",
  "./detail-transaksi.html",
  "./dompet-detail.html",
  "./laporan-dompet.html",
  "./laporan.html",
  "./dompet-form.html",
  "./dompet.html",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-192-v2.png",
  "./icons/icon-512-v2.png",
  "./index.html",
  "./catatan.html",
  "./catatan-keluarga.html",
  "./catatan-pribadi.html",
  "./catatan-anggota.html",
  "./catatan-folder.html",
  "./catatan-editor.html",
  "./catatan-checklist.html",
  "./catatan-arsip.html",
  "./catatan-relasi.html",
  "./css/pages/catatan-home.css",
  "./css/pages/catatan-area.css",
  "./css/pages/catatan-editor.css",
  "./css/pages/catatan-checklist.css",
  "./css/pages/catatan-management.css",
  "./css/pages/catatan-stabilization.css",
  "./css/pages/catatan-relasi.css",
  "./js/pages/catatan-home.js",
  "./js/pages/catatan-family.js",
  "./js/pages/catatan-personal.js",
  "./js/pages/catatan-member.js",
  "./js/pages/catatan-folder.js",
  "./js/pages/catatan-editor.js",
  "./js/pages/catatan-checklist.js",
  "./js/pages/catatan-management.js",
  "./js/pages/catatan-performance.js",
  "./js/pages/catatan-related.js",
  "./js/pages/catatan-relasi.js",
  "./js/pages/catatan-archive.js",
  "./js/pages/catatan-reminder-runtime.js",
  "./finance.html",
  "./kalender.html",
  "./profil.html",
  "./css/pages/superapp-home.css",
  "./css/pages/superapp-shell.css",
  "./css/pages/calendar.css",
  "./css/pages/finance-container.css",
  "./js/pages/superapp-home.js",
  "./js/pages/superapp-home-lottie.js",
  "./assets/lottie/today-family.json",
  "./assets/lottie/catatan-empty-notes-light.lottie",
  "./assets/lottie/catatan-empty-notes-dark.lottie",
  "./assets/lottie/catatan-empty-folders-light.lottie",
  "./assets/lottie/catatan-empty-folders-dark.lottie",
  "./assets/lottie/catatan-private-lock.lottie",
  "./assets/lottie/catatan-private-lock-light.lottie",
  "./assets/lottie/catatan-private-lock-dark.lottie",
  "./js/pages/superapp-calendar.js",
  "./js/backend/calendar-event-service.js",
  "./js/pages/calendar-source-deeplink.js",
  "./js/pages/superapp-profile-shell.js",
  "./js/app.js",
  "./js/backend/auth-guard.js",
  "./js/backend/auth-router.js",
  "./js/backend/auth-service.js",
  "./js/backend/family-service.js",
  "./js/backend/notes-service.js",
  "./js/backend/finance-service.js",
  "./js/backend/finance-cache.js",
  "./js/backend/finance-member-access.js",
  "./js/pages/category-member-mode.js",
  "./js/pages/keluarga-awal-route-fix.js",
  "./js/pages/superapp-module-order.js",
  "./js/backend/supabase.js",
  "./js/components/account-visual-picker.js",
  "./js/components/avatar.js",
  "./js/components/avatar-preview-dialog.js",
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
  "./js/pages/laporan-finance-backend.js",
  "./js/vendor/family-xlsx.js",
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
  "./js/pages/tagihan-backend.js",
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
          .filter(key => (key.startsWith("family-superapp-") || key.startsWith("ruangkitha-")) && key !== CACHE_NAME)
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


// a40: system notification yang dipicu saat Catatan/PWA aktif dapat membuka
// Reminder tujuan melalui service worker notification surface. Ini bukan
// background scheduler; due-check tetap dilakukan client ketika app aktif.
self.addEventListener("notificationclick", event => {
  event.notification?.close();
  const target = event.notification?.data?.url;
  if (!target) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
