(() => {
  "use strict";

  const form = document.querySelector("[data-daftar-form]");
  const notice = document.querySelector("[data-auth-notice]");
  const submit = document.querySelector("[data-auth-submit]");
  const modal = document.querySelector("[data-register-modal]");
  const modalTitle = document.querySelector("[data-register-modal-title]");
  const modalMessage = document.querySelector("[data-register-modal-message]");
  const modalIcon = document.querySelector("[data-register-modal-icon]");
  const primary = document.querySelector("[data-register-primary]");
  const secondary = document.querySelector("[data-register-secondary]");

  function pesanError(error) {
    const raw = String(error?.message || "");
    const lower = raw.toLowerCase();
    if (lower.includes("already registered") || lower.includes("already been registered") || lower.includes("user already registered")) {
      return { type: "used", message: "Email ini sudah digunakan. Kamu bisa masuk atau mengatur ulang password jika lupa." };
    }
    if (lower.includes("password")) return { type: "error", message: raw || "Password belum memenuhi ketentuan." };
    if (lower.includes("failed to fetch") || lower.includes("network")) return { type: "network", message: "Akun belum berhasil dibuat. Periksa koneksi internet lalu coba lagi." };
    return { type: "error", message: raw || "Pendaftaran belum berhasil. Coba lagi." };
  }

  function setLoading(loading) {
    submit.disabled = loading;
    submit.innerHTML = loading
      ? '<span class="auth-loading"><ion-icon name="sync-outline"></ion-icon> Membuat akun...</span>'
      : '<span>Buat Akun</span><ion-icon name="arrow-forward-outline"></ion-icon>';
  }

  function clearFieldErrors() {
    form?.querySelectorAll(".auth-input.is-error").forEach(el => el.classList.remove("is-error"));
    form?.querySelectorAll("[data-field-error]").forEach(el => el.remove());
  }

  function fieldError(input, message) {
    if (!input) return;
    input.classList.add("is-error");
    const field = input.closest(".auth-field");
    if (!field) return;
    let el = field.querySelector("[data-field-error]");
    if (!el) {
      el = document.createElement("p");
      el.className = "auth-field-error";
      el.dataset.fieldError = "";
      field.appendChild(el);
    }
    el.textContent = message;
  }

  function focusFirstInvalid() {
    const invalid = form?.querySelector(".auth-input.is-error");
    if (!invalid) return;
    invalid.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => invalid.focus({ preventScroll: true }), 280);
  }

  function openModal({ title, message, icon = "information-circle-outline", type = "info", primaryText = "Mengerti", primaryAction = null, secondaryText = "", secondaryAction = null }) {
    if (!modal) return;
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalIcon.dataset.type = type;
    modalIcon.innerHTML = `<ion-icon name="${icon}"></ion-icon>`;
    primary.textContent = primaryText;
    primary.onclick = () => {
      if (typeof primaryAction === "function") primaryAction();
      else closeModal();
    };
    secondary.hidden = !secondaryText;
    if (secondaryText) {
      secondary.textContent = secondaryText;
      secondary.onclick = () => {
        if (typeof secondaryAction === "function") secondaryAction();
        else closeModal();
      };
    }
    modal.hidden = false;
    document.body.classList.add("auth-modal-open");
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("auth-modal-open");
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
    try { await AuthRouter.redirectJikaSudahLogin(); } catch (error) { console.error("[Daftar init]", error); }
  }

  form?.addEventListener("input", event => {
    if (event.target?.classList?.contains("auth-input")) {
      event.target.classList.remove("is-error");
      event.target.closest(".auth-field")?.querySelector("[data-field-error]")?.remove();
    }
  });

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (notice) notice.hidden = true;
    clearFieldErrors();

    const nama = form.elements.nama.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const konfirmasi = form.elements.konfirmasi.value;

    if (nama.length < 2) fieldError(form.elements.nama, "Nama minimal 2 karakter.");
    if (!email) fieldError(form.elements.email, "Email wajib diisi.");
    if (password.length < 8) fieldError(form.elements.password, "Password minimal 8 karakter.");
    if (password !== konfirmasi) fieldError(form.elements.konfirmasi, "Konfirmasi password belum sama.");

    if (form.querySelector(".auth-input.is-error")) {
      focusFirstInvalid();
      return;
    }

    setLoading(true);

    try {
      const hasil = await AuthService.daftar({ nama, email, password });
      localStorage.setItem("keuangan_auth_email_terakhir", email);

      if (hasil.session) {
        try { await AuthService.ubahNamaProfil(nama); } catch (profileError) { console.warn("[Nama profil signup]", profileError); }
        openModal({
          title: "Akun berhasil dibuat",
          message: "Akunmu sudah aktif dan siap digunakan.",
          icon: "checkmark-circle-outline",
          type: "success",
          primaryText: "Lanjut",
          primaryAction: () => AuthRouter.redirectSetelahLogin({ pakaiReturnTo: false })
        });
        form.reset();
        return;
      }

      openModal({
        title: "Cek email kamu",
        message: "Akun berhasil dibuat. Kami sudah mengirim tautan konfirmasi ke email kamu. Buka tautan tersebut untuk mengaktifkan akun.",
        icon: "mail-unread-outline",
        type: "success",
        primaryText: "Mengerti",
        primaryAction: () => { location.href = "login.html"; }
      });
      form.reset();
    } catch (error) {
      console.error("[Daftar]", error);
      const info = pesanError(error);

      if (info.type === "used") {
        openModal({
          title: "Email sudah digunakan",
          message: info.message,
          icon: "mail-outline",
          type: "warning",
          primaryText: "Masuk",
          primaryAction: () => { location.href = "login.html"; },
          secondaryText: "Tutup",
          secondaryAction: closeModal
        });
      } else {
        openModal({
          title: info.type === "network" ? "Koneksi bermasalah" : "Pendaftaran belum berhasil",
          message: info.message,
          icon: info.type === "network" ? "cloud-offline-outline" : "alert-circle-outline",
          type: "error",
          primaryText: "Coba Lagi",
          primaryAction: closeModal
        });
      }
    } finally {
      setLoading(false);
    }
  });

  modal?.addEventListener("click", event => { if (event.target === modal) closeModal(); });
  init();
})();
