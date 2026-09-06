(() => {
  "use strict";

  const emailEl = document.querySelector("[data-auth-email]");
  const logoutButton = document.querySelector("[data-auth-logout]");

  async function init() {
    if (window.AUTH_READY) {
      const ok = await window.AUTH_READY;
      if (ok === false) return;
    }

    try {
      const user = await AuthService.ambilUserAktif();
      if (emailEl) emailEl.textContent = user?.email || "-";
    } catch (error) {
      console.error("[Pengaturan Auth]", error);
      if (emailEl) emailEl.textContent = "Gagal dimuat";
    }
  }

  logoutButton?.addEventListener("click", async () => {
    if (!confirm("Keluar dari akun pada perangkat ini?")) return;

    logoutButton.disabled = true;

    try {
      await AuthService.logout();
      location.replace("login.html");
    } catch (error) {
      console.error("[Logout]", error);
      alert(error?.message || "Logout gagal.");
      logoutButton.disabled = false;
    }
  });

  init();
})();
