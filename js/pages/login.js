(() => {
  "use strict";

  const form = document.querySelector("[data-login-form]");
  const notice = document.querySelector("[data-auth-notice]");
  const submit = document.querySelector("[data-auth-submit]");
  const forgotModal = document.querySelector("[data-forgot-modal]");
  const resetModal = document.querySelector("[data-reset-modal]");

  function pesanError(error) {
    const raw = String(error?.message || "");
    const lower = raw.toLowerCase();

    if (lower.includes("invalid login credentials")) return "Email atau password belum cocok.";
    if (lower.includes("email not confirmed")) return "Email belum dikonfirmasi. Buka email konfirmasi terlebih dahulu.";
    if (lower.includes("failed to fetch") || lower.includes("network")) return "Koneksi internet bermasalah. Coba lagi.";
    return raw || "Login gagal. Coba lagi.";
  }

  function tampilPesan(teks, type = "error") {
    if (!notice) return;
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
      if (button.dataset.bound === "1") return;
      button.dataset.bound = "1";
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

  function bukaModal(el) {
    if (!el) return;
    el.hidden = false;
    document.body.classList.add("auth-modal-open");
  }

  function tutupModal(el) {
    if (!el) return;
    el.hidden = true;
    if (![forgotModal, resetModal].some(item => item && !item.hidden)) {
      document.body.classList.remove("auth-modal-open");
    }
  }

  function modalMessage(selector, text, type = "info") {
    const el = document.querySelector(selector);
    if (!el) return;
    el.hidden = !text;
    el.dataset.type = type;
    el.textContent = text || "";
  }

  async function init() {
    pasangTogglePassword();

    const emailTerakhir = localStorage.getItem("keuangan_auth_email_terakhir");
    if (emailTerakhir && form?.elements.email) form.elements.email.value = emailTerakhir;

    const isReset = new URLSearchParams(location.search).get("mode") === "reset";
    if (isReset) {
      bukaModal(resetModal);
      return;
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
      try { await AuthService.sinkronProfilSaya(); } catch (syncError) { console.warn("[Sinkron profil setelah login]", syncError); }
      await AuthRouter.redirectSetelahLogin();
    } catch (error) {
      console.error("[Login]", error);
      tampilPesan(pesanError(error));
      setLoading(false);
    }
  });

  document.querySelector("[data-forgot-password]")?.addEventListener("click", () => {
    const input = document.querySelector("[data-forgot-email]");
    if (input) input.value = form?.elements.email?.value || localStorage.getItem("keuangan_auth_email_terakhir") || "";
    modalMessage("[data-forgot-message]", "");
    bukaModal(forgotModal);
    setTimeout(() => input?.focus(), 80);
  });

  document.querySelector("[data-close-forgot]")?.addEventListener("click", () => tutupModal(forgotModal));
  forgotModal?.addEventListener("click", event => { if (event.target === forgotModal) tutupModal(forgotModal); });

  document.querySelector("[data-send-reset]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    const input = document.querySelector("[data-forgot-email]");
    const email = String(input?.value || "").trim();

    if (!email) {
      modalMessage("[data-forgot-message]", "Masukkan email login terlebih dahulu.", "error");
      input?.focus();
      return;
    }

    button.disabled = true;
    button.textContent = "Mengirim...";
    modalMessage("[data-forgot-message]", "");

    try {
      await AuthService.kirimResetPassword(email);
      modalMessage(
        "[data-forgot-message]",
        "Jika email tersebut terdaftar, tautan untuk mengatur ulang password akan kami kirim ke email kamu. Periksa juga folder Spam.",
        "success"
      );
    } catch (error) {
      console.error("[Reset password request]", error);
      const lower = String(error?.message || "").toLowerCase();
      modalMessage(
        "[data-forgot-message]",
        lower.includes("fetch") || lower.includes("network")
          ? "Koneksi internet bermasalah. Coba lagi."
          : "Permintaan belum dapat diproses. Coba lagi beberapa saat.",
        "error"
      );
    } finally {
      button.disabled = false;
      button.textContent = "Kirim Tautan";
    }
  });

  document.querySelector("[data-save-reset]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    const password = document.querySelector("[data-reset-password]")?.value || "";
    const confirm = document.querySelector("[data-reset-confirm]")?.value || "";

    if (password.length < 8) {
      modalMessage("[data-reset-message]", "Password baru minimal 8 karakter.", "error");
      return;
    }
    if (password !== confirm) {
      modalMessage("[data-reset-message]", "Konfirmasi password belum sama.", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "Menyimpan...";
    modalMessage("[data-reset-message]", "");

    try {
      await AuthService.ubahPasswordBaru(password);
      modalMessage("[data-reset-message]", "Password berhasil diperbarui. Kamu akan diarahkan ke aplikasi.", "success");
      history.replaceState({}, "", "login.html");
      setTimeout(() => AuthRouter.redirectSetelahLogin({ pakaiReturnTo: false }), 700);
    } catch (error) {
      console.error("[Password recovery]", error);
      modalMessage("[data-reset-message]", pesanError(error), "error");
      button.disabled = false;
      button.textContent = "Simpan Password Baru";
    }
  });

  AuthService.pantauPerubahanAuth(({ event }) => {
    if (event === "PASSWORD_RECOVERY") bukaModal(resetModal);
  });

  init();
})();
