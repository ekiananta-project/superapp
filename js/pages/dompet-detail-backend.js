(() => {
  "use strict";

  const KUNCI_PENGATURAN = "keuangan_pengaturan_v1";
  const root = document.querySelector(".detail-dompet");
  if (!root) return;

  let familyAktif = null;
  let dompet = [];
  let akun = [];
  let dompetAktif = null;
  let transaksiAktif = [];
  let preferensi = null;

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
        periodeAktif: "month",
        familyAktif: "",
        ...JSON.parse(localStorage.getItem(KUNCI_PENGATURAN) || "{}")
      };
    } catch {
      return { dompetAktif: "", periodeAktif: "month", familyAktif: "" };
    }
  }

  function simpanPreferensi(data) {
    preferensi = { ...bacaPreferensi(), ...data };
    localStorage.setItem(KUNCI_PENGATURAN, JSON.stringify(preferensi));
  }

  function tanggalLokal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function rentangPeriode(mode) {
    if (mode === "all") return { startDate: null, endDate: null };

    const now = new Date();
    let awal;
    let akhir;

    if (mode === "week") {
      awal = new Date(now);
      const day = (awal.getDay() + 6) % 7;
      awal.setDate(awal.getDate() - day);
      akhir = new Date(awal);
      akhir.setDate(akhir.getDate() + 6);
    } else if (mode === "year") {
      awal = new Date(now.getFullYear(), 0, 1);
      akhir = new Date(now.getFullYear(), 11, 31);
    } else {
      awal = new Date(now.getFullYear(), now.getMonth(), 1);
      akhir = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return { startDate: tanggalLokal(awal), endDate: tanggalLokal(akhir) };
  }

  function labelPeriode(mode) {
    const now = new Date();
    if (mode === "all") return "Semua Periode";
    if (mode === "year") return String(now.getFullYear());
    if (mode === "month") {
      return now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    }
    if (mode === "week") {
      const awal = new Date(now);
      const day = (awal.getDay() + 6) % 7;
      awal.setDate(awal.getDate() - day);
      const akhir = new Date(awal);
      akhir.setDate(akhir.getDate() + 6);
      return `${awal.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${akhir.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return "Periode";
  }

  async function ambilFamily() {
    const session = await AuthService.ambilSession();
    if (!session) throw new Error("Belum ada session Supabase. Login melalui login.html.");

    const families = await FamilyService.ambilKeluargaSaya();
    if (!families.length) throw new Error("Akun ini belum tergabung ke ruang keluarga.");

    preferensi = bacaPreferensi();
    const family = families.find(item => item.id === preferensi.familyAktif) || families[0];
    simpanPreferensi({ familyAktif: family.id });
    return family;
  }

  function entryAktif(item) {
    return item.entries?.find(entry => entry.wallet_id === dompetAktif.wallet_id) || null;
  }

  function entryLawan(item) {
    return item.entries?.find(entry => entry.wallet_id !== dompetAktif.wallet_id) || null;
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

    daftar
      .filter(item => item.kind === kind && item.account_id)
      .forEach(item => {
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
        hasil.push({
          akunId: "__transfer_fee__",
          nama: "Biaya Admin Transfer",
          ikon: "card-outline",
          jumlah: fee
        });
      }
    }

    return hasil.sort((a, b) => b.jumlah - a.jumlah);
  }

  function renderKategori(elemen, daftar, jenis, total) {
    elemen.innerHTML = "";

    if (!daftar.length) {
      elemen.innerHTML = `
        <div class="kosong-detail">
          <ion-icon name="pie-chart-outline"></ion-icon>
          Belum ada ${jenis} pada periode ini.
        </div>`;
      return;
    }

    daftar.forEach(item => {
      const persen = total > 0 ? (item.jumlah / total) * 100 : 0;
      const node = document.createElement("div");
      node.className = `item-kategori-detail ${jenis === "pemasukan" ? "pemasukan" : ""}`;
      node.innerHTML = `
        <span class="item-kategori-ikon"><ion-icon name="${escapeHTML(item.ikon)}"></ion-icon></span>
        <span class="item-kategori-info">
          <span class="item-kategori-header">
            <strong>${escapeHTML(item.nama)}</strong>
            <span>${Math.round(persen)}%</span>
          </span>
          <span class="item-kategori-track">
            <span class="item-kategori-fill" style="width:${Math.min(persen, 100)}%"></span>
          </span>
        </span>
        <strong class="item-kategori-nilai">${rupiah(item.jumlah, dompetAktif.currency_code)}</strong>`;
      elemen.appendChild(node);
    });
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
        nama: keluar
          ? `Transfer ke ${lawan?.wallet?.name || "Dompet"}`
          : `Transfer dari ${lawan?.wallet?.name || "Dompet"}`,
        sub: `${item.note || "Transfer antar dompet"}${feeInfo}`,
        ikon: "swap-horizontal-outline",
        nilai: Math.abs(delta),
        tanda: delta >= 0 ? "+" : "−",
        masuk: delta > 0
      };
    }

    if (item.kind === "adjustment") {
      return {
        nama: "Penyesuaian Saldo",
        sub: item.note || "Penyesuaian saldo dompet",
        ikon: "options-outline",
        nilai: Math.abs(delta),
        tanda: delta >= 0 ? "+" : "−",
        masuk: delta > 0
      };
    }

    return {
      nama: dataAkun?.name || (item.kind === "income" ? "Pemasukan" : "Pengeluaran"),
      sub: item.note || (item.kind === "income" ? "Pemasukan" : "Pengeluaran"),
      ikon: dataAkun?.icon_value || "ellipse-outline",
      nilai: Number(item.amount || Math.abs(delta)),
      tanda: item.kind === "income" ? "+" : "−",
      masuk: item.kind === "income"
    };
  }

  function renderTransaksi(daftar) {
    const container = document.querySelector("[data-transaksi-dompet]");
    container.innerHTML = "";

    if (!daftar.length) {
      container.innerHTML = `
        <div class="kosong-detail">
          <ion-icon name="receipt-outline"></ion-icon>
          Belum ada transaksi untuk ${escapeHTML(dompetAktif.name)} pada periode ini.
        </div>`;
      return;
    }

    let tanggalSebelumnya = "";

    daftar.forEach(item => {
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
      button.className = `transaksi-detail-item ${info.masuk ? "pemasukan" : ""}`;
      button.innerHTML = `
        <span class="transaksi-detail-ikon"><ion-icon name="${escapeHTML(info.ikon)}"></ion-icon></span>
        <span class="transaksi-detail-info">
          <strong>${escapeHTML(info.nama)}</strong>
          <span>${escapeHTML(info.sub)}</span>
        </span>
        <strong class="transaksi-detail-nilai">${info.tanda} ${rupiah(info.nilai, dompetAktif.currency_code)}</strong>
        <ion-icon name="chevron-forward-outline"></ion-icon>`;
      button.addEventListener("click", () => {
        location.href = `detail-transaksi.html?id=${encodeURIComponent(item.id)}`;
      });
      container.appendChild(button);
    });
  }

  async function muatTransaksi() {
    const periode = preferensi.periodeAktif || "month";
    const range = rentangPeriode(periode);

    transaksiAktif = await FinanceService.ambilTransaksiDompet({
      familyId: familyAktif.id,
      walletId: dompetAktif.wallet_id,
      startDate: range.startDate,
      endDate: range.endDate,
      limit: 300
    });
  }

  function renderUtama() {
    const periode = preferensi.periodeAktif || "month";
    const { masuk, keluar } = totalArus(transaksiAktif);
    const arusBersih = masuk - keluar;

    document.querySelector("[data-pemilih-dompet-ikon]").setAttribute("name", dompetAktif.icon_value || "wallet-outline");
    document.querySelector("[data-pemilih-dompet-nama]").textContent = dompetAktif.name;
    document.querySelector("[data-detail-ikon]").setAttribute("name", dompetAktif.icon_value || "wallet-outline");
    document.querySelector("[data-detail-nama]").textContent = dompetAktif.name;
    document.querySelector("[data-detail-saldo]").textContent = rupiah(dompetAktif.current_balance, dompetAktif.currency_code);
    document.querySelector("[data-detail-label-periode]").textContent = labelPeriode(periode);
    document.querySelector("[data-total-pemasukan]").textContent = rupiah(masuk, dompetAktif.currency_code);
    document.querySelector("[data-total-pengeluaran]").textContent = rupiah(keluar, dompetAktif.currency_code);
    document.querySelector("[data-banding-pemasukan]").textContent = rupiah(masuk, dompetAktif.currency_code);
    document.querySelector("[data-banding-pengeluaran]").textContent = rupiah(keluar, dompetAktif.currency_code);

    document.querySelector("[data-tambah-transaksi-detail]").href = `transaksi.html?dompet=${encodeURIComponent(dompetAktif.wallet_id)}`;
    document.querySelector("[data-edit-dompet]").href = `dompet-form.html?id=${encodeURIComponent(dompetAktif.wallet_id)}`;

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
    const totalPengeluaranNyata = pengeluaranKategori.reduce((a, b) => a + b.jumlah, 0);
    const totalPemasukanNyata = pemasukanKategori.reduce((a, b) => a + b.jumlah, 0);

    renderKategori(
      document.querySelector("[data-kategori-pengeluaran]"),
      pengeluaranKategori,
      "pengeluaran",
      totalPengeluaranNyata
    );

    renderKategori(
      document.querySelector("[data-kategori-pemasukan]"),
      pemasukanKategori,
      "pemasukan",
      totalPemasukanNyata
    );

    document.querySelector("[data-subjudul-transaksi]").textContent = `${transaksiAktif.length} transaksi • ${labelPeriode(periode)}`;
    renderTransaksi(transaksiAktif);

    document.querySelectorAll("[data-detail-periode]").forEach(button => {
      button.classList.toggle("is-aktif", button.dataset.detailPeriode === periode);
    });
  }

  const sheetDompet = document.getElementById("sheet-dompet-detail");
  const daftarDompet = document.querySelector("[data-detail-daftar-dompet]");
  const sheetPeriode = document.getElementById("sheet-periode-detail");

  function renderPilihanDompet() {
    daftarDompet.innerHTML = "";

    dompet.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pilihan-dompet-detail";
      const aktif = item.wallet_id === dompetAktif.wallet_id;
      button.innerHTML = `
        <span class="pilihan-dompet-detail-ikon"><ion-icon name="${escapeHTML(item.icon_value || "wallet-outline")}"></ion-icon></span>
        <span class="pilihan-dompet-detail-info">
          <strong>${escapeHTML(item.name)}</strong>
          <span>${rupiah(item.current_balance, item.currency_code)}</span>
        </span>
        ${aktif ? '<ion-icon class="cek-dompet-detail" name="checkmark-circle"></ion-icon>' : ""}`;

      button.addEventListener("click", async () => {
        try {
          dompetAktif = item;
          simpanPreferensi({ dompetAktif: item.wallet_id });
          history.replaceState(null, "", `dompet-detail.html?id=${encodeURIComponent(item.wallet_id)}`);
          sheetDompet.hidden = true;
          renderPilihanDompet();
          await muatTransaksi();
          renderUtama();
        } catch (error) {
          console.error("[Pilih Dompet]", error);
          alert(error?.message || "Dompet gagal dimuat.");
        }
      });

      daftarDompet.appendChild(button);
    });
  }

  async function init() {
    if (window.AUTH_READY) {
      const authOK = await window.AUTH_READY;
      if (authOK === false) return;
    }

    try {
      familyAktif = await ambilFamily();
      [dompet, akun] = await Promise.all([
        FinanceService.ambilSaldoDompet(familyAktif.id),
        FinanceService.ambilAkun(familyAktif.id)
      ]);

      if (!dompet.length) {
        location.replace("dompet-form.html?setup=awal");
        return;
      }

      preferensi = bacaPreferensi();
      const idUrl = new URLSearchParams(location.search).get("id");
      dompetAktif = dompet.find(item => item.wallet_id === idUrl)
        || dompet.find(item => item.wallet_id === preferensi.dompetAktif)
        || dompet[0];

      simpanPreferensi({
        familyAktif: familyAktif.id,
        dompetAktif: dompetAktif.wallet_id,
        periodeAktif: preferensi.periodeAktif || "month"
      });

      await muatTransaksi();
      renderPilihanDompet();
      renderUtama();
    } catch (error) {
      console.error("[Dompet Detail Backend]", error);
      root.innerHTML = `
        <div class="kosong-detail dompet-backend-error">
          <ion-icon name="cloud-offline-outline"></ion-icon>
          ${escapeHTML(error?.message || "Detail dompet belum dapat dimuat.")}
        </div>`;
    }
  }

  document.querySelector("[data-detail-buka-dompet]").addEventListener("click", () => {
    renderPilihanDompet();
    sheetDompet.hidden = false;
  });
  document.querySelector("[data-detail-tutup-dompet]").addEventListener("click", () => {
    sheetDompet.hidden = true;
  });
  sheetDompet.addEventListener("click", event => {
    if (event.target === sheetDompet) sheetDompet.hidden = true;
  });

  document.querySelector("[data-detail-buka-periode]").addEventListener("click", () => {
    sheetPeriode.hidden = false;
  });
  document.querySelector("[data-detail-tutup-periode]").addEventListener("click", () => {
    sheetPeriode.hidden = true;
  });
  sheetPeriode.addEventListener("click", event => {
    if (event.target === sheetPeriode) sheetPeriode.hidden = true;
  });

  document.querySelectorAll("[data-detail-periode]").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        simpanPreferensi({ periodeAktif: button.dataset.detailPeriode });
        sheetPeriode.hidden = true;
        await muatTransaksi();
        renderUtama();
      } catch (error) {
        console.error("[Periode Detail Dompet]", error);
        alert(error?.message || "Periode gagal dimuat.");
      }
    });
  });

  init();
})();
