(() => {
  "use strict";

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";
  const root = document.querySelector("[data-daftar-dompet]");
  if (!root) return;

  const LABEL_JENIS = {
    cash: "Cash",
    bank: "Bank",
    ewallet: "E-Wallet",
    other: "Lainnya"
  };

  function rupiah(angka, currency = "IDR") {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency || "IDR",
      minimumFractionDigits: 0
    }).format(Number(angka || 0));
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

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

  async function ambilFamilyAktif() {
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

    if (family.id !== pref.familyAktif) {
      simpanPreferensi({ familyAktif: family.id });
    }

    return family;
  }

  function tampilError(error) {
    console.error("[Dompet Backend]", error);
    root.innerHTML = `
      <div class="kosong-data dompet-backend-error">
        <ion-icon name="cloud-offline-outline"></ion-icon>
        <span>${escapeHTML(error?.message || "Dompet backend belum dapat dimuat.")}</span>
      </div>`;
  }

  async function init() {
    if (window.AUTH_READY) {
      const authOK = await window.AUTH_READY;
      if (authOK === false) return;
    }

    try {
      const family = await ambilFamilyAktif();
      const dompet = await FinanceService.ambilSaldoDompet(family.id);

      root.innerHTML = "";

      if (!dompet.length) {
        root.innerHTML = `
          <div class="kosong-data">
            <ion-icon name="wallet-outline"></ion-icon>
            <span>Belum ada dompet pada keluarga ini.</span>
            <a class="tombol-utama" href="dompet-form.html?setup=awal">Buat Dompet Pertama</a>
          </div>`;
        return;
      }

      dompet.forEach(item => {
        const link = document.createElement("a");
        link.href = `dompet-detail.html?id=${encodeURIComponent(item.wallet_id)}`;
        link.className = "kartu-list";
        link.innerHTML = `
          <span class="ikon-bulat">
            <ion-icon name="${escapeHTML(item.icon_value || "wallet-outline")}"></ion-icon>
          </span>
          <span class="kartu-list-info">
            <strong>${escapeHTML(item.name)}</strong>
            <span>${escapeHTML(LABEL_JENIS[item.wallet_type] || item.wallet_type || "Dompet")}</span>
          </span>
          <span class="kartu-list-nilai">${rupiah(item.current_balance, item.currency_code)}</span>
          <ion-icon name="chevron-forward-outline"></ion-icon>`;
        root.appendChild(link);
      });
    } catch (error) {
      tampilError(error);
    }
  }

  init();
})();
