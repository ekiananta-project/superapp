(() => {
  "use strict";

  const form = document.querySelector("[data-login-form]");
  const notice = document.querySelector("[data-auth-notice]");
  const submit = document.querySelector("[data-auth-submit]");

  function pesanError(error) {
    const raw = String(error?.message || "");
    const lower = raw.toLowerCase();

    if (lower.includes("invalid login credentials")) {
      return "Email atau password belum cocok.";
    }
    if (lower.includes("email not confirmed")) {
      return "Email belum dikonfirmasi. Buka email dari Supabase terlebih dahulu.";
    }
    if (lower.includes("failed to fetch") || lower.includes("network")) {
      return "Tidak dapat terhubung ke backend. Periksa koneksi internet.";
    }
    return raw || "Login gagal. Coba lagi.";
  }

  function tampilPesan(teks, type = "error") {
    notice.hidden = false;
    notice.dataset.type = type;
    notice.textContent = teks;
  }

  function setLoading(loading) {
    submit.disabled = loading;
    submit.innerHTML = loading
      ? '<span class="auth-loading"><ion-icon name="sync-outline"></ion-icon> Memeriksa akun...</span>'
      : '<span>Masuk</span><ion-icon name="arrow-forward-outline"></ion-icon>';
  }

  function pasangTogglePassword() {
    document.querySelectorAll("[data-toggle-password]").forEach(button => {
      button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.togglePassword);
        if (!input) return;
        const tampil = input.type === "password";
        input.type = tampil ? "text" : "password";
        button.innerHTML = `<ion-icon name="${tampil ? "eye-off-outline" : "eye-outline"}"></ion-icon>`;
        button.setAttribute("aria-label", tampil ? "Sembunyikan password" : "Tampilkan password");
      });
    });
  }

  async function init() {
    pasangTogglePassword();

    const emailTerakhir = localStorage.getItem("keuangan_auth_email_terakhir");
    if (emailTerakhir && form?.elements.email) {
      form.elements.email.value = emailTerakhir;
    }

    try {
      await AuthRouter.redirectJikaSudahLogin();
    } catch (error) {
      console.error("[Login init]", error);
    }
  }

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    notice.hidden = true;

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    if (!email || !password) {
      tampilPesan("Lengkapi email dan password.");
      return;
    }

    setLoading(true);

    try {
      await AuthService.login(email, password);
      localStorage.setItem("keuangan_auth_email_terakhir", email);

      try {
        await AuthService.sinkronProfilSaya();
      } catch (syncError) {
        console.warn("[Sinkron profil setelah login]", syncError);
      }

      await AuthRouter.redirectSetelahLogin();
    } catch (error) {
      console.error("[Login]", error);
      tampilPesan(pesanError(error));
      setLoading(false);
    }
  });

  init();
})();
