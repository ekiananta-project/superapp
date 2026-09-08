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
  const previewFotoButton = document.querySelector("[data-preview-family-photo]");
  const previewFotoImage = document.querySelector("[data-preview-family-photo-image]");
  const previewFotoFallback = document.querySelector("[data-preview-family-photo-fallback]");
  const previewFotoLayer = document.querySelector("[data-invitation-photo-preview]");
  const previewFotoLarge = document.querySelector("[data-invitation-photo-preview-image]");
  const previewFotoName = document.querySelector("[data-invitation-photo-preview-name]");
  const previewFotoClose = document.querySelector("[data-invitation-photo-preview-close]");

  let undanganDipreview = null;
  let kodeDipreview = "";
  let namaDipreview = "";
  let keluargaAktifSaatIni = null;
  let toastTimer = null;

  function tampilToast(teks, tipe = "info") {
    const value = String(teks || "").trim();
    if (!value) return;

    let toast = document.querySelector("[data-toast-undangan]");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast-salin-kode toast-undangan-feedback";
      toast.setAttribute("data-toast-undangan", "");
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.replaceChildren();
    const icon = document.createElement("ion-icon");
    icon.setAttribute(
      "name",
      tipe === "error" ? "alert-circle-outline" :
        tipe === "success" ? "checkmark-circle-outline" :
          "information-circle-outline"
    );
    const label = document.createElement("span");
    label.textContent = value;
    toast.append(icon, label);
    toast.dataset.tipe = tipe;

    if (toastTimer) clearTimeout(toastTimer);
    requestAnimationFrame(() => toast.classList.add("is-show"));
    toastTimer = setTimeout(() => toast.classList.remove("is-show"), 2600);
  }

  function ambilStatusPeriksaKode() {
    const submit = formGabung?.querySelector('[type="submit"]');
    if (!submit) return null;

    let status = document.querySelector("[data-status-periksa-kode]");
    if (!status) {
      status = document.createElement("p");
      status.className = "status-periksa-kode";
      status.setAttribute("data-status-periksa-kode", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.hidden = true;
      submit.insertAdjacentElement("afterend", status);
    }
    return status;
  }

  function setStatusPeriksaKode(teks = "", tipe = "info") {
    const status = ambilStatusPeriksaKode();
    if (!status) return;
    status.textContent = teks;
    status.dataset.tipe = tipe;
    status.hidden = !teks;
  }

  function pesanValidasiUndangan(error) {
    const raw = String(error?.message || "").toLowerCase();

    if (raw.includes("12 karakter") || raw.includes("format kode")) {
      return "Kode undangan belum lengkap atau formatnya tidak sesuai.";
    }

    if (
      raw.includes("tidak ditemukan") ||
      raw.includes("sudah dipakai") ||
      raw.includes("dicabut") ||
      raw.includes("kedaluwarsa") ||
      raw.includes("tidak aktif")
    ) {
      return "Kode undangan tidak ditemukan atau sudah tidak berlaku.";
    }

    return "Kode undangan belum dapat diperiksa. Coba lagi.";
  }

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
      kerabat: "Kerabat",
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

  function tutupPreviewFoto() {
    if (previewFotoLayer) previewFotoLayer.hidden = true;
  }

  function resetFotoUndangan() {
    if (previewFotoImage) {
      previewFotoImage.hidden = true;
      previewFotoImage.removeAttribute("src");
      previewFotoImage.alt = "";
    }
    if (previewFotoFallback) previewFotoFallback.hidden = false;
    if (previewFotoButton) {
      previewFotoButton.disabled = true;
      previewFotoButton.removeAttribute("data-photo-url");
      previewFotoButton.setAttribute("aria-label", "Ruang Keluarga belum memiliki foto");
    }
    if (previewFotoLarge) previewFotoLarge.removeAttribute("src");
    if (previewFotoName) previewFotoName.textContent = "Foto Keluarga";
    tutupPreviewFoto();
  }

  async function muatFotoUndangan(data) {
    resetFotoUndangan();
    const path = String(data?.family_photo_path || "").trim();
    if (!path) return;

    try {
      const url = await FamilyService.ambilUrlFotoUndangan(path);
      if (!url) return;

      if (previewFotoImage) {
        previewFotoImage.src = url;
        previewFotoImage.alt = `Foto ${data?.family_name || "Ruang Keluarga"}`;
        previewFotoImage.hidden = false;
      }
      if (previewFotoFallback) previewFotoFallback.hidden = true;
      if (previewFotoButton) {
        previewFotoButton.disabled = false;
        previewFotoButton.dataset.photoUrl = url;
        previewFotoButton.setAttribute("aria-label", `Preview foto ${data?.family_name || "Ruang Keluarga"}`);
      }
      if (previewFotoLarge) previewFotoLarge.src = url;
      if (previewFotoName) previewFotoName.textContent = data?.family_name || "Ruang Keluarga";
    } catch (error) {
      // Foto adalah enhancement. Invitation tetap boleh dipreview bila media gagal.
      console.warn("[Invitation family photo]", error);
      resetFotoUndangan();
    }
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
    resetFotoUndangan();
    if (preview) preview.hidden = true;
    setStatusGabung("");
    setStatusPeriksaKode("");

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
      /*
       * v1.1.7b: gunakan sumber status yang sama dengan Home.
       * Jangan query family lalu query lagi saat redirect, karena dua keputusan
       * route yang berjalan berdekatan dapat membuat index/onboarding memantul.
       */
      const status = await AuthRouter.cekStatusAplikasi();
      keluargaAktifSaatIni = status.family || null;

      if (keluargaAktifSaatIni && !paksaGabung) {
        const tujuan = status.destination || "index.html";
        const fileSekarang = location.pathname.split("/").pop() || "keluarga-awal.html";
        if (!tujuan.startsWith(fileSekarang)) {
          location.replace(tujuan);
        }
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
      const pesan = "Nama kamu minimal 2 karakter.";
      tampilPesan(pesan);
      setStatusPeriksaKode(pesan, "error");
      tampilToast(pesan, "error");
      return;
    }

    setStatusPeriksaKode("Memeriksa kode undangan...", "loading");
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

      // Tampilkan identitas undangan segera setelah kode tervalidasi.
      // Foto adalah enhancement dan tidak boleh memblokir preview card.
      preview.hidden = false;
      setStatusPeriksaKode("Kode undangan valid.", "success");
      tampilToast("Kode undangan valid.", "success");
      preview.scrollIntoView({ behavior: "smooth", block: "nearest" });
      void muatFotoUndangan(data);

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
      const pesan = pesanValidasiUndangan(error);
      tampilPesan(pesan);
      setStatusPeriksaKode(pesan, "error");
      tampilToast(pesan, "error");
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Periksa Kode <ion-icon name="arrow-forward-outline"></ion-icon>';
    }
  });

  previewFotoButton?.addEventListener("click", () => {
    const url = previewFotoButton.dataset.photoUrl || "";
    if (!url || !previewFotoLayer || !previewFotoLarge) return;
    previewFotoLarge.src = url;
    previewFotoLayer.hidden = false;
  });

  previewFotoClose?.addEventListener("click", tutupPreviewFoto);
  previewFotoLayer?.addEventListener("click", event => {
    if (event.target === previewFotoLayer) tutupPreviewFoto();
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
