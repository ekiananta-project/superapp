(() => {
  "use strict";

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";
  const form = document.querySelector("[data-form-akun]");
  if (!form) return;

  const params = new URLSearchParams(location.search);
  const accountId = params.get("id");

  const judul = document.querySelector("[data-judul-form]");
  const simpan = document.querySelector("[data-simpan-akun]");
  const arsip = document.querySelector("[data-hapus-akun]");
  const bantuanJenis = document.querySelector("[data-bantuan-jenis]");
  const notif = document.querySelector("[data-notifikasi]");

  let familyAktif = null;
  let userAktif = null;
  let accountAktif = null;
  let semuaAkun = [];
  let bolehKelola = true;
  let sedangProses = false;

  const KIND_DB = {
    pengeluaran: "expense",
    pemasukan: "income"
  };

  const KIND_UI = {
    expense: "pengeluaran",
    income: "pemasukan"
  };

  function bacaPreferensi() {
    try {
      return JSON.parse(localStorage.getItem(KUNCI_PENGATURAN) || "{}");
    } catch {
      return {};
    }
  }

  function simpanPreferensi(data) {
    const lama = bacaPreferensi();
    localStorage.setItem(
      KUNCI_PENGATURAN,
      JSON.stringify({ ...lama, ...data })
    );
  }

  function tampilPesan(message, tipe = "error") {
    if (!notif) return;
    notif.hidden = false;
    notif.textContent = message;
    notif.dataset.tipe = tipe;
  }

  function bersihkanPesan() {
    if (!notif) return;
    notif.hidden = true;
    notif.textContent = "";
  }

  function setFormDisabled(disabled) {
    Array.from(form.elements).forEach(el => {
      el.disabled = disabled;
    });
  }

  function setVisual(iconValue, colorValue) {
    const icon = iconValue || "ellipse-outline";
    const color = colorValue || "#E58A2B";

    if (form.elements.ikon) form.elements.ikon.value = icon;
    if (form.elements.warna) form.elements.warna.value = color;

    if (window.AccountVisualPicker) {
      window.AccountVisualPicker.setSelection(icon, color);
    }
  }

  async function ambilFamily() {
    const session = await AuthService.ambilSession();
    if (!session) {
      throw new Error("Belum ada session Supabase. Login melalui login.html.");
    }

    userAktif = await AuthService.ambilUserAktif();

    const families = await FamilyService.ambilKeluargaSaya();
    if (!families.length) {
      throw new Error("Akun ini belum tergabung ke keluarga backend.");
    }

    const pref = bacaPreferensi();
    const family = families.find(item => item.id === pref.familyAktif) || families[0];
    simpanPreferensi({ familyAktif: family.id });
    return family;
  }

  function cekBolehKelola(account, family) {
    if (!account) return true;
    return Boolean(
      family?.membership?.role === "owner" ||
      (userAktif?.id && account.created_by === userAktif.id)
    );
  }

  function isiFormBaru() {
    judul.textContent = "Tambah Akun";
    arsip.hidden = true;
    const simpanText = simpan.querySelector("span");
    if (simpanText) simpanText.textContent = "Simpan Akun";
    else simpan.textContent = "Simpan Akun";
    bantuanJenis.textContent = "Pilih apakah akun ini dipakai untuk pengeluaran atau pemasukan.";
    setVisual(form.elements.ikon.value || "fast-food-outline", form.elements.warna?.value || "#E58A2B");
  }

  function isiFormEdit(account) {
    judul.textContent = "Edit Akun";
    const simpanText = simpan.querySelector("span");
    if (simpanText) simpanText.textContent = "Simpan Perubahan";
    else simpan.textContent = "Simpan Perubahan";
    arsip.hidden = false;

    form.elements.nama.value = account.name || "";
    form.elements.jenis.value = KIND_UI[account.kind] || "pengeluaran";
    setVisual(account.icon_value || "ellipse-outline", account.color || "#E58A2B");

    // Jenis akun adalah identitas semantik. Tidak boleh expense <-> income.
    form.elements.jenis.disabled = true;
    bantuanJenis.textContent =
      "Jenis akun dikunci setelah dibuat agar transaksi lama tidak berubah makna. Jika salah jenis, buat akun baru lalu arsipkan akun ini.";
  }

  async function init() {
    if (window.AUTH_READY) {
      const authOK = await window.AUTH_READY;
      if (authOK === false) return;
    }

    try {
      setFormDisabled(true);
      familyAktif = await ambilFamily();
      semuaAkun = await FinanceService.ambilAkun(familyAktif.id);

      if (accountId) {
        accountAktif = semuaAkun.find(item => item.id === accountId) || null;
        if (!accountAktif) {
          throw new Error("Akun tidak ditemukan atau sudah diarsipkan.");
        }

        bolehKelola = cekBolehKelola(accountAktif, familyAktif);
        isiFormEdit(accountAktif);
      } else {
        isiFormBaru();
      }

      setFormDisabled(false);

      if (accountAktif) {
        form.elements.jenis.disabled = true;
      }

      if (!bolehKelola) {
        setFormDisabled(true);
        simpan.hidden = true;
        arsip.hidden = true;
        tampilPesan("Mode baca: hanya pembuat akun atau owner keluarga yang dapat mengubah akun ini.", "info");
      }
    } catch (error) {
      console.error("[Akun Form Backend]", error);
      tampilPesan(error?.message || "Form akun belum dapat dimuat.");
      setFormDisabled(true);
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (sedangProses || !familyAktif || !bolehKelola) return;

    bersihkanPesan();

    const name = form.elements.nama.value.trim();
    const kindUI = accountAktif
      ? (KIND_UI[accountAktif.kind] || "pengeluaran")
      : form.elements.jenis.value;
    const kind = KIND_DB[kindUI];
    const iconValue = form.elements.ikon.value || "ellipse-outline";
    const colorValue = form.elements.warna?.value || "#E58A2B";

    if (!name) {
      tampilPesan("Nama akun wajib diisi.");
      return;
    }

    if (name.length > 80) {
      tampilPesan("Nama akun maksimal 80 karakter.");
      return;
    }

    if (!kind) {
      tampilPesan("Jenis akun tidak valid.");
      return;
    }

    sedangProses = true;
    simpan.disabled = true;
    const simpanTextProses = simpan.querySelector("span");
    const teksProses = accountAktif ? "Menyimpan..." : "Membuat Akun...";
    if (simpanTextProses) simpanTextProses.textContent = teksProses;
    else simpan.textContent = teksProses;

    try {
      let idHasil;

      if (accountAktif) {
        idHasil = await FinanceService.ubahAkun({
          accountId: accountAktif.id,
          name,
          kind: accountAktif.kind,
          iconType: accountAktif.icon_type || "ionicon",
          iconValue,
          color: colorValue,
          sortOrder: Number(accountAktif.sort_order || 0)
        });
      } else {
        const sortOrder = semuaAkun.reduce(
          (max, item) => Math.max(max, Number(item.sort_order || 0)),
          -1
        ) + 1;

        idHasil = await FinanceService.buatAkun({
          familyId: familyAktif.id,
          name,
          kind,
          iconType: "ionicon",
          iconValue,
          color: colorValue,
          sortOrder
        });
      }

      tampilPesan(accountAktif ? "Perubahan akun tersimpan." : "Akun berhasil dibuat.", "success");

      setTimeout(() => {
        location.href = "akun.html";
      }, 350);
    } catch (error) {
      console.error("[Simpan Akun]", error);
      tampilPesan(error?.message || "Akun gagal disimpan.");
      sedangProses = false;
      simpan.disabled = false;
      const simpanTextError = simpan.querySelector("span");
      const teksNormal = accountAktif ? "Simpan Perubahan" : "Simpan Akun";
      if (simpanTextError) simpanTextError.textContent = teksNormal;
      else simpan.textContent = teksNormal;
    }
  });

  arsip.addEventListener("click", async () => {
    if (!accountAktif || sedangProses || !bolehKelola) return;

    const jenis = accountAktif.kind === "income" ? "pemasukan" : "pengeluaran";

    if (!confirm(
      `Arsipkan akun ${accountAktif.name}?\n\nAkun akan hilang dari pilihan transaksi ${jenis} baru, tetapi seluruh history transaksi lama tetap tersimpan.`
    )) return;

    sedangProses = true;
    simpan.disabled = true;
    arsip.disabled = true;

    try {
      await FinanceService.arsipAkun(accountAktif.id);
      location.href = "akun.html";
    } catch (error) {
      console.error("[Arsip Akun]", error);
      tampilPesan(error?.message || "Akun gagal diarsipkan.");
      sedangProses = false;
      simpan.disabled = false;
      arsip.disabled = false;
    }
  });

  init();
})();
