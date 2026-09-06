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
        const registration = await navigator.serviceWorker.register("./sw.js", {
          scope: "./"
        });

        // Cek versi baru tanpa mengganggu startup aplikasi.
        registration.update().catch(() => {});
      } catch (error) {
        console.warn("[PWA] Service worker gagal didaftarkan.", error);
      }
    });
  }

  window.FamilyPWA = {
    install,
    isStandalone,
    get installable() {
      return Boolean(deferredPrompt);
    }
  };
})();
