(() => {
  "use strict";

  const RK_DESIGN_SYSTEM_VERSION = "1.0.1";
  const RK_BUILD_VERSION = "v2.0.0a48a";

  function appBaseUrl() {
    try {
      const script = document.currentScript?.src;
      if (script) return new URL("../", script);
    } catch {}
    return new URL("./", document.baseURI || location.href);
  }

  function ensureDesignSystem() {
    if (!document.querySelector('link[data-ruangkitha-design-system]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.dataset.ruangkithaDesignSystem = RK_DESIGN_SYSTEM_VERSION;
      link.href = new URL(
        `css/ruangkitha-design-system-v1.css?v=${RK_BUILD_VERSION}`,
        appBaseUrl()
      ).href;
      document.head.appendChild(link);
    }

    if (!document.querySelector('link[data-ruangkitha-shell]')) {
      const shell = document.createElement("link");
      shell.rel = "stylesheet";
      shell.dataset.ruangkithaShell = RK_DESIGN_SYSTEM_VERSION;
      shell.href = new URL(
        `css/ruangkitha-shell-v1.css?v=${RK_BUILD_VERSION}`,
        appBaseUrl()
      ).href;
      document.head.appendChild(shell);
    }

    document.documentElement.dataset.designSystem = "ruangkitha-v1";
    document.documentElement.dataset.shell = "ruangkitha-v1";
  }

  function syncBrowserThemeColor() {
    const isDark = document.documentElement.dataset.theme === "dark";
    const color = isDark ? "#101612" : "#FBF7EE";
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = color;
  }

  ensureDesignSystem();
  syncBrowserThemeColor();

  new MutationObserver(syncBrowserThemeColor).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });

  let deferredPrompt = null;

  let swRegistration = null;
  let updatePromptShownFor = null;

  function showUpdatePrompt(registration) {
    const waiting = registration?.waiting;
    if (!waiting || !navigator.serviceWorker.controller) return;
    if (updatePromptShownFor === waiting.scriptURL) return;
    updatePromptShownFor = waiting.scriptURL;

    document.getElementById("ruangkitha-update-banner")?.remove();
    const banner = document.createElement("div");
    banner.id = "ruangkitha-update-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.style.cssText = [
      "position:fixed","left:50%","bottom:max(18px,env(safe-area-inset-bottom))","transform:translateX(-50%)",
      "width:min(calc(100% - 28px),430px)","z-index:100000","box-sizing:border-box","padding:13px 14px",
      "border-radius:18px","background:#171D19","color:#F1EADF","box-shadow:0 16px 42px rgba(0,0,0,.38)",
      "border:1px solid rgba(255,255,255,.09)","font-family:Manrope,system-ui,sans-serif","display:flex",
      "align-items:center","gap:12px"
    ].join(";");
    banner.innerHTML = '<div style="min-width:0;flex:1"><strong style="display:block;font-size:13px">Versi baru RuangKitha tersedia</strong><small style="display:block;margin-top:3px;color:#B9C2BC;font-size:11.5px;line-height:1.4">Muat ulang untuk memakai perbaikan terbaru.</small></div><button type="button" style="border:0;border-radius:999px;padding:10px 13px;background:#7FA58E;color:#101612;font:700 12px Manrope,system-ui,sans-serif;white-space:nowrap">Muat ulang</button>';
    banner.querySelector("button")?.addEventListener("click", () => {
      const button = banner.querySelector("button");
      if (button) { button.disabled = true; button.textContent = "Memuat…"; }
      waiting.postMessage({ type: "SKIP_WAITING" });
    });
    document.body.appendChild(banner);
  }

  function watchRegistration(registration) {
    swRegistration = registration;
    if (registration.waiting) showUpdatePrompt(registration);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdatePrompt(registration);
        }
      });
    });
  }

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
        const registration = await navigator.serviceWorker.register("./sw.js?v=20260912-v200a48a", {
          scope: "./"
        });

        watchRegistration(registration);

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

  // Setelah user menerima prompt update, SW waiting menerima SKIP_WAITING.
  // Reload hanya sekali ketika controller benar-benar berganti.
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    const key = "family_pwa_controller_reload";
    const now = Date.now();
    const last = Number(sessionStorage.getItem(key) || 0);
    if (now - last < 10000) return;
    sessionStorage.setItem(key, String(now));
    location.reload();
  });


  async function markOpenedNotificationRead() {
    const params = new URLSearchParams(location.search);
    const id = params.get("rk_notification");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    try {
      // Supabase is loaded before pwa.js on RuangKitha app pages.
      if (window.AUTH_READY) {
        const allowed = await window.AUTH_READY;
        if (allowed === false) return;
      }
      if (!window.supabaseClient) return;
      await window.supabaseClient.rpc("notification_mark_read_v1", { p_notification_id: id });
      params.delete("rk_notification");
      const clean = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`;
      history.replaceState(history.state, "", clean);
      window.dispatchEvent(new CustomEvent("ruangkitha:notification-read"));
    } catch (error) {
      console.debug?.("[Notification open marker]", error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", markOpenedNotificationRead, { once: true });
  else markOpenedNotificationRead();


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
      "background:rgba(23,29,25,.97)",
      "color:#F1EADF",
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

  window.RuangKithaDesignSystem = Object.freeze({
    version: RK_DESIGN_SYSTEM_VERSION,
    build: RK_BUILD_VERSION
  });

  window.FamilyPWA = {
    install,
    isStandalone,
    get installable() {
      return Boolean(deferredPrompt);
    }
  };
})();
