(() => {
  "use strict";

  const form = document.querySelector("[data-daftar-form]");
  const notice = document.querySelector("[data-auth-notice]");
  const submit = document.querySelector("[data-auth-submit]");

  function pesanError(error) {
    const raw = String(error?.message || "");
    const lower = raw.toLowerCase();

    if (lower.includes("already registered") || lower.includes("already been registered")) {
      return "Email ini sudah terdaftar. Coba masuk dari halaman Login.";
    }
    if (lower.includes("password")) {
      return raw || "Password belum memenuhi ketentuan Supabase Auth.";
    }
    if (lower.includes("failed to fetch") || lower.includes("network")) {
      return "Tidak dapat terhubung ke backend. Periksa koneksi internet.";
    }
    return raw || "Pendaftaran gagal. Coba lagi.";
  }

  function tampilPesan(teks, type = "error") {
    notice.hidden = false;
    notice.dataset.type = type;
    notice.textContent = teks;
  }

  function setLoading(loading) {
    submit.disabled = loading;
    submit.innerHTML = loading
      ? '<span class="auth-loading"><ion-icon name="sync-outline"></ion-icon> Membuat akun...</span>'
      : '<span>Buat Akun</span><ion-icon name="arrow-forward-outline"></ion-icon>';
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
    try {
      await AuthRouter.redirectJikaSudahLogin();
    } catch (error) {
      console.error("[Daftar init]", error);
    }
  }

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    notice.hidden = true;

    const nama = form.elements.nama.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const konfirmasi = form.elements.konfirmasi.value;

    if (nama.length < 2) {
      tampilPesan("Nama minimal 2 karakter.");
      return;
    }
    if (!email) {
      tampilPesan("Email wajib diisi.");
      return;
    }
    if (password.length < 8) {
      tampilPesan("Password minimal 8 karakter.");
      return;
    }
    if (password !== konfirmasi) {
      tampilPesan("Konfirmasi password belum sama.");
      return;
    }

    setLoading(true);

    try {
      const hasil = await AuthService.daftar({ nama, email, password });
      localStorage.setItem("keuangan_auth_email_terakhir", email);

      if (hasil.session) {
        try {
          await AuthService.ubahNamaProfil(nama);
        } catch (profileError) {
          console.warn("[Nama profil signup]", profileError);
        }

        await AuthRouter.redirectSetelahLogin({ pakaiReturnTo: false });
        return;
      }

      tampilPesan(
        "Akun berhasil dibuat. Cek email untuk konfirmasi, lalu kembali ke halaman Login.",
        "success"
      );
      form.reset();
      submit.disabled = false;
      submit.innerHTML = '<span>Sudah daftar</span><ion-icon name="checkmark-circle-outline"></ion-icon>';

      setTimeout(() => {
        location.href = "login.html";
      }, 2500);
    } catch (error) {
      console.error("[Daftar]", error);
      tampilPesan(pesanError(error));
      setLoading(false);
    }
  });

  init();
})();
