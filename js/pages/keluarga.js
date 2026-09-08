(() => {
  "use strict";

  const rootAnggota = document.querySelector("[data-daftar-anggota]");
  const form = document.querySelector("[data-form-keluarga]");
  const namaKeluarga = document.querySelector("[data-nama-keluarga]");
  const notifikasi = document.querySelector("[data-notifikasi-keluarga]");

  const tombolBukaUndangan = document.querySelector("[data-buat-undangan]");
  const panelUndangan = document.querySelector("[data-panel-undangan]");
  const selectHubungan = document.querySelector("[data-undangan-hubungan]");
  const tombolGenerate = document.querySelector("[data-generate-undangan]");
  const hasilUndangan = document.querySelector("[data-undangan-hasil]");
  const kodeUndangan = document.querySelector("[data-kode-undangan]");
  const kedaluwarsaUndangan = document.querySelector("[data-kedaluwarsa-undangan]");
  const hubunganRingkas = document.querySelector("[data-hubungan-undangan-ringkas]");
  const tombolSalin = document.querySelector("[data-salin-undangan]");
  const tombolBagikan = document.querySelector("[data-bagikan-undangan]");
  const tombolCabut = document.querySelector("[data-cabut-undangan]");

  const sheetTransferOwnership = document.querySelector("[data-transfer-ownership-sheet]");
  const formTransferOwnership = document.querySelector("[data-transfer-ownership-form]");
  const targetTransferOwnership = document.querySelector("[data-transfer-ownership-target]");
  const pesanTransferOwnership = document.querySelector("[data-transfer-ownership-message]");
  const tombolSubmitTransferOwnership = document.querySelector("[data-transfer-ownership-submit]");

  const sheetRelationship = document.querySelector("[data-relationship-sheet]");
  const formRelationship = document.querySelector("[data-relationship-form]");
  const targetRelationshipLabel = document.querySelector("[data-relationship-target]");
  const pesanRelationship = document.querySelector("[data-relationship-message]");
  const tombolSubmitRelationship = document.querySelector("[data-relationship-submit]");

  const tombolKeluarKeluarga = document.querySelector("[data-leave-family]");
  const bantuanKeluarKeluarga = document.querySelector("[data-leave-family-help]");
  const sheetKeluarKeluarga = document.querySelector("[data-leave-family-sheet]");
  const judulKeluarKeluarga = document.querySelector("[data-leave-family-title]");
  const isiKeluarKeluarga = document.querySelector("[data-leave-family-copy]");
  const tombolKonfirmasiKeluar = document.querySelector("[data-leave-family-confirm]");
  const tombolTutupKeluar = document.querySelector("[data-leave-family-close-primary]");
  const pesanKeluarKeluarga = document.querySelector("[data-leave-family-message]");

  const zonaBubarkanKeluarga = document.querySelector("[data-family-danger-zone]");
  const tombolBubarkanKeluarga = document.querySelector("[data-dissolve-family]");
  const sheetBubarkanKeluarga = document.querySelector("[data-dissolve-family-sheet]");
  const formBubarkanKeluarga = document.querySelector("[data-dissolve-family-form]");
  const namaBubarkanKeluarga = document.querySelector("[data-dissolve-family-name]");
  const jumlahAnggotaBubarkan = document.querySelector("[data-dissolve-member-count]");
  const pesanBubarkanKeluarga = document.querySelector("[data-dissolve-family-message]");
  const tombolKonfirmasiBubarkan = document.querySelector("[data-dissolve-family-confirm]");

  if (!rootAnggota || !form) return;

  let family = null;
  let user = null;
  let anggota = [];
  let undanganAktif = null;
  let targetPemilikBaru = null;
  let targetHubungan = null;
  let timeoutPesan = null;
  let timeoutToastSalin = null;

  function ambilToastSalin() {
    let toast = document.querySelector("[data-toast-salin-kode]");

    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast-salin-kode";
      toast.setAttribute("data-toast-salin-kode", "");
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.innerHTML = `
        <ion-icon name="checkmark-circle"></ion-icon>
        <span data-toast-salin-teks>Tersalin</span>
      `;
      document.body.appendChild(toast);
    }

    return toast;
  }

  function tampilToastSalin(teks = "Tersalin") {
    const toast = ambilToastSalin();
    const label = toast.querySelector("[data-toast-salin-teks]");
    if (label) label.textContent = teks;

    clearTimeout(timeoutToastSalin);
    toast.classList.remove("is-show");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add("is-show"));
    });

    timeoutToastSalin = setTimeout(() => {
      toast.classList.remove("is-show");
    }, 1500);
  }

  async function salinTeks(teks) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(teks);
        return true;
      } catch {
        // fallback di bawah untuk localhost/browser yang menolak Clipboard API.
      }
    }

    const area = document.createElement("textarea");
    area.value = teks;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.pointerEvents = "none";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, area.value.length);

    let berhasil = false;
    try {
      berhasil = document.execCommand("copy");
    } catch {
      berhasil = false;
    } finally {
      area.remove();
    }

    return berhasil;
  }

  function tampilPesan(teks, tipe = "info") {
    if (!notifikasi) return;
    clearTimeout(timeoutPesan);
    notifikasi.textContent = teks;
    notifikasi.dataset.tipe = tipe;
    notifikasi.hidden = false;
    timeoutPesan = setTimeout(() => {
      notifikasi.hidden = true;
    }, 3500);
  }

  function avatarUrl(path, version = "") {
    if (!path || !window.supabaseClient) return "";
    const { data } = window.supabaseClient.storage
      .from("profile-avatars")
      .getPublicUrl(path);
    const url = data?.publicUrl || "";
    if (!url) return "";
    const token = String(version || "").trim();
    return token ? `${url}?v=${encodeURIComponent(token)}` : url;
  }

  function inisial(nama) {
    return String(nama || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(kata => kata[0]?.toUpperCase() || "")
      .join("") || "?";
  }

  function labelPeran(role) {
    return role === "owner" ? "Pemilik" : "Anggota";
  }

  function labelHubungan(value) {
    return ({
      pasangan: "Pasangan",
      orang_tua: "Orang Tua",
      anak: "Anak",
      saudara: "Saudara",
      kerabat: "Kerabat",
      lainnya: "Lainnya"
    })[value] || "Belum ditentukan";
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

  function sayaOwner() {
    return family?.membership?.role === "owner";
  }

  function urutkanAnggota(items) {
    return [...items].sort((a, b) => {
      const ownerA = a.role === "owner" ? 0 : 1;
      const ownerB = b.role === "owner" ? 0 : 1;
      if (ownerA !== ownerB) return ownerA - ownerB;

      const diriA = a.user_id === user?.id ? 0 : 1;
      const diriB = b.user_id === user?.id ? 0 : 1;
      if (diriA !== diriB) return diriA - diriB;

      const namaA = String(a.profile?.display_name || "").trim();
      const namaB = String(b.profile?.display_name || "").trim();
      const byName = namaA.localeCompare(namaB, "id", { sensitivity: "base" });
      if (byName !== 0) return byName;

      return new Date(a.joined_at || 0) - new Date(b.joined_at || 0);
    });
  }

  function tampilPesanRelationship(teks = "", tipe = "info") {
    if (!pesanRelationship) return;
    pesanRelationship.textContent = teks;
    pesanRelationship.dataset.type = tipe;
    pesanRelationship.hidden = !teks;
  }

  function bolehUbahRelationship(item) {
    if (!item || item.status !== "active") return false;
    return sayaOwner() || item.user_id === user?.id;
  }

  function bukaRelationship(item, nama) {
    if (!sheetRelationship || !formRelationship || !bolehUbahRelationship(item)) return;

    targetHubungan = { item, nama };
    if (targetRelationshipLabel) targetRelationshipLabel.textContent = nama;
    formRelationship.elements.relationship.value = item.relationship || "";
    tampilPesanRelationship();
    sheetRelationship.hidden = false;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      formRelationship.elements.relationship?.focus();
    });
  }

  function tutupRelationship({ paksa = false } = {}) {
    if (!sheetRelationship || !formRelationship) return;
    if (!paksa && tombolSubmitRelationship?.disabled) return;

    sheetRelationship.hidden = true;
    document.body.style.overflow = "";
    formRelationship.reset();
    tampilPesanRelationship();
    targetHubungan = null;
  }

  function tampilPesanTransfer(teks = "", tipe = "info") {
    if (!pesanTransferOwnership) return;
    pesanTransferOwnership.textContent = teks;
    pesanTransferOwnership.dataset.type = tipe;
    pesanTransferOwnership.hidden = !teks;
  }

  function pesanErrorTransfer(error) {
    const raw = String(error?.message || "").trim();
    const lower = raw.toLowerCase();

    if (lower.includes("invalid login credentials")) {
      return "Password saat ini belum cocok.";
    }

    if (lower.includes("network") || lower.includes("fetch")) {
      return "Koneksi internet bermasalah. Coba lagi.";
    }

    return raw || "Kepemilikan belum berhasil dipindahkan.";
  }

  function bukaTransferOwnership(item, nama) {
    if (!sheetTransferOwnership || !formTransferOwnership) return;
    if (!family || !sayaOwner() || item.user_id === user?.id) return;

    targetPemilikBaru = { item, nama };
    if (targetTransferOwnership) {
      targetTransferOwnership.textContent = nama;
    }

    formTransferOwnership.reset();
    tampilPesanTransfer();
    sheetTransferOwnership.hidden = false;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      formTransferOwnership.elements.password?.focus();
    });
  }

  function tutupTransferOwnership({ paksa = false } = {}) {
    if (!sheetTransferOwnership || !formTransferOwnership) return;
    if (!paksa && tombolSubmitTransferOwnership?.disabled) return;

    sheetTransferOwnership.hidden = true;
    document.body.style.overflow = "";
    formTransferOwnership.reset();
    tampilPesanTransfer();
    targetPemilikBaru = null;
  }

  function tutupMenuAnggota(kecuali = null) {
    document
      .querySelectorAll("[data-menu-anggota-popover]")
      .forEach(menu => {
        if (menu === kecuali) return;

        menu.hidden = true;
        menu.parentElement
          ?.querySelector(".menu-anggota-trigger")
          ?.setAttribute("aria-expanded", "false");
      });
  }

  async function keluarkanAnggota(item, nama, tombol) {
    if (!family || !sayaOwner() || item.user_id === user?.id) return;

    const setuju = confirm(
      `Keluarkan ${nama} dari ${family.name}?\n\n` +
      "Akses Ruang Keluarga akan dicabut, tetapi akun pribadi dan riwayat aktivitas tetap disimpan."
    );

    if (!setuju) return;

    tombol.disabled = true;

    try {
      await FamilyService.keluarkanAnggota(family.id, item.user_id);

      anggota = anggota.filter(member => member.id !== item.id);
      renderAnggota();
      tampilPesan(`${nama} sudah dikeluarkan dari keluarga.`, "success");
    } catch (error) {
      console.error("[Keluarkan anggota]", error);
      tombol.disabled = false;
      tampilPesan(
        error?.message || "Anggota gagal dikeluarkan.",
        "error"
      );
    }
  }

  function buatMenuAnggota(item, nama, diriSendiri) {
    const wrap = document.createElement("span");
    wrap.className = "menu-anggota";
    wrap.setAttribute("data-menu-anggota", "");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "menu-anggota-trigger";
    trigger.setAttribute("aria-label", `Menu ${nama}`);
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = '<ion-icon name="ellipsis-horizontal"></ion-icon>';

    const popover = document.createElement("span");
    popover.className = "menu-anggota-popover";
    popover.setAttribute("data-menu-anggota-popover", "");
    popover.setAttribute("role", "menu");
    popover.hidden = true;

    const hubungan = document.createElement("button");
    hubungan.type = "button";
    hubungan.className = "menu-anggota-hubungan";
    hubungan.setAttribute("role", "menuitem");
    hubungan.innerHTML =
      '<ion-icon name="people-outline"></ion-icon>' +
      '<span>Ubah Hubungan</span>';

    hubungan.addEventListener("click", () => {
      tutupMenuAnggota();
      bukaRelationship(item, nama);
    });

    popover.appendChild(hubungan);

    if (sayaOwner() && !diriSendiri) {
      const transfer = document.createElement("button");
      transfer.type = "button";
      transfer.className = "menu-anggota-transfer";
      transfer.setAttribute("role", "menuitem");
      transfer.innerHTML =
        '<ion-icon name="swap-horizontal-outline"></ion-icon>' +
        '<span>Jadikan Pemilik Ruang Keluarga</span>';

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "menu-anggota-hapus";
      remove.setAttribute("role", "menuitem");
      remove.innerHTML =
        '<ion-icon name="person-remove-outline"></ion-icon>' +
        '<span>Keluarkan dari keluarga</span>';

      transfer.addEventListener("click", () => {
        tutupMenuAnggota();
        bukaTransferOwnership(item, nama);
      });

      remove.addEventListener("click", () => {
        keluarkanAnggota(item, nama, remove);
      });

      popover.append(transfer, remove);
    }

    trigger.addEventListener("click", event => {
      event.stopPropagation();

      const akanBuka = popover.hidden;
      tutupMenuAnggota(popover);
      popover.hidden = !akanBuka;
      trigger.setAttribute("aria-expanded", String(akanBuka));
    });

    popover.addEventListener("click", event => event.stopPropagation());

    wrap.append(trigger, popover);
    return wrap;
  }

  function renderAnggota() {
    rootAnggota.innerHTML = "";

    if (!anggota.length) {
      rootAnggota.innerHTML = `
        <div class="kosong-data">
          <ion-icon name="people-outline"></ion-icon>
          Belum ada anggota keluarga.
        </div>`;
      return;
    }

    urutkanAnggota(anggota).forEach(item => {
      const nama = item.profile?.display_name || "Anggota";
      const diriSendiri = item.user_id === user?.id;

      const kartu = document.createElement("div");
      kartu.className = "kartu-anggota";

      const avatar = document.createElement("span");
      avatar.className = "avatar-anggota avatar-anggota-backend";
      const foto = avatarUrl(item.profile?.avatar_path, item.profile?.updated_at);
      if (foto) {
        const img = document.createElement("img");
        img.src = foto;
        img.alt = `Foto ${nama}`;
        img.loading = "lazy";
        avatar.appendChild(img);
      } else {
        avatar.textContent = inisial(nama);
      }

      const info = document.createElement("span");
      info.className = "info-anggota";

      const strong = document.createElement("strong");
      strong.textContent = nama;

      const meta = document.createElement("span");
      meta.className = "meta-anggota";

      if (diriSendiri) {
        const akunIni = document.createElement("span");
        akunIni.className = "penanda-akun-ini";
        akunIni.textContent = "Akun ini";
        meta.appendChild(akunIni);
      }

      const hubungan = document.createElement("span");
      hubungan.className = "label-hubungan-anggota";
      hubungan.textContent = labelHubungan(item.relationship);
      meta.appendChild(hubungan);

      info.append(strong, meta);

      const sisiKanan = document.createElement("span");
      sisiKanan.className = "aksi-anggota";

      const peran = document.createElement("span");
      peran.className = "badge-peran";
      peran.textContent = labelPeran(item.role);
      sisiKanan.appendChild(peran);

      if (sayaOwner() || diriSendiri) {
        sisiKanan.appendChild(buatMenuAnggota(item, nama, diriSendiri));
      }

      kartu.append(avatar, info, sisiKanan);
      rootAnggota.appendChild(kartu);
    });
  }

  function tampilPesanKeluar(teks = "", tipe = "info") {
    if (!pesanKeluarKeluarga) return;
    pesanKeluarKeluarga.textContent = teks;
    pesanKeluarKeluarga.dataset.type = tipe;
    pesanKeluarKeluarga.hidden = !teks;
  }

  function bukaKeluarKeluarga() {
    if (!sheetKeluarKeluarga || !family) return;

    const owner = sayaOwner();
    tampilPesanKeluar();

    if (judulKeluarKeluarga) {
      judulKeluarKeluarga.textContent = owner
        ? "Pemilik belum dapat keluar"
        : `Keluar dari ${family.name || "Ruang Keluarga"}?`;
    }

    if (isiKeluarKeluarga) {
      isiKeluarKeluarga.textContent = owner
        ? "Sebagai Pemilik, kamu harus mentransfer kepemilikan ke anggota aktif lain terlebih dahulu. Setelah menjadi Anggota, kamu baru dapat keluar dari Ruang Keluarga."
        : "Aksesmu ke data bersama Ruang Keluarga akan langsung dicabut. Akun pribadi dan riwayat aktivitas yang sudah tercatat tetap disimpan.";
    }

    if (tombolKonfirmasiKeluar) {
      tombolKonfirmasiKeluar.hidden = owner;
      tombolKonfirmasiKeluar.disabled = false;
    }

    if (tombolTutupKeluar) {
      tombolTutupKeluar.textContent = owner ? "Mengerti" : "Batal";
    }

    sheetKeluarKeluarga.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function tutupKeluarKeluarga({ paksa = false } = {}) {
    if (!sheetKeluarKeluarga) return;
    if (!paksa && tombolKonfirmasiKeluar?.disabled) return;

    sheetKeluarKeluarga.hidden = true;
    document.body.style.overflow = "";
    tampilPesanKeluar();
  }

  function bersihkanKonteksFamilyLokal() {
    if (!family) return;

    try {
      const key = "keuangan_pengaturan_v1";
      const raw = JSON.parse(localStorage.getItem(key) || "{}");
      if (raw.familyAktif === family.id) {
        delete raw.familyAktif;
        localStorage.setItem(key, JSON.stringify(raw));
      }
    } catch {}

    try {
      window.FinanceCache?.removeFamily?.(family.id);

      Object.keys(sessionStorage)
        .filter(key =>
          key.startsWith("family_superapp_cache_v1:") &&
          key.endsWith(`:${family.id}`)
        )
        .forEach(key => sessionStorage.removeItem(key));
    } catch {}

    try {
      sessionStorage.removeItem("keuangan_auth_return_to_v1");
      if (family.family_photo_path) {
        sessionStorage.removeItem(
          `family-photo-signed-url-v1:${family.family_photo_path}`
        );
      }
    } catch {}

    window.FAMILY_CORE_STATE = null;
  }

  async function konfirmasiKeluarKeluarga() {
    if (!family || !user || sayaOwner() || !tombolKonfirmasiKeluar) return;

    const htmlAwal = tombolKonfirmasiKeluar.innerHTML;
    tombolKonfirmasiKeluar.disabled = true;
    tombolKonfirmasiKeluar.innerHTML =
      '<ion-icon name="sync-outline"></ion-icon> Keluar...';
    tampilPesanKeluar("Memproses keanggotaan...", "info");

    try {
      await FamilyService.keluarDariKeluarga(family.id);
      bersihkanKonteksFamilyLokal();
      tampilPesanKeluar("Kamu sudah keluar dari Ruang Keluarga.", "success");

      setTimeout(() => {
        location.replace("keluarga-awal.html");
      }, 300);
    } catch (error) {
      console.error("[Keluar Ruang Keluarga]", error);
      tombolKonfirmasiKeluar.disabled = false;
      tombolKonfirmasiKeluar.innerHTML = htmlAwal;
      tampilPesanKeluar(
        error?.message || "Belum berhasil keluar dari Ruang Keluarga.",
        "error"
      );
    }
  }


  function tampilPesanBubarkan(teks = "", tipe = "info") {
    if (!pesanBubarkanKeluarga) return;
    pesanBubarkanKeluarga.textContent = teks;
    pesanBubarkanKeluarga.dataset.type = tipe;
    pesanBubarkanKeluarga.hidden = !teks;
  }

  function phraseBubarkanValid() {
    if (!formBubarkanKeluarga) return false;
    return String(formBubarkanKeluarga.elements.confirmation?.value || "")
      .trim()
      .toUpperCase() === "BUBARKAN RUANG KELUARGA";
  }

  function refreshTombolBubarkan() {
    if (!tombolKonfirmasiBubarkan || !formBubarkanKeluarga) return;
    const passwordAda = Boolean(
      String(formBubarkanKeluarga.elements.password?.value || "").trim()
    );
    tombolKonfirmasiBubarkan.disabled = !(passwordAda && phraseBubarkanValid());
  }

  function bukaBubarkanKeluarga() {
    if (!sheetBubarkanKeluarga || !formBubarkanKeluarga || !family || !sayaOwner()) return;

    formBubarkanKeluarga.reset();
    tampilPesanBubarkan();
    refreshTombolBubarkan();

    if (namaBubarkanKeluarga) {
      namaBubarkanKeluarga.textContent = family.name || "Ruang Keluarga";
    }

    if (jumlahAnggotaBubarkan) {
      const jumlah = anggota.filter(item => item.status === "active").length;
      jumlahAnggotaBubarkan.textContent =
        `${jumlah || 1} anggota aktif termasuk Pemilik akan kehilangan akses ke Ruang Keluarga ini.`;
    }

    sheetBubarkanKeluarga.hidden = false;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      formBubarkanKeluarga.elements.password?.focus();
    });
  }

  function tutupBubarkanKeluarga({ paksa = false } = {}) {
    if (!sheetBubarkanKeluarga || !formBubarkanKeluarga) return;
    if (!paksa && tombolKonfirmasiBubarkan?.dataset.busy === "1") return;

    sheetBubarkanKeluarga.hidden = true;
    document.body.style.overflow = "";
    formBubarkanKeluarga.reset();
    tampilPesanBubarkan();
    delete tombolKonfirmasiBubarkan?.dataset.busy;
    refreshTombolBubarkan();
  }

  function pesanErrorBubarkan(error) {
    const raw = String(error?.message || "").trim();
    const lower = raw.toLowerCase();

    if (lower.includes("invalid login credentials")) {
      return "Password saat ini belum cocok.";
    }
    if (lower.includes("konfirmasi password kembali") || lower.includes("login ulang")) {
      return "Sesi keamanan perlu diperbarui. Masukkan password lalu coba lagi.";
    }
    if (lower.includes("network") || lower.includes("fetch")) {
      return "Koneksi internet bermasalah. Coba lagi.";
    }
    return raw || "Ruang Keluarga belum berhasil dibubarkan.";
  }

  async function submitBubarkanKeluarga(event) {
    event.preventDefault();
    if (!family || !user || !sayaOwner() || !formBubarkanKeluarga || !tombolKonfirmasiBubarkan) return;

    const password = String(formBubarkanKeluarga.elements.password?.value || "");
    const confirmation = String(formBubarkanKeluarga.elements.confirmation?.value || "").trim();

    if (!password) {
      tampilPesanBubarkan("Password saat ini wajib diisi.", "error");
      return;
    }
    if (!phraseBubarkanValid()) {
      tampilPesanBubarkan("Ketik persis BUBARKAN RUANG KELUARGA untuk melanjutkan.", "error");
      return;
    }

    const htmlAwal = tombolKonfirmasiBubarkan.innerHTML;
    tombolKonfirmasiBubarkan.dataset.busy = "1";
    tombolKonfirmasiBubarkan.disabled = true;
    tombolKonfirmasiBubarkan.innerHTML =
      '<ion-icon name="sync-outline"></ion-icon> Membubarkan...';
    tampilPesanBubarkan("Memverifikasi keamanan...", "info");

    try {
      await AuthService.reautentikasi(password);
      tampilPesanBubarkan("Menghapus data bersama Ruang Keluarga...", "info");

      const hasil = await FamilyService.bubarkanKeluarga(family.id, confirmation);
      bersihkanKonteksFamilyLokal();

      const pesan = hasil?.cleanup_pending
        ? "Ruang Keluarga sudah dibubarkan. Pembersihan media akan dicoba lagi otomatis."
        : "Ruang Keluarga berhasil dibubarkan permanen.";

      tampilPesanBubarkan(pesan, "success");

      setTimeout(() => {
        location.replace("keluarga-awal.html?dibubarkan=1");
      }, 450);
    } catch (error) {
      console.error("[Bubarkan Ruang Keluarga]", error);
      delete tombolKonfirmasiBubarkan.dataset.busy;
      tombolKonfirmasiBubarkan.disabled = false;
      tombolKonfirmasiBubarkan.innerHTML = htmlAwal;
      tampilPesanBubarkan(pesanErrorBubarkan(error), "error");
      refreshTombolBubarkan();
    }
  }

  function renderHakAkses() {
    const owner = sayaOwner();
    form.elements.namaKeluarga.disabled = !owner;
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.hidden = !owner;

    if (tombolBukaUndangan) tombolBukaUndangan.hidden = !owner;
    if (!owner && panelUndangan) panelUndangan.hidden = true;

    if (zonaBubarkanKeluarga) {
      zonaBubarkanKeluarga.hidden = !owner;
    }

    if (bantuanKeluarKeluarga) {
      bantuanKeluarKeluarga.textContent = owner
        ? "Pemilik harus mentransfer kepemilikan terlebih dahulu sebelum dapat keluar."
        : "Keluar hanya mencabut akses ke Ruang Keluarga. Akun pribadimu tetap ada.";
    }

    if (tombolKeluarKeluarga) {
      tombolKeluarKeluarga.innerHTML = owner
        ? '<ion-icon name="information-circle-outline"></ion-icon> Ketentuan Keluar'
        : '<ion-icon name="exit-outline"></ion-icon> Keluar dari Ruang Keluarga';
    }
  }

  function renderUndangan() {
    if (!panelUndangan || !hasilUndangan) return;

    if (!undanganAktif) {
      hasilUndangan.hidden = true;
      return;
    }

    hasilUndangan.hidden = false;
    kodeUndangan.textContent = undanganAktif.code || "----";
    kedaluwarsaUndangan.textContent = formatTanggalWaktu(undanganAktif.expires_at);

    if (undanganAktif.relationship) {
      hubunganRingkas.hidden = false;
      hubunganRingkas.textContent = `Hubungan: ${labelHubungan(undanganAktif.relationship)}`;
      if (selectHubungan) selectHubungan.value = undanganAktif.relationship;
    } else {
      hubunganRingkas.hidden = true;
      hubunganRingkas.textContent = "";
      if (selectHubungan) selectHubungan.value = "";
    }
  }

  async function muatUndanganAktif() {
    if (!family || !sayaOwner()) return;
    try {
      undanganAktif = await FamilyService.ambilUndanganAktif(family.id);
      if (undanganAktif && panelUndangan) panelUndangan.hidden = false;
      renderUndangan();
    } catch (error) {
      console.warn("[Undangan aktif]", error);
    }
  }

  async function muatData() {
    if (window.AUTH_READY) {
      const ok = await window.AUTH_READY;
      if (ok === false) return;
    }

    try {
      user = await AuthService.ambilUserAktif();
      family = await AuthRouter.ambilFamilyAktif();

      if (!family) {
        location.replace("keluarga-awal.html");
        return;
      }

      anggota = await FamilyService.ambilAnggotaKeluarga(family.id);

      namaKeluarga.textContent = family.name || "Keluarga Kami";
      form.elements.namaKeluarga.value = family.name || "";

      renderAnggota();
      renderHakAkses();

      // Publikasikan Family Core segera setelah family + anggota siap.
      // Jangan menunggu query undangan aktif, supaya fitur media/permission
      // tidak tertahan oleh request yang tidak terkait.
      window.FAMILY_CORE_STATE = { family, user, anggota };
      window.dispatchEvent(new CustomEvent("family-core-ready", {
        detail: window.FAMILY_CORE_STATE
      }));

      await muatUndanganAktif();
    } catch (error) {
      console.error("[Keluarga Backend]", error);
      tampilPesan(error?.message || "Data keluarga belum dapat dimuat.", "error");
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!family || !sayaOwner()) return;

    const nama = form.elements.namaKeluarga.value.trim();
    if (nama.length < 2) {
      tampilPesan("Nama keluarga minimal 2 karakter.", "error");
      return;
    }

    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;

    try {
      const updated = await FamilyService.ubahKeluarga(family.id, { name: nama });
      family.name = updated.name;
      namaKeluarga.textContent = updated.name;
      tampilPesan("Nama keluarga disimpan.", "success");
    } catch (error) {
      console.error("[Ubah keluarga]", error);
      tampilPesan(error?.message || "Nama keluarga gagal disimpan.", "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  tombolBukaUndangan?.addEventListener("click", () => {
    if (!sayaOwner()) return;
    panelUndangan.hidden = false;
    panelUndangan.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  tombolGenerate?.addEventListener("click", async () => {
    if (!family || !sayaOwner()) return;

    tombolGenerate.disabled = true;
    const htmlAwal = tombolGenerate.innerHTML;
    tombolGenerate.innerHTML = '<ion-icon name="sync-outline"></ion-icon> Membuat kode...';

    try {
      undanganAktif = await FamilyService.buatUndanganKeluarga({
        familyId: family.id,
        relationship: selectHubungan?.value || null,
        expiresHours: 24
      });

      renderUndangan();
      tampilPesan("Kode undangan baru siap dibagikan.", "success");
    } catch (error) {
      console.error("[Buat undangan]", error);
      tampilPesan(error?.message || "Kode undangan gagal dibuat.", "error");
    } finally {
      tombolGenerate.disabled = false;
      tombolGenerate.innerHTML = htmlAwal;
    }
  });

  tombolSalin?.addEventListener("click", async () => {
    const kode = undanganAktif?.code;
    if (!kode) return;

    const berhasil = await salinTeks(kode);

    if (berhasil) {
      tampilToastSalin("Kode tersalin");
      return;
    }

    prompt("Salin kode undangan berikut:", kode);
  });

  tombolBagikan?.addEventListener("click", async () => {
    const kode = undanganAktif?.code;
    if (!kode || !family) return;

    const hubungan = undanganAktif.relationship
      ? ` sebagai ${labelHubungan(undanganAktif.relationship)}`
      : "";

    const teks = `Gabung ke ${family.name}${hubungan} dengan kode ${kode}. Buka aplikasi, pilih Gabung Ruang Keluarga, lalu masukkan kode tersebut.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Undangan Keluarga", text: teks });
        return;
      } catch {
        // user menutup share sheet; lanjut fallback copy.
      }
    }

    const berhasil = await salinTeks(teks);

    if (berhasil) {
      tampilToastSalin("Undangan tersalin");
      return;
    }

    prompt("Salin undangan berikut:", teks);
  });

  document.querySelectorAll("[data-relationship-close]").forEach(tombol => {
    tombol.addEventListener("click", () => tutupRelationship());
  });

  sheetRelationship?.addEventListener("click", event => {
    if (event.target === sheetRelationship) {
      tutupRelationship();
    }
  });

  formRelationship?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!family || !targetHubungan || !bolehUbahRelationship(targetHubungan.item)) return;

    const hubunganBaru = String(formRelationship.elements.relationship?.value || "").trim() || null;
    const namaTarget = targetHubungan.nama;
    const userIdTarget = targetHubungan.item.user_id;
    const htmlAwal = tombolSubmitRelationship?.innerHTML || "";

    if (tombolSubmitRelationship) {
      tombolSubmitRelationship.disabled = true;
      tombolSubmitRelationship.innerHTML =
        '<ion-icon name="sync-outline"></ion-icon> Menyimpan...';
    }
    tampilPesanRelationship();

    try {
      const updated = await FamilyService.ubahHubunganAnggota(
        family.id,
        userIdTarget,
        hubunganBaru
      );

      const target = anggota.find(item => item.user_id === userIdTarget);
      if (target) {
        target.relationship = updated?.relationship ?? hubunganBaru;
      }

      renderAnggota();
      tutupRelationship({ paksa: true });
      tampilPesan(
        `Hubungan ${namaTarget} disimpan sebagai ${labelHubungan(hubunganBaru)}.`,
        "success"
      );
    } catch (error) {
      console.error("[Ubah hubungan anggota]", error);
      tampilPesanRelationship(
        error?.message || "Hubungan anggota belum berhasil disimpan.",
        "error"
      );
    } finally {
      if (tombolSubmitRelationship) {
        tombolSubmitRelationship.disabled = false;
        tombolSubmitRelationship.innerHTML = htmlAwal;
      }
    }
  });

  document.querySelectorAll("[data-transfer-ownership-close]").forEach(tombol => {
    tombol.addEventListener("click", () => tutupTransferOwnership());
  });

  sheetTransferOwnership?.addEventListener("click", event => {
    if (event.target === sheetTransferOwnership) {
      tutupTransferOwnership();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;

    if (sheetRelationship && !sheetRelationship.hidden) {
      tutupRelationship();
      return;
    }

    if (sheetTransferOwnership && !sheetTransferOwnership.hidden) {
      tutupTransferOwnership();
      return;
    }

    if (sheetKeluarKeluarga && !sheetKeluarKeluarga.hidden) {
      tutupKeluarKeluarga();
    }
  });

  formTransferOwnership?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!family || !sayaOwner() || !targetPemilikBaru) return;

    const password = String(formTransferOwnership.elements.password?.value || "");
    if (!password) {
      tampilPesanTransfer("Password saat ini wajib diisi.", "error");
      formTransferOwnership.elements.password?.focus();
      return;
    }

    const namaTarget = targetPemilikBaru.nama;
    const userIdTarget = targetPemilikBaru.item.user_id;
    const htmlAwal = tombolSubmitTransferOwnership?.innerHTML || "";
    let transferBerhasil = false;

    if (tombolSubmitTransferOwnership) {
      tombolSubmitTransferOwnership.disabled = true;
      tombolSubmitTransferOwnership.innerHTML =
        '<ion-icon name="sync-outline"></ion-icon> Memindahkan...';
    }
    tampilPesanTransfer();

    try {
      await AuthService.reautentikasi(password);
      await FamilyService.transferKepemilikan(family.id, userIdTarget);
      transferBerhasil = true;

      family = await AuthRouter.ambilFamilyAktif();
      if (!family) {
        location.replace("keluarga-awal.html");
        return;
      }

      anggota = await FamilyService.ambilAnggotaKeluarga(family.id);
      undanganAktif = null;

      renderAnggota();
      renderHakAkses();
      renderUndangan();
      window.FAMILY_CORE_STATE = { family, user, anggota };
      window.dispatchEvent(new CustomEvent("family-core-ready", {
        detail: window.FAMILY_CORE_STATE
      }));
      tutupTransferOwnership({ paksa: true });
      tampilPesan(
        `Kepemilikan Ruang Keluarga berhasil dipindahkan ke ${namaTarget}.`,
        "success"
      );
    } catch (error) {
      console.error("[Transfer kepemilikan]", error);

      if (transferBerhasil) {
        tampilPesanTransfer(
          "Kepemilikan sudah dipindahkan, tetapi tampilan belum berhasil diperbarui. Muat ulang halaman.",
          "error"
        );
      } else {
        tampilPesanTransfer(pesanErrorTransfer(error), "error");
      }
    } finally {
      if (tombolSubmitTransferOwnership) {
        tombolSubmitTransferOwnership.disabled = false;
        tombolSubmitTransferOwnership.innerHTML = htmlAwal;
      }
    }
  });

  tombolKeluarKeluarga?.addEventListener("click", () => {
    bukaKeluarKeluarga();
  });

  document.querySelectorAll("[data-leave-family-close]").forEach(tombol => {
    tombol.addEventListener("click", () => tutupKeluarKeluarga());
  });

  sheetKeluarKeluarga?.addEventListener("click", event => {
    if (event.target === sheetKeluarKeluarga) {
      tutupKeluarKeluarga();
    }
  });

  tombolKonfirmasiKeluar?.addEventListener("click", event => {
    event.preventDefault();
    konfirmasiKeluarKeluarga();
  });

  tombolBubarkanKeluarga?.addEventListener("click", () => {
    bukaBubarkanKeluarga();
  });

  document.querySelectorAll("[data-dissolve-family-close]").forEach(tombol => {
    tombol.addEventListener("click", () => tutupBubarkanKeluarga());
  });

  sheetBubarkanKeluarga?.addEventListener("click", event => {
    if (event.target === sheetBubarkanKeluarga) {
      tutupBubarkanKeluarga();
    }
  });

  formBubarkanKeluarga?.addEventListener("input", refreshTombolBubarkan);
  formBubarkanKeluarga?.addEventListener("submit", submitBubarkanKeluarga);

  document.addEventListener("click", () => {
    tutupMenuAnggota();
  });

  tombolCabut?.addEventListener("click", async () => {
    if (!undanganAktif?.invitation_id) return;

    const setuju = confirm("Cabut kode undangan ini? Kode tidak dapat dipakai lagi.");
    if (!setuju) return;

    tombolCabut.disabled = true;
    try {
      await FamilyService.cabutUndangan(undanganAktif.invitation_id);
      undanganAktif = null;
      renderUndangan();
      tampilPesan("Kode undangan dicabut.", "success");
    } catch (error) {
      console.error("[Cabut undangan]", error);
      tampilPesan(error?.message || "Kode undangan gagal dicabut.", "error");
    } finally {
      tombolCabut.disabled = false;
    }
  });

  muatData();
})();
