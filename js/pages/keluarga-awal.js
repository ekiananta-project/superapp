(() => {
  "use strict";

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";

  const pilihan = document.querySelector("[data-pilihan-keluarga]");
  const panelBuat = document.querySelector("[data-panel-buat]");
  const panelGabung = document.querySelector("[data-panel-gabung]");
  const notif = document.querySelector("[data-notifikasi-awal]");
  const formBuat = document.querySelector("[data-form-buat-keluarga]");
  const formGabung = document.querySelector("[data-form-gabung-keluarga]");

  const preview = document.querySelector("[data-preview-undangan]");
  const previewNama = document.querySelector("[data-preview-nama-keluarga]");
  const previewHubunganWrap = document.querySelector("[data-preview-hubungan-wrap]");
  const previewHubungan = document.querySelector("[data-preview-hubungan]");
  const previewKedaluwarsa = document.querySelector("[data-preview-kedaluwarsa]");
  const tombolTerima = document.querySelector("[data-terima-undangan]");

  let undanganDipreview = null;
  let kodeDipreview = "";
  let namaDipreview = "";
  let keluargaAktifSaatIni = null;

  function ambilStatusGabung() {
    if (!tombolTerima) return null;

    let status = document.querySelector("[data-status-gabung]");
    if (!status) {
      status = document.createElement("p");
      status.className = "status-gabung-undangan";
      status.setAttribute("data-status-gabung", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.hidden = true;
      tombolTerima.insertAdjacentElement("afterend", status);
    }

    return status;
  }

  function setStatusGabung(teks = "", tipe = "info") {
    const status = ambilStatusGabung();
    if (!status) return;

    status.textContent = teks;
    status.dataset.tipe = tipe;
    status.hidden = !teks;
  }

  function tampilPesan(teks, tipe = "error") {
    if (!notif) return;
    notif.hidden = false;
    notif.textContent = teks;
    notif.dataset.tipe = tipe;
  }

  function bersihkanPesan() {
    if (!notif) return;
    notif.hidden = true;
    notif.textContent = "";
    delete notif.dataset.tipe;
  }

  function labelHubungan(value) {
    return ({
      pasangan: "Pasangan",
      orang_tua: "Orang Tua",
      anak: "Anak",
      saudara: "Saudara",
      lainnya: "Lainnya"
    })[value] || "";
  }

  function formatTanggalWaktu(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function simpanFamilyAktif(familyId) {
    let lama = {};
    try {
      lama = JSON.parse(localStorage.getItem(KUNCI_PENGATURAN) || "{}");
    } catch {
      lama = {};
    }

    localStorage.setItem(
      KUNCI_PENGATURAN,
      JSON.stringify({ ...lama, familyAktif: familyId })
    );
  }

  function resetPreview() {
    undanganDipreview = null;
    kodeDipreview = "";
    namaDipreview = "";
    if (preview) preview.hidden = true;
    setStatusGabung("");

    if (tombolTerima) {
      delete tombolTerima.dataset.mode;
      tombolTerima.disabled = false;
      tombolTerima.innerHTML =
        '<ion-icon name="enter-outline"></ion-icon> Gabung Sekarang';
    }
  }

  function tampilPanel(mode) {
    bersihkanPesan();
    resetPreview();
    pilihan.hidden = true;
    panelBuat.hidden = mode !== "buat";
    panelGabung.hidden = mode !== "gabung";
  }

  function kembali() {
    bersihkanPesan();
    resetPreview();
    panelBuat.hidden = true;
    panelGabung.hidden = true;
    pilihan.hidden = false;
  }

  async function isiNamaAwal() {
    try {
      const profile = await FamilyService.ambilProfilSaya();
      const nama = profile?.display_name || "";
      if (nama) {
        if (formBuat?.elements.namaPengguna) formBuat.elements.namaPengguna.value = nama;
        if (formGabung?.elements.namaPengguna) formGabung.elements.namaPengguna.value = nama;
      }
    } catch (error) {
      console.warn("[Onboarding profil]", error);
    }
  }

  async function init() {
    if (window.AUTH_READY) {
      const ok = await window.AUTH_READY;
      if (ok === false) return;
    }

    const params = new URLSearchParams(location.search);

    // Retry cleanup Storage/tombstone dari dissolve sebelumnya tanpa
    // menghambat onboarding bila jaringan sedang bermasalah.
    FamilyService.prosesCleanupBubarkanTertunda?.().catch(error => {
      console.warn("[Dissolve cleanup retry]", error);
    });

    if (params.get("dibubarkan") === "1") {
      tampilPesan("Ruang Keluarga sudah dibubarkan. Kamu dapat membuat atau bergabung ke Ruang Keluarga baru.", "success");
    }

    const kodeQuery = params.get("kode") || "";
    const paksaGabung = params.get("gabung") === "1" || Boolean(kodeQuery);

    try {
      const families = await FamilyService.ambilKeluargaSaya();
      keluargaAktifSaatIni = families[0] || null;

      if (keluargaAktifSaatIni && !paksaGabung) {
        await AuthRouter.redirectSetelahLogin({ pakaiReturnTo: false });
        return;
      }
    } catch (error) {
      console.error("[Onboarding family check]", error);
      tampilPesan(error?.message || "Status keluarga belum dapat diperiksa.");
      return;
    }

    await isiNamaAwal();

    if (paksaGabung) {
      tampilPanel("gabung");

      if (keluargaAktifSaatIni) {
        tampilPesan(
          `Kamu masih tergabung di ${keluargaAktifSaatIni.name || "Ruang Keluarga saat ini"}. ` +
          "Kamu boleh memeriksa kode, tetapi harus keluar dari Ruang Keluarga saat ini sebelum bergabung ke Ruang Keluarga lain.",
          "info"
        );
      }

      if (kodeQuery && formGabung?.elements.kode) {
        const raw = kodeQuery.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
        formGabung.elements.kode.value = raw.length > 8
          ? `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`
          : raw.length > 4
            ? `${raw.slice(0, 4)}-${raw.slice(4)}`
            : raw;
      }
    }
  }

  document.querySelectorAll("[data-pilih-mode]").forEach(button => {
    button.addEventListener("click", () => tampilPanel(button.dataset.pilihMode));
  });

  document.querySelectorAll("[data-kembali-pilihan]").forEach(button => {
    button.addEventListener("click", kembali);
  });

  formBuat?.addEventListener("submit", async event => {
    event.preventDefault();
    bersihkanPesan();

    if (keluargaAktifSaatIni) {
      tampilPesan(
        `Kamu masih tergabung di ${keluargaAktifSaatIni.name || "Ruang Keluarga saat ini"}. ` +
        "Selesaikan keanggotaanmu terlebih dahulu sebelum membuat Ruang Keluarga baru."
      );
      return;
    }

    const namaPengguna = formBuat.elements.namaPengguna.value.trim();
    const namaKeluarga = formBuat.elements.namaKeluarga.value.trim();
    const submit = formBuat.querySelector('[type="submit"]');

    if (namaPengguna.length < 2) {
      tampilPesan("Nama kamu minimal 2 karakter.");
      return;
    }
    if (namaKeluarga.length < 2) {
      tampilPesan("Nama keluarga minimal 2 karakter.");
      return;
    }

    submit.disabled = true;
    submit.innerHTML = '<ion-icon name="sync-outline"></ion-icon> Membuat ruang keluarga...';

    try {
      await AuthService.ubahNamaProfil(namaPengguna);
      const familyId = await FamilyService.buatKeluarga({
        name: namaKeluarga,
        timezone: "Asia/Jakarta",
        currency: "IDR"
      });

      simpanFamilyAktif(familyId);
      location.replace("dompet-form.html?setup=awal");
    } catch (error) {
      console.error("[Buat Ruang Keluarga Backend]", error);
      tampilPesan(error?.message || "Ruang keluarga gagal dibuat.");
      submit.disabled = false;
      submit.innerHTML = 'Buat Ruang Keluarga <ion-icon name="arrow-forward-outline"></ion-icon>';
    }
  });

  formGabung?.addEventListener("submit", async event => {
    event.preventDefault();
    bersihkanPesan();
    resetPreview();

    const namaPengguna = formGabung.elements.namaPengguna.value.trim();
    const kode = formGabung.elements.kode.value.trim();
    const submit = formGabung.querySelector('[type="submit"]');

    if (namaPengguna.length < 2) {
      tampilPesan("Nama kamu minimal 2 karakter.");
      return;
    }

    submit.disabled = true;
    submit.innerHTML = '<ion-icon name="sync-outline"></ion-icon> Memeriksa kode...';

    try {
      const kodeBersih = FamilyService.normalisasiKodeUndangan(kode);
      const data = await FamilyService.previewUndangan(kodeBersih);

      if (!data) {
        throw new Error("Undangan tidak ditemukan.");
      }

      undanganDipreview = data;
      kodeDipreview = kodeBersih;
      namaDipreview = namaPengguna;

      previewNama.textContent = data.family_name || "Keluarga";
      previewKedaluwarsa.textContent = formatTanggalWaktu(data.expires_at);

      const hubungan = labelHubungan(data.relationship);
      previewHubunganWrap.hidden = !hubungan;
      previewHubungan.textContent = hubungan;

      preview.hidden = false;
      preview.scrollIntoView({ behavior: "smooth", block: "nearest" });

      if (keluargaAktifSaatIni) {
        tombolTerima.dataset.mode = "manage-current-family";
        tombolTerima.innerHTML =
          '<ion-icon name="settings-outline"></ion-icon> Kelola Ruang Keluarga Saat Ini';

        const namaAktif = keluargaAktifSaatIni.name || "Ruang Keluarga saat ini";
        setStatusGabung(
          `Kamu masih aktif di ${namaAktif}. Keluar dari ruang tersebut terlebih dahulu sebelum menerima undangan ini.`,
          "error"
        );
        tampilPesan("Kode valid, tetapi akunmu masih memiliki Ruang Keluarga aktif.", "info");
      } else {
        tampilPesan("Kode valid. Periksa keluarga tujuan sebelum bergabung.", "success");
      }
    } catch (error) {
      console.error("[Preview Undangan]", error);
      tampilPesan(error?.message || "Kode undangan tidak dapat diperiksa.");
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Periksa Kode <ion-icon name="arrow-forward-outline"></ion-icon>';
    }
  });

  tombolTerima?.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();

    if (!undanganDipreview || !kodeDipreview) {
      setStatusGabung("Periksa kode undangan dulu.", "error");
      return;
    }

    if (keluargaAktifSaatIni || tombolTerima.dataset.mode === "manage-current-family") {
      location.href = "keluarga.html";
      return;
    }

    bersihkanPesan();
    setStatusGabung("Memproses keanggotaan...", "loading");

    tombolTerima.disabled = true;
    tombolTerima.innerHTML = '<ion-icon name="sync-outline"></ion-icon> Bergabung...';

    const familyTujuan = undanganDipreview.family_id;
    const namaFamilyTujuan = undanganDipreview.family_name || "keluarga";
    const namaTerbaru = formGabung?.elements.namaPengguna?.value.trim() || namaDipreview;

    try {
      /*
       * JOIN adalah operasi utama. Jangan blok join hanya karena update
       * display_name gagal. Profile disinkronkan setelah membership sukses.
       */
      const familyId = await FamilyService.terimaUndangan(kodeDipreview);

      if (!familyId) {
        throw new Error("Backend tidak mengembalikan ID keluarga setelah join.");
      }

      if (familyTujuan && familyId !== familyTujuan) {
        throw new Error("Family ID hasil join tidak sesuai undangan yang dipreview.");
      }

      simpanFamilyAktif(familyId);
      sessionStorage.removeItem("keuangan_auth_return_to_v1");

      setStatusGabung("Keanggotaan berhasil. Menyiapkan keluarga...", "success");

      if (namaTerbaru && namaTerbaru.length >= 2) {
        try {
          await AuthService.ubahNamaProfil(namaTerbaru);
        } catch (profileError) {
          console.warn("[Sinkron nama setelah join]", profileError);
        }
      }

      /*
       * Verifikasi ringan supaya jika RPC sukses tapi membership belum terbaca,
       * user mendapat pesan nyata dan bukan tombol yang terasa tidak melakukan apa-apa.
       */
      const families = await FamilyService.ambilKeluargaSaya();
      const sudahMasuk = families.some(item => item.id === familyId);

      if (!sudahMasuk) {
        throw new Error("Keanggotaan belum terbaca setelah join. Coba muat ulang halaman.");
      }

      tampilPesan(`Berhasil bergabung ke ${namaFamilyTujuan}.`, "success");
      setStatusGabung("Berhasil bergabung. Membuka Home...", "success");

      setTimeout(() => {
        location.replace("index.html");
      }, 450);

    } catch (error) {
      console.error("[Terima Undangan]", error);

      const pesan = error?.message || "Gagal bergabung ke keluarga.";
      tampilPesan(pesan);
      setStatusGabung(pesan, "error");

      tombolTerima.disabled = false;
      tombolTerima.innerHTML = '<ion-icon name="enter-outline"></ion-icon> Gabung Sekarang';
    }
  });

  formGabung?.elements.kode?.addEventListener("input", event => {
    resetPreview();
    let nilai = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    if (nilai.length > 8) nilai = `${nilai.slice(0, 4)}-${nilai.slice(4, 8)}-${nilai.slice(8)}`;
    else if (nilai.length > 4) nilai = `${nilai.slice(0, 4)}-${nilai.slice(4)}`;
    event.target.value = nilai;
  });

  init();
})();
