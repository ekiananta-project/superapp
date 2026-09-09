(() => {
  "use strict";

  let deferredPrompt = null;

  function isStandalone() {
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true
    );
  }

  async function install() {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;

    window.dispatchEvent(
      new CustomEvent("family-pwa-install-result", {
        detail: { outcome: choice?.outcome || "unknown" }
      })
    );

    return choice?.outcome === "accepted";
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;

    window.dispatchEvent(
      new CustomEvent("family-pwa-installable")
    );
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent("family-pwa-installed"));
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("./sw.js?v=20260909-e4a", {
          scope: "./"
        });

        // Cek versi baru tanpa mengganggu startup aplikasi.
        registration.update().catch(() => {});

        // Saat aplikasi kembali aktif, cek build baru lagi. Ini membantu PWA
        // yang dibiarkan terbuka lama agar tidak hidup dengan shell lama.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });
      } catch (error) {
        console.warn("[PWA] Service worker gagal didaftarkan.", error);
      }
    });
  }

  // Browser/PWA dapat mengembalikan dokumen lama dari Back-Forward Cache tanpa
  // meminta HTML baru. Saat itu halaman terlihat seperti belum menerima patch
  // sampai user refresh manual. Jika page benar-benar dipulihkan dari bfcache,
  // reload sekali agar shell, CSS, dan bottom-nav berasal dari build aktif.
  window.addEventListener("pageshow", event => {
    if (event.persisted) {
      location.reload();
    }
  });

  // skipWaiting + clients.claim membuat SW baru bisa mengambil alih tab yang
  // sedang terbuka. Reload hanya sekali ketika controller benar-benar berganti.
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    const key = "family_pwa_controller_reload";
    const now = Date.now();
    const last = Number(sessionStorage.getItem(key) || 0);
    if (now - last < 10000) return;
    sessionStorage.setItem(key, String(now));
    location.reload();
  });


  function setupDoubleBackExit() {
    if (!isStandalone()) return;

    const path = location.pathname.replace(/\/+$/, "");
    const isHome = path.endsWith("/index.html") || path.endsWith("/superapp") || path === "";
    if (!isHome) return;

    let armedUntil = 0;
    let allowExit = false;

    const toast = document.createElement("div");
    toast.setAttribute("role", "status");
    toast.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:max(28px, env(safe-area-inset-bottom))",
      "transform:translateX(-50%) translateY(20px)",
      "z-index:99999",
      "padding:11px 16px",
      "border-radius:999px",
      "background:rgba(30,33,31,.96)",
      "color:#fff",
      "font:600 14px/1.3 Manrope,system-ui,sans-serif",
      "box-shadow:0 8px 24px rgba(0,0,0,.35)",
      "opacity:0",
      "pointer-events:none",
      "transition:.18s ease",
      "white-space:nowrap"
    ].join(";");
    toast.textContent = "Geser kembali sekali lagi untuk keluar";
    document.body.appendChild(toast);

    let hideTimer = null;
    function showExitToast() {
      clearTimeout(hideTimer);
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
      hideTimer = setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(20px)";
      }, 1800);
    }

    history.pushState({ familyExitGuard: true }, "", location.href);

    window.addEventListener("popstate", () => {
      if (allowExit) return;

      const now = Date.now();
      if (now < armedUntil) {
        allowExit = true;
        history.back();
        return;
      }

      armedUntil = now + 2000;
      showExitToast();
      history.pushState({ familyExitGuard: true }, "", location.href);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupDoubleBackExit, { once: true });
  } else {
    setupDoubleBackExit();
  }

  window.FamilyPWA = {
    install,
    isStandalone,
    get installable() {
      return Boolean(deferredPrompt);
    }
  };
})();
