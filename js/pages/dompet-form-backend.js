(() => {
  "use strict";

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";
  const form = document.querySelector("[data-form-dompet]");
  if (!form) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const setupAwalDiminta = params.get("setup") === "awal" && !id;

  const judul = document.querySelector("[data-judul-form]");
  const intro = document.querySelector("[data-setup-dompet]");
  const kembali = document.querySelector("[data-kembali-dompet]");
  const simpan = document.querySelector("[data-simpan-dompet]");
  const arsip = document.querySelector("[data-hapus-dompet]");
  const labelSaldo = document.querySelector("[data-label-saldo]");
  const bantuanSaldo = document.querySelector("[data-bantuan-saldo]");
  const notif = document.querySelector("[data-notifikasi]");

  let familyAktif = null;
  let walletAktif = null;
  let semuaWallet = [];
  let sedangSimpan = false;

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

  function angkaDariNominal(value) {
    const digit = String(value ?? "").replace(/\D/g, "");
    if (!digit) return 0;
    const n = Number(digit);
    return Number.isSafeInteger(n) ? n : Number.NaN;
  }

  function formatNominal(value) {
    const n = typeof value === "number" ? value : angkaDariNominal(value);
    if (!Number.isFinite(n)) return "";
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
  }

  function pasangFormatSaldo() {
    const el = form.elements.saldo;
    if (!el) return;
    el.addEventListener("input", () => {
      const n = angkaDariNominal(el.value);
      el.value = Number.isFinite(n) ? formatNominal(n) : "";
    });
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

  function setDisabled(disabled) {
    Array.from(form.elements).forEach(el => {
      if (el === form.elements.saldo && walletAktif) return;
      el.disabled = disabled;
    });

    if (walletAktif) {
      form.elements.saldo.readOnly = true;
      form.elements.saldo.disabled = false;
    }
  }

  async function ambilFamily() {
    const session = await AuthService.ambilSession();
    if (!session) {
      throw new Error("Belum ada session Supabase. Login melalui login.html.");
    }

    const families = await FamilyService.ambilKeluargaSaya();
    if (!families.length) {
      throw new Error("Akun ini belum tergabung ke keluarga backend.");
    }

    const pref = bacaPreferensi();
    const family = families.find(item => item.id === pref.familyAktif) || families[0];
    simpanPreferensi({ familyAktif: family.id });
    return family;
  }

  function isiFormEdit(wallet) {
    judul.textContent = "Edit Dompet";
    arsip.hidden = false;

    form.elements.nama.value = wallet.name || "";
    form.elements.jenis.value = wallet.wallet_type || "other";
    form.elements.saldo.value = formatNominal(Number(wallet.current_balance || 0));
    form.elements.saldo.readOnly = true;
    form.elements.ikon.value = wallet.icon_value || "wallet-outline";

    labelSaldo.textContent = "Saldo Saat Ini";
    bantuanSaldo.textContent =
      "Saldo tidak diedit dari master dompet. Koreksi saldo harus lewat transaksi/penyesuaian agar jejak keuangan tetap utuh.";
    simpan.textContent = "Simpan Perubahan";
  }

  function isiFormBaru(setupAwal) {
    judul.textContent = setupAwal ? "Siapkan Dompet Pertamamu" : "Tambah Dompet";
    intro.hidden = !setupAwal;
    kembali.hidden = setupAwal;
    arsip.hidden = true;
    labelSaldo.textContent = "Saldo Awal";
    bantuanSaldo.textContent = "Saldo awal hanya dipakai sekali saat dompet dibuat.";
    simpan.textContent = setupAwal ? "Mulai Menggunakan Aplikasi" : "Simpan Dompet";
  }

  pasangFormatSaldo();

  async function init() {
    if (window.AUTH_READY) {
      const authOK = await window.AUTH_READY;
      if (authOK === false) return;
    }

    try {
      setDisabled(true);
      familyAktif = await ambilFamily();
      semuaWallet = await FinanceService.ambilSaldoDompet(familyAktif.id);

      if (id) {
        walletAktif = semuaWallet.find(item => item.wallet_id === id) || null;
        if (!walletAktif) {
          throw new Error("Dompet tidak ditemukan atau sudah diarsipkan.");
        }
        isiFormEdit(walletAktif);
      } else {
        if (setupAwalDiminta && semuaWallet.length) {
          location.replace("index.html");
          return;
        }
        isiFormBaru(setupAwalDiminta);
      }

      setDisabled(false);
    } catch (error) {
      console.error("[Dompet Form Backend]", error);
      tampilPesan(error?.message || "Form dompet belum dapat dimuat.");
      setDisabled(true);
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (sedangSimpan || !familyAktif) return;

    bersihkanPesan();

    const name = form.elements.nama.value.trim();
    const walletType = form.elements.jenis.value;
    const iconValue = form.elements.ikon.value || "wallet-outline";
    const openingBalance = angkaDariNominal(form.elements.saldo.value);

    if (!name) {
      tampilPesan("Nama dompet wajib diisi.");
      return;
    }

    if (!walletAktif && (!Number.isSafeInteger(openingBalance) || openingBalance < 0)) {
      tampilPesan("Saldo awal harus berupa angka bulat 0 atau lebih.");
      return;
    }

    sedangSimpan = true;
    simpan.disabled = true;
    simpan.textContent = walletAktif ? "Menyimpan..." : "Membuat Dompet...";

    try {
      let walletId;

      if (walletAktif) {
        walletId = await FinanceService.ubahDompet({
          walletId: walletAktif.wallet_id,
          name,
          walletType,
          iconType: walletAktif.icon_type || "ionicon",
          iconValue,
          color: walletAktif.color || null,
          sortOrder: Number(walletAktif.sort_order || 0)
        });
      } else {
        walletId = await FinanceService.buatDompet({
          familyId: familyAktif.id,
          name,
          walletType,
          currencyCode: familyAktif.default_currency || "IDR",
          openingBalance,
          iconType: "ionicon",
          iconValue,
          color: null,
          sortOrder: semuaWallet.length
        });
      }

      simpanPreferensi({
        familyAktif: familyAktif.id,
        dompetAktif: walletId
      });

      tampilPesan(walletAktif ? "Perubahan dompet tersimpan." : "Dompet berhasil dibuat.", "success");

      setTimeout(() => {
        location.href = setupAwalDiminta
          ? "index.html"
          : `dompet-detail.html?id=${encodeURIComponent(walletId)}`;
      }, 350);
    } catch (error) {
      console.error("[Simpan Dompet]", error);
      tampilPesan(error?.message || "Dompet gagal disimpan.");
      sedangSimpan = false;
      simpan.disabled = false;
      simpan.textContent = walletAktif ? "Simpan Perubahan" : (setupAwalDiminta ? "Mulai Menggunakan Aplikasi" : "Simpan Dompet");
    }
  });

  arsip.addEventListener("click", async () => {
    if (!walletAktif || sedangSimpan) return;

    const saldo = Number(walletAktif.current_balance || 0);
    const infoSaldo = saldo !== 0
      ? `\n\nSaldo saat ini masih ${new Intl.NumberFormat("id-ID", { style: "currency", currency: walletAktif.currency_code || "IDR", minimumFractionDigits: 0 }).format(saldo)}. Backend akan menolak arsip sampai saldo Rp0.`
      : "";

    if (!confirm(
      `Arsipkan dompet ${walletAktif.name}?\n\nHistory transaksi TIDAK akan dihapus.${infoSaldo}`
    )) return;

    sedangSimpan = true;
    arsip.disabled = true;
    simpan.disabled = true;

    try {
      await FinanceService.arsipDompet(walletAktif.wallet_id);

      const sisaWallet = semuaWallet.filter(item => item.wallet_id !== walletAktif.wallet_id);
      const pref = bacaPreferensi();

      if (pref.dompetAktif === walletAktif.wallet_id) {
        simpanPreferensi({ dompetAktif: sisaWallet[0]?.wallet_id || "" });
      }

      location.href = sisaWallet.length
        ? "dompet.html"
        : "dompet-form.html?setup=awal";
    } catch (error) {
      console.error("[Arsip Dompet]", error);
      tampilPesan(error?.message || "Dompet gagal diarsipkan.");
      sedangSimpan = false;
      arsip.disabled = false;
      simpan.disabled = false;
    }
  });

  init();
})();
