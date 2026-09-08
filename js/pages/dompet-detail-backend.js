(() => {
  "use strict";

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";
  const root = document.querySelector("[data-daftar-transaksi-root]");
  if (!root) return;

  let familyAktif = null;
  let dompet = [];
  let akun = [];
  let dompetAktif = null;
  let transaksiAktif = [];

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

  function tanggalID(teks) {
    if (!teks) return "-";
    const [y, m, d] = String(teks).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function bacaPreferensi() {
    try {
      return {
        dompetAktif: "",
        familyAktif: "",
        ...JSON.parse(localStorage.getItem(KUNCI_PENGATURAN) || "{}")
      };
    } catch {
      return { dompetAktif: "", familyAktif: "" };
    }
  }

  function simpanPreferensi(data) {
    const old = bacaPreferensi();
    localStorage.setItem(KUNCI_PENGATURAN, JSON.stringify({ ...old, ...data }));
  }

  async function ambilFamily() {
    const session = await AuthService.ambilSession();
    if (!session) throw new Error("Belum ada session Supabase. Login melalui login.html.");
    const families = await FamilyService.ambilKeluargaSaya();
    if (!families.length) throw new Error("Akun ini belum tergabung ke ruang keluarga.");
    const prefs = bacaPreferensi();
    const family = families.find(item => item.id === prefs.familyAktif) || families[0];
    simpanPreferensi({ familyAktif: family.id });
    return family;
  }

  function entryAktif(item) {
    return item.entries?.find(entry => entry.wallet_id === dompetAktif.wallet_id) || null;
  }

  function entryLawan(item) {
    return item.entries?.find(entry => entry.wallet_id !== dompetAktif.wallet_id) || null;
  }

  function infoTransaksi(item) {
    const active = entryAktif(item);
    const delta = Number(active?.amount_delta ?? item.amount_delta ?? 0);
    const dataAkun = akun.find(x => x.id === item.account_id);

    if (item.kind === "transfer") {
      const lawan = entryLawan(item);
      const keluar = delta < 0;
      const fee = Number(item.transfer_fee || 0);
      const feeInfo = fee > 0 ? ` • Admin ${rupiah(fee, dompetAktif.currency_code)}` : "";
      return {
        nama: keluar ? `Transfer ke ${lawan?.wallet?.name || "Dompet"}` : `Transfer dari ${lawan?.wallet?.name || "Dompet"}`,
        sub: `${item.note || "Transfer antar dompet"}${feeInfo}`,
        ikon: "swap-horizontal-outline",
        nilai: Math.abs(delta),
        tanda: delta >= 0 ? "+" : "−",
        tone: "transfer"
      };
    }

    if (item.kind === "adjustment") {
      return {
        nama: "Penyesuaian Saldo",
        sub: item.note || "Penyesuaian saldo dompet",
        ikon: "options-outline",
        nilai: Math.abs(delta),
        tanda: delta >= 0 ? "+" : "−",
        tone: "transfer"
      };
    }

    const income = item.kind === "income";
    return {
      nama: dataAkun?.name || (income ? "Pemasukan" : "Pengeluaran"),
      sub: item.note || (income ? "Pemasukan" : "Pengeluaran"),
      ikon: dataAkun?.icon_value || "ellipse-outline",
      nilai: Number(item.amount || Math.abs(delta)),
      tanda: income ? "+" : "−",
      tone: income ? "pemasukan" : "pengeluaran"
    };
  }

  function renderTransaksi() {
    const container = document.querySelector("[data-transaksi-dompet]");
    const subtitle = document.querySelector("[data-subjudul-transaksi]");
    if (!container) return;

    container.innerHTML = "";
    if (subtitle) subtitle.textContent = `${transaksiAktif.length} transaksi • ${FinancePeriod.getLabel()}`;

    if (!transaksiAktif.length) {
      container.innerHTML = `
        <div class="kosong-detail">
          <ion-icon name="receipt-outline"></ion-icon>
          Belum ada transaksi untuk ${escapeHTML(dompetAktif.name)} pada periode ini.
        </div>`;
      return;
    }

    let tanggalSebelumnya = "";
    transaksiAktif.forEach(item => {
      if (tanggalSebelumnya !== item.occurred_on) {
        const date = document.createElement("h3");
        date.className = "tanggal-transaksi-detail";
        date.textContent = tanggalID(item.occurred_on);
        container.appendChild(date);
        tanggalSebelumnya = item.occurred_on;
      }

      const info = infoTransaksi(item);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `transaksi-detail-item ${info.tone}`;
      button.innerHTML = `
        <span class="transaksi-detail-ikon"><ion-icon name="${escapeHTML(info.ikon)}"></ion-icon></span>
        <span class="transaksi-detail-info">
          <strong>${escapeHTML(info.nama)}</strong>
          <span>${escapeHTML(info.sub)}</span>
        </span>
        <strong class="transaksi-detail-nilai">${info.tanda} ${rupiah(info.nilai, dompetAktif.currency_code)}</strong>
        <ion-icon name="chevron-forward-outline"></ion-icon>`;
      button.addEventListener("click", () => {
        location.href = `detail-transaksi.html?id=${encodeURIComponent(item.id)}&from_wallet=${encodeURIComponent(dompetAktif.wallet_id)}`;
      });
      container.appendChild(button);
    });
  }

  function renderUtama() {
    if (!dompetAktif) return;
    document.querySelector("[data-pemilih-dompet-ikon]")?.setAttribute("name", dompetAktif.icon_value || "wallet-outline");
    document.querySelector("[data-pemilih-dompet-nama]").textContent = dompetAktif.name;
    document.querySelector("[data-detail-ikon]")?.setAttribute("name", dompetAktif.icon_value || "wallet-outline");
    document.querySelector("[data-detail-nama]").textContent = dompetAktif.name;
    document.querySelector("[data-detail-saldo]").textContent = rupiah(dompetAktif.current_balance, dompetAktif.currency_code);
    document.querySelector("[data-laporan-dompet]").href = `laporan-dompet.html?id=${encodeURIComponent(dompetAktif.wallet_id)}`;
    document.querySelector("[data-tambah-transaksi-detail]").href = `transaksi.html?dompet=${encodeURIComponent(dompetAktif.wallet_id)}`;
    history.replaceState(null, "", `dompet-detail.html?id=${encodeURIComponent(dompetAktif.wallet_id)}`);
    FinancePeriod.sync();
    renderTransaksi();
  }

  async function muatTransaksi() {
    if (!familyAktif || !dompetAktif) return;
    const range = FinancePeriod.getRange();
    const container = document.querySelector("[data-transaksi-dompet]");
    if (container) {
      container.innerHTML = `<div class="kosong-detail"><ion-icon name="cloud-download-outline"></ion-icon>Mengambil transaksi...</div>`;
    }
    transaksiAktif = await FinanceService.ambilTransaksiDompet({
      familyId: familyAktif.id,
      walletId: dompetAktif.wallet_id,
      startDate: range.startDate,
      endDate: range.endDate,
      limit: 300
    });
    renderTransaksi();
  }

  function renderPilihanDompet() {
    const list = document.querySelector("[data-detail-daftar-dompet]");
    if (!list) return;
    list.innerHTML = "";

    dompet.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pilihan-dompet-detail";
      button.innerHTML = `
        <span class="pilihan-dompet-detail-ikon"><ion-icon name="${escapeHTML(item.icon_value || "wallet-outline")}"></ion-icon></span>
        <span class="pilihan-dompet-detail-info"><strong>${escapeHTML(item.name)}</strong><span>${rupiah(item.current_balance, item.currency_code)}</span></span>
        ${item.wallet_id === dompetAktif?.wallet_id ? '<ion-icon class="cek-dompet-detail" name="checkmark-circle"></ion-icon>' : ""}`;
      button.addEventListener("click", async () => {
        dompetAktif = item;
        simpanPreferensi({ dompetAktif: item.wallet_id });
        document.getElementById("sheet-dompet-detail").hidden = true;
        renderUtama();
        renderPilihanDompet();
        await muatTransaksi();
      });
      list.appendChild(button);
    });
  }

  async function init() {
    if (window.AUTH_READY) {
      const authOK = await window.AUTH_READY;
      if (authOK === false) return;
    }

    try {
      familyAktif = await ambilFamily();
      const [walletRows, accountRows] = await Promise.all([
        FinanceService.ambilSaldoDompet(familyAktif.id),
        FinanceService.ambilAkun(familyAktif.id)
      ]);
      dompet = walletRows || [];
      akun = accountRows || [];
      if (!dompet.length) throw new Error("Belum ada dompet pada ruang keluarga ini.");

      const prefs = bacaPreferensi();
      const idUrl = new URLSearchParams(location.search).get("id");
      dompetAktif = dompet.find(item => item.wallet_id === idUrl)
        || dompet.find(item => item.wallet_id === prefs.dompetAktif)
        || dompet[0];
      simpanPreferensi({ dompetAktif: dompetAktif.wallet_id });

      FinancePeriod.mount();
      renderPilihanDompet();
      renderUtama();
      await muatTransaksi();
    } catch (error) {
      console.error("[Daftar Transaksi]", error);
      const container = document.querySelector("[data-transaksi-dompet]");
      if (container) container.innerHTML = `<div class="kosong-detail"><ion-icon name="alert-circle-outline"></ion-icon>${escapeHTML(error?.message || "Data belum dapat dimuat.")}</div>`;
    }
  }

  document.querySelector("[data-detail-buka-dompet]")?.addEventListener("click", () => {
    renderPilihanDompet();
    document.getElementById("sheet-dompet-detail").hidden = false;
  });
  document.querySelector("[data-detail-tutup-dompet]")?.addEventListener("click", () => {
    document.getElementById("sheet-dompet-detail").hidden = true;
  });
  document.getElementById("sheet-dompet-detail")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) event.currentTarget.hidden = true;
  });

  window.addEventListener("finance-period-change", muatTransaksi);
  document.addEventListener("DOMContentLoaded", init);
})();
