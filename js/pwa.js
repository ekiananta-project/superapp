(() => {
  "use strict";

  const RK_DESIGN_SYSTEM_VERSION = "1.0.7";
  const RK_BUILD_VERSION = "v2.0.0a49a1";

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

  const RK_FINANCE_PAGES = new Set([
    "finance.html",
    "transaksi.html",
    "detail-transaksi.html",
    "budget.html",
    "tagihan.html",
    "perencanaan.html",
    "kelola.html",
    "dompet.html",
    "dompet-detail.html",
    "dompet-form.html",
    "akun.html",
    "akun-form.html",
    "laporan.html",
    "laporan-dompet.html"
  ]);

  const RK_CATATAN_PAGES = new Set([
    "catatan.html",
    "catatan-keluarga.html",
    "catatan-pribadi.html",
    "catatan-anggota.html",
    "catatan-folder.html",
    "catatan-editor.html",
    "catatan-checklist.html",
    "catatan-arsip.html",
    "catatan-relasi.html"
  ]);

  const RK_CALENDAR_PAGES = new Set([
    "kalender.html",
    "notifikasi.html"
  ]);

  const RK_IDENTITY_PAGE_KIND = new Map([
    ["login.html", "auth"],
    ["daftar.html", "auth"],
    ["profil.html", "profile"],
    ["pengaturan.html", "profile"],
    ["keamanan.html", "profile"],
    ["keluarga.html", "family"],
    ["keluarga-awal.html", "family"],
    ["kelola-undangan.html", "family"],
    ["riwayat-anggota.html", "family"]
  ]);

  function currentPageName() {
    try {
      const path = new URL(location.href).pathname.replace(/\/+$/, "");
      return path.split("/").pop() || "index.html";
    } catch {
      return "";
    }
  }

  function ensureModuleDesignLayer() {
    const page = currentPageName();

    if (RK_FINANCE_PAGES.has(page)) {
      document.documentElement.dataset.rkModule = "finance";
      document.documentElement.dataset.rkFinancePage = page.replace(/\.html$/i, "");

      if (!document.querySelector('link[data-ruangkitha-finance]')) {
        const finance = document.createElement("link");
        finance.rel = "stylesheet";
        finance.dataset.ruangkithaFinance = "1.0.0";
        finance.href = new URL(
          `css/pages/ruangkitha-finance-v1.css?v=${RK_BUILD_VERSION}`,
          appBaseUrl()
        ).href;
        document.head.appendChild(finance);
      }
      return;
    }

    if (RK_CATATAN_PAGES.has(page)) {
      document.documentElement.dataset.rkModule = "catatan";
      document.documentElement.dataset.rkCatatanPage = page.replace(/\.html$/i, "");

      if (!document.querySelector('link[data-ruangkitha-catatan]')) {
        const catatan = document.createElement("link");
        catatan.rel = "stylesheet";
        catatan.dataset.ruangkithaCatatan = "1.0.0";
        catatan.href = new URL(
          `css/pages/ruangkitha-catatan-v1.css?v=${RK_BUILD_VERSION}`,
          appBaseUrl()
        ).href;
        document.head.appendChild(catatan);
      }
      return;
    }

    if (RK_CALENDAR_PAGES.has(page)) {
      document.documentElement.dataset.rkModule = "calendar";
      document.documentElement.dataset.rkCalendarPage = page.replace(/\.html$/i, "");

      if (!document.querySelector('link[data-ruangkitha-calendar]')) {
        const calendar = document.createElement("link");
        calendar.rel = "stylesheet";
        calendar.dataset.ruangkithaCalendar = "1.0.0";
        calendar.href = new URL(
          `css/pages/ruangkitha-calendar-notification-v1.css?v=${RK_BUILD_VERSION}`,
          appBaseUrl()
        ).href;
        document.head.appendChild(calendar);
      }
      return;
    }

    const identityKind = RK_IDENTITY_PAGE_KIND.get(page);
    if (identityKind) {
      document.documentElement.dataset.rkModule = "identity";
      document.documentElement.dataset.rkIdentityKind = identityKind;
      document.documentElement.dataset.rkIdentityPage = page.replace(/\.html$/i, "");

      if (!document.querySelector('link[data-ruangkitha-identity]')) {
        const identity = document.createElement("link");
        identity.rel = "stylesheet";
        identity.dataset.ruangkithaIdentity = "1.0.1";
        identity.href = new URL(
          `css/pages/ruangkitha-profile-auth-family-v1.css?v=${RK_BUILD_VERSION}`,
          appBaseUrl()
        ).href;
        document.head.appendChild(identity);
      }
    }
  }

  function enhanceIdentityBrandCopy() {
    if (document.documentElement.dataset.rkModule !== "identity") return;

    // Production logo integration: auth pages use the real RuangKitha symbol asset.
    if (document.documentElement.dataset.rkIdentityKind === "auth") {
      const mark = document.querySelector(".auth-brand-mark");
      if (mark && mark.dataset.rkLogoReady !== "true") {
        mark.innerHTML = '<img src="assets/brand/ruangkitha-symbol-256.png" alt="" aria-hidden="true">';
        mark.dataset.rkLogoReady = "true";
      }
    }

    // Normalize legacy metadata when older HTML still says Family Superapp.
    const applicationName = document.querySelector('meta[name="application-name"]');
    if (applicationName) applicationName.setAttribute("content", "RuangKitha");
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) appleTitle.setAttribute("content", "RuangKitha");

    // Keep the product wordmark visually consistent without changing auth logic.
    document.querySelectorAll(".auth-brand strong").forEach(node => {
      if (node.dataset.rkWordmarkReady === "true") return;
      if (String(node.textContent || "").trim() !== "RuangKitha") return;
      node.innerHTML = '<span class="rk-wordmark-ruang">Ruang</span><span class="rk-wordmark-kitha">Kitha</span>';
      node.dataset.rkWordmarkReady = "true";
    });

    // Final consistency cleanup from the pre-brand design system.
    if (document.documentElement.dataset.rkIdentityPage === "profil") {
      document.querySelectorAll(".pilihan-tema-info small").forEach(node => {
        const text = String(node.textContent || "").trim();
        if (/Graphite Emerald.*terang/i.test(text)) {
          node.textContent = "RuangKitha terang dengan cream hangat dan warna yang lembut.";
        } else if (/Graphite Emerald.*charcoal/i.test(text)) {
          node.textContent = "RuangKitha gelap dengan nuansa malam yang hangat dan tenang.";
        }
      });

      document.querySelectorAll(".item-pengaturan").forEach(row => {
        const label = row.querySelector("span");
        const value = row.querySelector("small");
        if (label?.textContent?.trim() === "Versi" && value) {
          value.textContent = "2.0.0a49a1 PWA";
        }
      });
    }
  }

  let rkLogoutNativePass = false;
  let rkLogoutSourceControl = null;
  let rkLogoutPreviousFocus = null;

  function findProfileLogoutControl(target) {
    if (document.documentElement.dataset.rkIdentityKind !== "profile") return null;
    if (!(target instanceof Element)) return null;

    const control = target.closest(
      "button, a, .item-pengaturan-tombol, .tautan-pengaturan, .item-pengaturan"
    );
    if (!control) return null;

    const text = String(control.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    const isLogout = /(^|\s)keluar(\s|$)/i.test(text);
    const isThisDevice = text.includes("perangkat ini");
    return isLogout && isThisDevice ? control : null;
  }

  function ensureProfileLogoutModal() {
    let layer = document.querySelector("[data-rk-logout-modal]");
    if (layer) return layer;

    layer = document.createElement("div");
    layer.className = "rk-logout-modal-layer";
    layer.dataset.rkLogoutModal = "";
    layer.hidden = true;
    layer.innerHTML = `
      <section class="rk-logout-modal-card" role="dialog" aria-modal="true" aria-labelledby="rk-logout-title" aria-describedby="rk-logout-copy">
        <span class="rk-logout-modal-icon" aria-hidden="true"><ion-icon name="log-out-outline"></ion-icon></span>
        <h2 id="rk-logout-title">Keluar dari RuangKitha?</h2>
        <p id="rk-logout-copy">Kamu akan keluar dari akun pada perangkat ini. Perangkat lain tetap masuk.</p>
        <div class="rk-logout-modal-actions">
          <button type="button" class="rk-logout-modal-cancel" data-rk-logout-cancel>Batal</button>
          <button type="button" class="rk-logout-modal-confirm" data-rk-logout-confirm>Keluar</button>
        </div>
      </section>`;

    const close = () => {
      layer.hidden = true;
      document.documentElement.classList.remove("rk-modal-open");
      rkLogoutSourceControl = null;
      const focusBack = rkLogoutPreviousFocus;
      rkLogoutPreviousFocus = null;
      if (focusBack instanceof HTMLElement && focusBack.isConnected) {
        focusBack.focus({ preventScroll: true });
      }
    };

    layer.querySelector("[data-rk-logout-cancel]")?.addEventListener("click", close);
    layer.addEventListener("click", event => {
      if (event.target === layer) close();
    });

    layer.querySelector("[data-rk-logout-confirm]")?.addEventListener("click", () => {
      const source = rkLogoutSourceControl;
      if (!source) return close();

      const confirmButton = layer.querySelector("[data-rk-logout-confirm]");
      if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = "Keluar…";
      }

      layer.hidden = true;
      document.documentElement.classList.remove("rk-modal-open");

      const nativeConfirm = window.confirm;
      rkLogoutNativePass = true;
      window.confirm = message => {
        const text = String(message || "");
        if (/keluar.*akun.*perangkat|keluar.*perangkat/i.test(text)) return true;
        return nativeConfirm.call(window, message);
      };

      try {
        source.click();
      } finally {
        window.confirm = nativeConfirm;
        rkLogoutNativePass = false;
        rkLogoutSourceControl = null;
        rkLogoutPreviousFocus = null;
        if (confirmButton) {
          confirmButton.disabled = false;
          confirmButton.textContent = "Keluar";
        }
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !layer.hidden) close();
    });

    document.body.appendChild(layer);
    return layer;
  }

  function installProfileLogoutModalGuard() {
    if (document.documentElement.dataset.rkIdentityKind !== "profile") return;

    document.addEventListener("click", event => {
      if (rkLogoutNativePass) return;
      const control = findProfileLogoutControl(event.target);
      if (!control) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      rkLogoutSourceControl = control;
      rkLogoutPreviousFocus = document.activeElement;
      const layer = ensureProfileLogoutModal();
      layer.hidden = false;
      document.documentElement.classList.add("rk-modal-open");
      requestAnimationFrame(() => {
        layer.querySelector("[data-rk-logout-cancel]")?.focus({ preventScroll: true });
      });
    }, true);
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
  ensureModuleDesignLayer();
  enhanceIdentityBrandCopy();
  installProfileLogoutModalGuard();
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

  function setupStandaloneGestureScope() {
    // Installed RuangKitha behaves like an app: normal page pinch-zoom is
    // disabled, while the Catatan relation map keeps its own custom pointer
    // pinch implementation. Browser mode remains zoomable for accessibility.
    if (!isStandalone()) return;

    document.documentElement.dataset.rkGestureScope = "standalone-app";

    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.name = "viewport";
      document.head.prepend(viewport);
    }
    viewport.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

    if (!document.getElementById("ruangkitha-gesture-scope-style")) {
      const style = document.createElement("style");
      style.id = "ruangkitha-gesture-scope-style";
      style.textContent = `
        html[data-rk-gesture-scope="standalone-app"],
        html[data-rk-gesture-scope="standalone-app"] body {
          touch-action: pan-x pan-y;
        }
        html[data-rk-gesture-scope="standalone-app"] [data-relation-map-viewport],
        html[data-rk-gesture-scope="standalone-app"] .relation-map-viewport {
          touch-action: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    const isRelationMapTarget = target => Boolean(
      target?.closest?.("[data-relation-map-viewport], .relation-map-viewport")
    );

    // Android browsers can still start a native page zoom gesture before
    // touch-action settles on some WebView/PWA builds. Cancel only multi-touch
    // outside the relation map; one-finger scrolling stays untouched.
    document.addEventListener("touchmove", event => {
      if ((event.touches?.length || 0) < 2) return;
      if (isRelationMapTarget(event.target)) return;
      event.preventDefault();
    }, { passive: false, capture: true });

    // Safari-family gesture events must never zoom the document. The relation
    // map does not rely on these events; it uses Pointer Events instead.
    ["gesturestart", "gesturechange", "gestureend"].forEach(type => {
      document.addEventListener(type, event => event.preventDefault(), {
        passive: false,
        capture: true
      });
    });
  }

  setupStandaloneGestureScope();

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
        const registration = await navigator.serviceWorker.register("./sw.js?v=20260912-v200a48f", {
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
