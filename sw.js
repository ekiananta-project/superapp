const CACHE_NAME = "ruangkitha-v2.0.0a48f-logo-app-icon-integration-v1";
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
  "./css/ruangkitha-design-system-v1.css",
  "./css/ruangkitha-shell-v1.css",
  "./css/pages/ruangkitha-finance-v1.css",
  "./css/pages/ruangkitha-catatan-v1.css",
  "./css/pages/ruangkitha-calendar-notification-v1.css",
  "./css/pages/ruangkitha-profile-auth-family-v1.css",
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
  "./icons/notification-badge-96.png",
  "./icons/maskable-512-v3.png",
  "./icons/monochrome-512-v3.png",
  "./icons/icon-192-v3.png",
  "./icons/icon-512-v3.png",
  "./assets/brand/ruangkitha-symbol.png",
  "./assets/brand/ruangkitha-symbol-256.png",
  "./assets/brand/ruangkitha-wordmark.png",
  "./assets/brand/ruangkitha-logo-light.png",
  "./assets/brand/ruangkitha-logo-dark.png",
  "./assets/brand/ruangkitha-monochrome-dark.png",
  "./assets/brand/ruangkitha-monochrome-light.png",
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
  "./css/pages/catatan-reminder-guard.css",
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
  "./notifikasi.html",
  "./css/pages/notifications.css",
  "./js/backend/notification-service.js",
  "./js/pages/notification-health.js",
  "./js/pages/notification-badge.js",
  "./js/pages/notifications.js",
  "./profil.html",
  "./css/pages/superapp-home.css",
  "./css/pages/superapp-shell.css",
  "./css/pages/calendar.css",
  "./css/pages/finance-container.css",
  "./js/pages/superapp-home.js",
  "./js/pages/superapp-home-lottie.js",
  "./js/pages/superapp-home-lottie-palette.js",
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
  event.waitUntil(precacheFresh());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
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


// v2.0.0a46f: resolve notification targets against the service-worker scope.
// GitHub Pages hosts RuangKitha under /superapp/, so origin-only resolution would
// incorrectly open https://host/catatan-editor.html and produce a 404.
function resolveNotificationTarget(rawTarget) {
  const scopeBase = new URL(self.registration?.scope || "./", self.location.href);
  const fallback = new URL("kalender.html", scopeBase);
  const raw = String(rawTarget || "").trim();
  if (!raw) return fallback.href;

  try {
    let resolved = new URL(raw, scopeBase);
    if (resolved.origin !== scopeBase.origin) return fallback.href;

    const scopePath = scopeBase.pathname.endsWith("/")
      ? scopeBase.pathname
      : `${scopeBase.pathname}/`;

    // Repair legacy same-origin URLs that were accidentally anchored at `/`.
    if (!resolved.pathname.startsWith(scopePath)) {
      const leafPath = resolved.pathname.replace(/^\/+/, "");
      resolved = new URL(`${leafPath}${resolved.search}${resolved.hash}`, scopeBase);
    }
    return resolved.href;
  } catch {
    return fallback.href;
  }
}

// v2.0.0a46f: background Web Push payload from the centralized Notification Scheduler.
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data?.json?.() || {}; } catch {
    try { payload = { body: event.data?.text?.() || "" }; } catch {}
  }
  const title = String(payload.title || "Pengingat RuangKitha");
  const notificationId = String(payload.notificationId || "");
  let target = resolveNotificationTarget(payload.url || "kalender.html");
  try {
    const url = new URL(target);
    if (notificationId) url.searchParams.set("rk_notification", notificationId);
    target = url.href;
  } catch { target = resolveNotificationTarget("kalender.html"); }

  const options = {
    body: String(payload.body || "Ada agenda yang perlu diperhatikan."),
    tag: String(payload.tag || `ruangkitha-${notificationId || Date.now()}`),
    renotify: false,
    lang: "id-ID",
    icon: "./icons/icon-192-v3.png",
    badge: "./icons/notification-badge-96.png",
    actions: [{ action: "open", title: String(payload.actionTitle || "Buka") }],
    data: { url: target, notificationId }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification clicks always deep-link to the original Calendar source.
// v2.0.0a46 background scheduling is handled by the centralized server dispatcher.
self.addEventListener("notificationclick", event => {
  event.notification?.close();
  if (event.action && event.action !== "open") return;
  const rawTarget = event.notification?.data?.url;
  if (!rawTarget) return;
  const target = resolveNotificationTarget(rawTarget);
  event.waitUntil((async () => {
    const scopeUrl = new URL(self.registration.scope);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const inScope = windows.filter(client => {
      try {
        const url = new URL(client.url);
        return url.origin === scopeUrl.origin && url.pathname.startsWith(scopeUrl.pathname);
      } catch { return false; }
    });
    const preferred = inScope.find(client => client.visibilityState === "visible") || inScope[0];
    if (preferred) {
      try { if ("navigate" in preferred) await preferred.navigate(target); } catch {}
      try { if ("focus" in preferred) await preferred.focus(); } catch {}
      return;
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
