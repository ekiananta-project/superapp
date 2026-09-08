(() => {
  "use strict";

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";
  const root = document.querySelector("[data-laporan-dompet-root]");
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

  function bacaPreferensi() {
    try {
      return { dompetAktif: "", familyAktif: "", ...JSON.parse(localStorage.getItem(KUNCI_PENGATURAN) || "{}") };
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

  function totalArus(daftar) {
    let masuk = 0;
    let keluar = 0;
    daftar.forEach(item => {
      const delta = Number(entryAktif(item)?.amount_delta ?? item.amount_delta ?? 0);
      if (delta > 0) masuk += delta;
      if (delta < 0) keluar += Math.abs(delta);
    });
    return { masuk, keluar };
  }

  function kelompokAkun(daftar, kind) {
    const map = new Map();
    daftar.filter(item => item.kind === kind && item.account_id).forEach(item => {
      map.set(item.account_id, (map.get(item.account_id) || 0) + Number(item.amount || 0));
    });

    const hasil = [...map.entries()].map(([accountId, jumlah]) => {
      const dataAkun = akun.find(item => item.id === accountId);
      return {
        akunId: accountId,
        nama: dataAkun?.name || "Kategori",
        ikon: dataAkun?.icon_value || "ellipse-outline",
        jumlah
      };
    });

    if (kind === "expense") {
      const fee = daftar.reduce((total, item) => {
        if (item.kind !== "transfer" || Number(item.transfer_fee || 0) <= 0) return total;
        const delta = Number(entryAktif(item)?.amount_delta ?? item.amount_delta ?? 0);
        return delta < 0 ? total + Number(item.transfer_fee || 0) : total;
      }, 0);
      if (fee > 0) {
        hasil.push({ akunId: "__transfer_fee__", nama: "Biaya Admin Transfer", ikon: "card-outline", jumlah: fee });
      }
    }

    return hasil.sort((a, b) => b.jumlah - a.jumlah);
  }

  function renderKategori(elemen, daftar, jenis, total) {
    if (!elemen) return;
    elemen.innerHTML = "";
    if (!daftar.length) {
      elemen.innerHTML = `<div class="kosong-detail"><ion-icon name="pie-chart-outline"></ion-icon>Belum ada ${jenis} pada periode ini.</div>`;
      return;
    }

    daftar.forEach(item => {
      const persen = total > 0 ? (item.jumlah / total) * 100 : 0;
      const node = document.createElement("div");
      node.className = `item-kategori-detail ${jenis === "pemasukan" ? "pemasukan" : ""}`;
      node.innerHTML = `
        <span class="item-kategori-ikon"><ion-icon name="${escapeHTML(item.ikon)}"></ion-icon></span>
        <span class="item-kategori-info">
          <span class="item-kategori-header"><strong>${escapeHTML(item.nama)}</strong><span>${Math.round(persen)}%</span></span>
          <span class="item-kategori-track"><span class="item-kategori-fill" style="width:${Math.min(persen, 100)}%"></span></span>
        </span>
        <strong class="item-kategori-nilai">${rupiah(item.jumlah, dompetAktif.currency_code)}</strong>`;
      elemen.appendChild(node);
    });
  }

  function renderUtama() {
    if (!dompetAktif) return;
    const { masuk, keluar } = totalArus(transaksiAktif);
    const arusBersih = masuk - keluar;

    document.querySelector("[data-pemilih-dompet-ikon]")?.setAttribute("name", dompetAktif.icon_value || "wallet-outline");
    document.querySelector("[data-pemilih-dompet-nama]").textContent = dompetAktif.name;
    document.querySelector("[data-detail-ikon]")?.setAttribute("name", dompetAktif.icon_value || "wallet-outline");
    document.querySelector("[data-detail-nama]").textContent = dompetAktif.name;
    document.querySelector("[data-detail-saldo]").textContent = rupiah(dompetAktif.current_balance, dompetAktif.currency_code);
    document.querySelector("[data-total-pemasukan]").textContent = rupiah(masuk, dompetAktif.currency_code);
    document.querySelector("[data-total-pengeluaran]").textContent = rupiah(keluar, dompetAktif.currency_code);
    document.querySelector("[data-banding-pemasukan]").textContent = rupiah(masuk, dompetAktif.currency_code);
    document.querySelector("[data-banding-pengeluaran]").textContent = rupiah(keluar, dompetAktif.currency_code);
    document.querySelector("[data-tambah-transaksi-detail]").href = `transaksi.html?dompet=${encodeURIComponent(dompetAktif.wallet_id)}`;
    document.querySelector("[data-edit-dompet]").href = `dompet-form.html?id=${encodeURIComponent(dompetAktif.wallet_id)}`;
    document.querySelector("[data-kembali-daftar]").href = `dompet-detail.html?id=${encodeURIComponent(dompetAktif.wallet_id)}`;
    history.replaceState(null, "", `laporan-dompet.html?id=${encodeURIComponent(dompetAktif.wallet_id)}`);

    const arusEl = document.querySelector("[data-arus-bersih]");
    arusEl.textContent = `${arusBersih > 0 ? "+ " : ""}${rupiah(arusBersih, dompetAktif.currency_code)}`;
    const kartuArus = document.querySelector(".kartu-ringkasan-detail.arus-bersih");
    const statusArus = document.querySelector("[data-status-arus]");
    kartuArus.classList.remove("is-surplus", "is-defisit");
    if (arusBersih > 0) {
      kartuArus.classList.add("is-surplus");
      statusArus.textContent = "Surplus";
    } else if (arusBersih < 0) {
      kartuArus.classList.add("is-defisit");
      statusArus.textContent = "Defisit";
    } else {
      statusArus.textContent = "Seimbang";
    }

    const max = Math.max(masuk, keluar, 1);
    document.querySelector("[data-bar-pemasukan]").style.width = `${(masuk / max) * 100}%`;
    document.querySelector("[data-bar-pengeluaran]").style.width = `${(keluar / max) * 100}%`;

    const pengeluaranKategori = kelompokAkun(transaksiAktif, "expense");
    const pemasukanKategori = kelompokAkun(transaksiAktif, "income");
    renderKategori(document.querySelector("[data-kategori-pengeluaran]"), pengeluaranKategori, "pengeluaran", pengeluaranKategori.reduce((a, b) => a + b.jumlah, 0));
    renderKategori(document.querySelector("[data-kategori-pemasukan]"), pemasukanKategori, "pemasukan", pemasukanKategori.reduce((a, b) => a + b.jumlah, 0));
    FinancePeriod.sync();
  }

  async function muatTransaksi() {
    if (!familyAktif || !dompetAktif) return;
    const range = FinancePeriod.getRange();
    transaksiAktif = await FinanceService.ambilTransaksiDompet({
      familyId: familyAktif.id,
      walletId: dompetAktif.wallet_id,
      startDate: range.startDate,
      endDate: range.endDate,
      limit: 500
    });
    renderUtama();
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
      await muatTransaksi();
    } catch (error) {
      console.error("[Laporan Dompet]", error);
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
