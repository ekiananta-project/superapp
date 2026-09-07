(() => {
  "use strict";

  const emailEl = document.querySelector("[data-auth-email]");
  const currentEmailEl = document.querySelector("[data-current-email]");
  const logoutButton = document.querySelector("[data-auth-logout]");
  const emailSheet = document.querySelector("[data-sheet-email-login]");
  const passwordSheet = document.querySelector("[data-sheet-password]");
  const emailForm = document.querySelector("[data-form-email-login]");
  const passwordForm = document.querySelector("[data-form-password]");
  let currentUser = null;

  function openSheet(sheet) {
    if (!sheet) return;
    sheet.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeSheet(sheet) {
    if (!sheet) return;
    sheet.hidden = true;
    if ([emailSheet, passwordSheet].every(item => !item || item.hidden)) document.body.style.overflow = "";
  }

  function message(el, text = "", type = "info") {
    if (!el) return;
    el.hidden = !text;
    el.dataset.type = type;
    el.textContent = text;
  }

  function readableError(error) {
    const raw = String(error?.message || "");
    const lower = raw.toLowerCase();
    if (lower.includes("invalid login credentials")) return "Password saat ini belum cocok.";
    if (lower.includes("already") && lower.includes("registered")) return "Email baru tersebut sudah digunakan akun lain.";
    if (lower.includes("fetch") || lower.includes("network")) return "Koneksi internet bermasalah. Coba lagi.";
    return raw || "Perubahan belum berhasil disimpan.";
  }

  async function init() {
    if (window.AUTH_READY) {
      const ok = await window.AUTH_READY;
      if (ok === false) return;
    }

    try {
      currentUser = await AuthService.ambilUserAktif();
      const email = currentUser?.email || "-";
      if (emailEl) emailEl.textContent = email;
      if (currentEmailEl) currentEmailEl.textContent = email;
    } catch (error) {
      console.error("[Pengaturan Auth]", error);
      if (emailEl) emailEl.textContent = "Gagal dimuat";
    }
  }

  document.querySelector("[data-buka-email-login]")?.addEventListener("click", () => {
    message(document.querySelector("[data-email-login-message]"));
    if (currentEmailEl) currentEmailEl.textContent = currentUser?.email || emailEl?.textContent || "-";
    openSheet(emailSheet);
  });
  document.querySelector("[data-tutup-email-login]")?.addEventListener("click", () => closeSheet(emailSheet));

  document.querySelector("[data-buka-password]")?.addEventListener("click", () => {
    message(document.querySelector("[data-password-message]"));
    openSheet(passwordSheet);
  });
  document.querySelector("[data-tutup-password]")?.addEventListener("click", () => closeSheet(passwordSheet));

  [emailSheet, passwordSheet].forEach(sheet => sheet?.addEventListener("click", event => {
    if (event.target === sheet) closeSheet(sheet);
  }));

  emailForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const emailBaru = emailForm.elements.emailBaru.value.trim();
    const password = emailForm.elements.password.value;
    const out = document.querySelector("[data-email-login-message]");
    const submit = document.querySelector("[data-submit-email-login]");
    message(out);

    if (!emailBaru || !password) return message(out, "Lengkapi email baru dan password saat ini.", "error");

    submit.disabled = true;
    submit.textContent = "Memproses...";
    try {
      await AuthService.ubahEmailLogin(emailBaru, password);
      message(out, "Permintaan perubahan email sudah dibuat. Ikuti tautan verifikasi yang dikirim sesuai pengaturan keamanan email akunmu.", "success");
      emailForm.elements.password.value = "";
    } catch (error) {
      console.error("[Ubah Email]", error);
      message(out, readableError(error), "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Kirim Verifikasi";
    }
  });

  passwordForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const current = passwordForm.elements.passwordSaatIni.value;
    const next = passwordForm.elements.passwordBaru.value;
    const confirm = passwordForm.elements.konfirmasi.value;
    const out = document.querySelector("[data-password-message]");
    const submit = document.querySelector("[data-submit-password]");
    message(out);

    if (!current || next.length < 8) return message(out, "Password baru minimal 8 karakter dan password saat ini wajib diisi.", "error");
    if (next !== confirm) return message(out, "Konfirmasi password baru belum sama.", "error");

    submit.disabled = true;
    submit.textContent = "Menyimpan...";
    try {
      await AuthService.gantiPassword(current, next);
      message(out, "Password berhasil diperbarui.", "success");
      passwordForm.reset();
    } catch (error) {
      console.error("[Ubah Password]", error);
      message(out, readableError(error), "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Simpan Password Baru";
    }
  });

  logoutButton?.addEventListener("click", async () => {
    if (!confirm("Keluar dari akun pada perangkat ini?")) return;
    logoutButton.disabled = true;
    try {
      window.FinanceCache?.clearAll();
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
