(() => {
  "use strict";

  const buka = document.querySelector("[data-buka-hapus-akun]");
  const sheet = document.querySelector("[data-sheet-hapus-akun]");
  const tutup = document.querySelector("[data-tutup-hapus-akun]");
  const form = document.querySelector("[data-form-hapus-akun]");
  const submit = document.querySelector("[data-hapus-akun-final]");
  const pesan = document.querySelector("[data-pesan-hapus-akun]");

  if (!buka || !sheet || !form || !submit) return;

  const password = form.elements.password;
  const konfirmasi = form.elements.konfirmasi;
  let emailUser = "";
  let sedangProses = false;

  function normalisasiKonfirmasi(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();
  }

  function tampilPesan(teks) {
    if (!pesan) {
      alert(teks);
      return;
    }

    pesan.textContent = teks;
    pesan.hidden = false;
  }

  function bersihkanPesan() {
    if (!pesan) return;
    pesan.textContent = "";
    pesan.hidden = true;
  }

  function updateSubmit() {
    submit.disabled =
      sedangProses ||
      !String(password?.value || "") ||
      normalisasiKonfirmasi(konfirmasi?.value) !== "HAPUS AKUN";
  }

  function bukaSheet() {
    bersihkanPesan();
    form.reset();
    sedangProses = false;
    updateSubmit();
    sheet.hidden = false;
    document.body.style.overflow = "hidden";

    setTimeout(() => {
      password?.focus();
    }, 50);
  }

  function tutupSheet() {
    if (sedangProses) return;
    sheet.hidden = true;
    document.body.style.overflow = "";
    form.reset();
    bersihkanPesan();
    updateSubmit();
  }

  async function ambilEmailUser() {
    if (window.AUTH_READY) {
      const ok = await window.AUTH_READY;
      if (ok === false) return "";
    }

    const user = await window.AuthService.ambilUserAktif();
    emailUser = String(user?.email || "").trim().toLowerCase();
    return emailUser;
  }

  async function bersihkanPerangkat() {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      console.warn("[Account deletion local cleanup]", error);
    }

    try {
      await window.supabaseClient.auth.signOut({ scope: "local" });
    } catch (error) {
      // User backend sudah dihapus. Sign-out lokal hanya best effort.
      console.warn("[Account deletion signOut]", error);
    }
  }

  buka.addEventListener("click", bukaSheet);
  tutup?.addEventListener("click", tutupSheet);

  sheet.addEventListener("click", event => {
    if (event.target === sheet) tutupSheet();
  });

  password?.addEventListener("input", updateSubmit);
  konfirmasi?.addEventListener("input", updateSubmit);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !sheet.hidden) {
      tutupSheet();
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (sedangProses) return;

    bersihkanPesan();

    if (normalisasiKonfirmasi(konfirmasi?.value) !== "HAPUS AKUN") {
      tampilPesan('Ketik "HAPUS AKUN" dengan tepat untuk melanjutkan.');
      return;
    }

    const email = emailUser || await ambilEmailUser();
    if (!email) {
      tampilPesan("Email akun aktif tidak ditemukan. Muat ulang halaman lalu coba lagi.");
      return;
    }

    sedangProses = true;
    submit.disabled = true;
    submit.innerHTML = '<ion-icon name="hourglass-outline"></ion-icon> Memverifikasi...';

    try {
      // Re-auth menghasilkan JWT baru. Backend hanya menerima JWT yang masih baru
      // untuk aksi penghapusan akun permanen.
      await window.AuthService.login(email, String(password?.value || ""));

      submit.innerHTML = '<ion-icon name="trash-outline"></ion-icon> Menghapus akun...';

      const { data, error } = await window.supabaseClient.rpc(
        "account_delete_me",
        { p_confirmation: "HAPUS AKUN" }
      );

      if (error) throw error;

      console.info("[account_delete_me]", data);

      await bersihkanPerangkat();
      location.replace("login.html?account_deleted=1");
    } catch (error) {
      console.error("[Hapus Akun]", error);

      const message = String(
        error?.message ||
        error?.details ||
        error?.hint ||
        "Akun belum berhasil dihapus."
      );

      const passwordSalah =
        /invalid login credentials|email not confirmed|password/i.test(message);

      tampilPesan(
        passwordSalah
          ? "Password tidak cocok atau login ulang gagal. Periksa password lalu coba lagi."
          : message
      );

      sedangProses = false;
      submit.innerHTML = '<ion-icon name="trash-outline"></ion-icon> Hapus Akun Permanen';
      updateSubmit();
    }
  });

  ambilEmailUser().catch(error => {
    console.error("[Account deletion init]", error);
  });
})();
