(() => {
  "use strict";
  const action = document.currentScript?.dataset?.rkBootstrap || "";
  try {
    switch (action) {
      case "auth-backend": window.AUTH_BACKEND_MODE = true; break;
      case "home-backend": window.HOME_BACKEND_MODE = true; break;
      case "catatan-existing-note":
        if (new URLSearchParams(location.search).has("id")) document.documentElement.dataset.catatanExistingNote = "true";
        break;
      case "dompet-form-title": {
        const el = document.querySelector("[data-judul-form]");
        const params = new URLSearchParams(location.search);
        if (el) el.textContent = params.get("id") ? "Edit Dompet" : (params.get("setup") === "awal" ? "Siapkan Dompet Pertamamu" : "Tambah Dompet");
        break;
      }
      case "redirect-profile": location.replace(`profil.html${location.search}${location.hash}`); break;
      default: break;
    }
  } catch (error) {
    window.RuangKithaSecurityLog?.warn?.("[Page bootstrap]", error);
  }
})();
