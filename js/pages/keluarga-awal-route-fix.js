(() => {
  "use strict";

  const form = document.querySelector("[data-form-buat-keluarga]");
  if (!form) return;
  const notif = document.querySelector("[data-notifikasi-awal]");
  const PREF_KEY = "keuangan_pengaturan_v1";
  let busy = false;

  function show(message, type = "error") {
    if (!notif) return;
    notif.hidden = false;
    notif.textContent = message;
    notif.dataset.tipe = type;
  }

  function saveFamily(familyId) {
    let current = {};
    try { current = JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; } catch {}
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ ...current, familyAktif: familyId, dompetAktif: "" }));
      sessionStorage.removeItem("keuangan_auth_return_to_v1");
    } catch {}
  }

  form.addEventListener("submit", async event => {
    /* Capture phase prevents the legacy handler from sending new families to
       dompet-form.html. Family creation is now a RuangKitha-core action. */
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;

    const namaPengguna = String(form.elements.namaPengguna?.value || "").trim();
    const namaKeluarga = String(form.elements.namaKeluarga?.value || "").trim();
    const submit = form.querySelector('[type="submit"]');

    if (namaPengguna.length < 2) return show("Nama kamu minimal 2 karakter.");
    if (namaKeluarga.length < 2) return show("Nama keluarga minimal 2 karakter.");

    busy = true;
    if (submit) {
      submit.disabled = true;
      submit.innerHTML = '<ion-icon name="sync-outline"></ion-icon> Membuat ruang keluarga...';
    }

    try {
      const existing = await FamilyService.ambilKeluargaSaya();
      if (existing?.length) {
        show("Akun ini masih tergabung di Ruang Keluarga. Selesaikan keanggotaan tersebut terlebih dahulu.");
        return;
      }

      await AuthService.ubahNamaProfil(namaPengguna);
      const familyId = await FamilyService.buatKeluarga({
        name: namaKeluarga,
        timezone: "Asia/Jakarta",
        currency: "IDR"
      });
      saveFamily(familyId);
      location.replace("index.html");
    } catch (error) {
      console.error("[RuangKitha create family route]", error);
      show(error?.message || "Ruang keluarga gagal dibuat.");
    } finally {
      busy = false;
      if (submit && document.contains(submit)) {
        submit.disabled = false;
        submit.innerHTML = 'Buat Ruang Keluarga <ion-icon name="arrow-forward-outline"></ion-icon>';
      }
    }
  }, true);
})();
